import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';

interface MapControllerConfig {
  initialCenter?: { longitude: number; latitude: number; height: number };
  getMapTypes?: () => unknown[];
  getCurrentMapTypeId?: () => string;
  getToken?: () => string;
  zoomCallback?: {
    onZoomIn?: (beforeHeight: number, afterHeight: number, currentLevel: number) => void;
    onZoomOut?: (beforeHeight: number, afterHeight: number, currentLevel: number) => void;
  };
  onSceneModeChanged?: () => void;
  fullscreenCallback?: (isFullscreen: boolean) => void;
  resetLocationCallback?: () => void;
}

/**
 * 地图控制器 - 存根实现
 * 为了保持向后兼容性
 */
export class CesiumMapController {
  private viewer: Viewer;
  private config?: MapControllerConfig;
  private initialCenter: { longitude: number; latitude: number; height: number } | null;

  constructor(viewer: Viewer, config?: MapControllerConfig) {
    this.viewer = viewer;
    this.config = config;
    this.initialCenter = config?.initialCenter ?? null;
  }

  /**
   * 缩放到指定位置
   */
  zoomTo(longitude: number, latitude: number, height: number): void {
    this.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height)
    });
  }

  /**
   * 获取当前相机位置
   */
  getCurrentPosition(): { longitude: number; latitude: number; height: number } | null {
    const position = this.viewer.camera.positionCartographic;
    if (!position) return null;
    return {
      longitude: Cesium.Math.toDegrees(position.longitude),
      latitude: Cesium.Math.toDegrees(position.latitude),
      height: position.height
    };
  }

  toggle2D3D(buttonElement?: HTMLElement): void {
    const scene = this.viewer.scene;
    const is3D = scene.mode === Cesium.SceneMode.SCENE3D;
    const completeMorph = () => {
      this.config?.onSceneModeChanged?.();
      if (buttonElement) {
        buttonElement.setAttribute('data-scene-mode', is3D ? '2d' : '3d');
      }
    };

    if (is3D) {
      scene.morphTo2D(0.5);
    } else {
      scene.morphTo3D(0.5);
    }

    setTimeout(completeMorph, 550);
  }

  zoomIn(): void {
    const beforeHeight = this.viewer.camera.positionCartographic.height;
    this.viewer.camera.zoomIn(Math.max(beforeHeight * 0.35, 100));
    const afterHeight = this.viewer.camera.positionCartographic.height;
    this.config?.zoomCallback?.onZoomIn?.(beforeHeight, afterHeight, this.getZoomLevel());
  }

  zoomOut(): void {
    const beforeHeight = this.viewer.camera.positionCartographic.height;
    this.viewer.camera.zoomOut(Math.max(beforeHeight * 0.35, 100));
    const afterHeight = this.viewer.camera.positionCartographic.height;
    this.config?.zoomCallback?.onZoomOut?.(beforeHeight, afterHeight, this.getZoomLevel());
  }

  toggleFullscreen(): void {
    const container = this.viewer.container;
    if (!container) return;

    const fullscreenElement = document.fullscreenElement;
    if (fullscreenElement) {
      void document.exitFullscreen?.();
      this.config?.fullscreenCallback?.(false);
      return;
    }

    if (container.requestFullscreen) {
      void container.requestFullscreen();
      this.config?.fullscreenCallback?.(true);
    }
  }

  setInitialCenter(center: { longitude: number; latitude: number; height: number }): void {
    this.initialCenter = center;
  }

  getInitialCenter(): { longitude: number; latitude: number; height: number } | undefined {
    return this.initialCenter ?? undefined;
  }

  resetLocation(): void {
    if (this.initialCenter) {
      this.zoomTo(this.initialCenter.longitude, this.initialCenter.latitude, this.initialCenter.height);
    }
    this.config?.resetLocationCallback?.();
  }

  setupCameraZoomLimitListener(): void {
    const camera = this.viewer.camera;
    const minHeight = 100;
    const maxHeight = 30000000;

    camera.changed.addEventListener(() => {
      const position = camera.positionCartographic;
      if (!position) return;

      if (position.height < minHeight) {
        camera.zoomOut(minHeight - position.height);
      } else if (position.height > maxHeight) {
        camera.zoomIn(position.height - maxHeight);
      }
    });
  }

  private getZoomLevel(): number {
    const height = this.viewer.camera.positionCartographic.height;
    if (!Number.isFinite(height) || height <= 0) {
      return 0;
    }
    return Math.max(0, Math.round(20 - Math.log2(height / 1000)));
  }
}