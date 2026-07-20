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
    onRecovering?: (ctx: {
        reason: string;
        error?: unknown;
        attempt: number;
    }) => void;
    /** 恢复成功回调：业务侧应在这里替换引用（非常重要） */
    onRecovered?: (ctx: {
        reason: string;
        error?: unknown;
        attempt: number;
        oldViewer: Viewer;
        newViewer: Viewer;
    }) => void;
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
/**
 * 为已有 Viewer 安装自动恢复：遇到“Rendering has stopped”/NaN render error 等，自动重建 Viewer。
 * 重要：重建会产生新的 Viewer 实例，业务侧必须在 onRecovered 里替换引用。
 */
export declare function enableCesiumAutoRecover(viewer: Viewer, createViewer: CreateViewer, options: CesiumAutoRecoverOptions): {
    dispose: () => void;
};
export {};
