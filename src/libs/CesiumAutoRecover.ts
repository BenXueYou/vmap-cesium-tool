import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';

export interface CesiumAutoRecoverOptions {
  /** 是否启用自动恢复（默认 false） */
  enabled?: boolean;
  /** 最大恢复次数（默认 3） */
  maxRetries?: number;
  /** 两次恢复之间的最小间隔（默认 5000ms） */
  cooldownMs?: number;
  /** 恢复后是否尝试保留相机视角（默认 true） */
  preserveCamera?: boolean;

  /**
   * 触发恢复的原因与错误信息
   * - reason: renderError/widgetError/watchdog/windowError 等
   */
  onRecovering?: (ctx: { reason: string; error?: unknown; attempt: number }) => void;
  /** 恢复成功回调：业务侧应在这里替换引用（非常重要） */
  onRecovered?: (ctx: { reason: string; error?: unknown; attempt: number; oldViewer: Viewer; newViewer: Viewer }) => void;

  /**
   * 渲染“静默停止”监测：有些错误不一定走 renderError，但会导致不再 postRender。
   * 注意：若开启了 requestRenderMode（按需渲染），默认不建议启用 watchdog。
   */
  watchdog?: {
    enabled?: boolean;
    /** 多久没有 postRender 认为卡死（默认 6000ms） */
    staleMs?: number;
    /** 检查间隔（默认 2000ms） */
    checkIntervalMs?: number;
  };
}

type CreateViewer = () => Promise<Viewer>;

type RemoveListener = (() => void) | null;

function addCesiumEventListener(event: any, handler: (...args: any[]) => void): { remove: RemoveListener } {
  if (!event) return { remove: null };
  try {
    const maybeRemove = event.addEventListener?.(handler);
    if (typeof maybeRemove === 'function') {
      return { remove: maybeRemove };
    }
    if (typeof event.removeEventListener === 'function') {
      return {
        remove: () => {
          try {
            event.removeEventListener(handler);
          } catch {
            // ignore
          }
        },
      };
    }
  } catch {
    // ignore
  }
  return { remove: null };
}

function captureCameraState(viewer: Viewer): { destination: any; orientation: any } | null {
  try {
    const camera: any = (viewer as any).camera;
    const pos = camera?.positionCartographic;
    if (!pos || !Number.isFinite(pos.longitude) || !Number.isFinite(pos.latitude) || !Number.isFinite(pos.height)) return null;
    const heading = Number(camera.heading);
    const pitch = Number(camera.pitch);
    const roll = Number(camera.roll);
    if (![heading, pitch, roll].every((v) => Number.isFinite(v))) return null;
    return {
      destination: { longitude: pos.longitude, latitude: pos.latitude, height: pos.height },
      orientation: { heading, pitch, roll },
    };
  } catch {
    return null;
  }
}

function restoreCameraState(viewer: Viewer, state: { destination: any; orientation: any }): void {
  try {
    const dest = Cesium.Cartesian3.fromRadians(
      state.destination.longitude,
      state.destination.latitude,
      state.destination.height
    );
    viewer.camera.setView({
      destination: dest,
      orientation: state.orientation,
    });
  } catch {
    // ignore
  }
}

/**
 * 为已有 Viewer 安装自动恢复：遇到“Rendering has stopped”/NaN render error 等，自动重建 Viewer。
 * 重要：重建会产生新的 Viewer 实例，业务侧必须在 onRecovered 里替换引用。
 */
export function enableCesiumAutoRecover(
  viewer: Viewer,
  createViewer: CreateViewer,
  options: CesiumAutoRecoverOptions
): { dispose: () => void } {
  const enabled = options.enabled === true;
  if (!enabled) return { dispose: () => void 0 };

  const maxRetries = Math.max(0, options.maxRetries ?? 3);
  const cooldownMs = Math.max(0, options.cooldownMs ?? 5000);
  const preserveCamera = options.preserveCamera !== false;

  let disposed = false;
  let recovering = false;
  let attempt = 0;
  let lastRecoverAt = 0;

  let lastPostRenderAt = Date.now();
  let watchdogTimer: any = null;

  const postRenderHandler = () => {
    lastPostRenderAt = Date.now();
  };

  const renderErrorHandler = (_scene: any, error: any) => {
    triggerRecover('renderError', error);
  };

  const widgetErrorHandler = (_widget: any, error: any) => {
    triggerRecover('widgetError', error);
  };

  const windowErrorHandler = (ev: any) => {
    // 尽量避免把业务代码的普通异常也触发重建；这里只兜底 Cesium 渲染常见关键词。
    const msg = String(ev?.message || ev?.error?.message || '');
    if (msg.includes('Rendering has stopped') || msg.includes('NaN') || msg.includes('DeveloperError')) {
      triggerRecover('windowError', ev?.error || ev);
    }
  };

  const unhandledRejectionHandler = (ev: any) => {
    const reason = ev?.reason;
    const msg = String(reason?.message || reason || '');
    if (msg.includes('Rendering has stopped') || msg.includes('NaN') || msg.includes('DataCloneError')) {
      triggerRecover('unhandledrejection', reason);
    }
  };

  const removePostRender = addCesiumEventListener((viewer as any).scene?.postRender, postRenderHandler).remove;
  const removeRenderError = addCesiumEventListener((viewer as any).scene?.renderError, renderErrorHandler).remove;
  const removeWidgetError = addCesiumEventListener((viewer as any).cesiumWidget?.errorEvent, widgetErrorHandler).remove;

  window.addEventListener('error', windowErrorHandler);
  window.addEventListener('unhandledrejection', unhandledRejectionHandler as any);

  const watchdog = options.watchdog;
  if (watchdog?.enabled) {
    const staleMs = Math.max(500, watchdog.staleMs ?? 6000);
    const checkIntervalMs = Math.max(250, watchdog.checkIntervalMs ?? 2000);
    watchdogTimer = setInterval(() => {
      if (disposed || recovering) return;
      const now = Date.now();
      if (now - lastPostRenderAt > staleMs) {
        triggerRecover('watchdog', new Error(`No postRender for ${now - lastPostRenderAt}ms`));
      }
    }, checkIntervalMs);
  }

  function triggerRecover(reason: string, error?: unknown): void {
    if (disposed) return;
    if (recovering) return;
    if (attempt >= maxRetries) return;
    const now = Date.now();
    if (now - lastRecoverAt < cooldownMs) return;
    void doRecover(reason, error);
  }

  async function doRecover(reason: string, error?: unknown): Promise<void> {
    if (disposed || recovering) return;
    recovering = true;
    lastRecoverAt = Date.now();
    attempt += 1;

    const oldViewer = viewer;
    const cameraState = preserveCamera ? captureCameraState(oldViewer) : null;
    try {
      options.onRecovering?.({ reason, error, attempt });
    } catch {
      // ignore
    }

    let newViewer: Viewer | null = null;
    try {
      try {
        (oldViewer as any).destroy?.();
      } catch {
        // ignore
      }

      newViewer = await createViewer();
      if (cameraState) {
        restoreCameraState(newViewer, cameraState);
      }
      try {
        options.onRecovered?.({ reason, error, attempt, oldViewer, newViewer });
      } catch {
        // ignore
      }
    } finally {
      recovering = false;
    }

    // 继续在新 viewer 上挂载自动恢复（保持连续性）
    if (!disposed && newViewer) {
      try {
        const disposer = enableCesiumAutoRecover(newViewer, createViewer, { ...options, enabled: true });
        (newViewer as any).__vmapAutoRecoverDispose = disposer.dispose;
      } catch {
        // ignore
      }
    }
  }

  const dispose = () => {
    disposed = true;
    try {
      removePostRender?.();
    } catch {
      // ignore
    }
    try {
      removeRenderError?.();
    } catch {
      // ignore
    }
    try {
      removeWidgetError?.();
    } catch {
      // ignore
    }
    try {
      window.removeEventListener('error', windowErrorHandler);
    } catch {
      // ignore
    }
    try {
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler as any);
    } catch {
      // ignore
    }
    if (watchdogTimer) {
      try {
        clearInterval(watchdogTimer);
      } catch {
        // ignore
      }
      watchdogTimer = null;
    }
  };

  return { dispose };
}
