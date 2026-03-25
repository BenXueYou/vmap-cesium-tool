import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';

/**
 * 地图控制器 - 存根实现
 * 为了保持向后兼容性
 */
export class CesiumMapController {
  private viewer: Viewer;

  constructor(viewer: Viewer, config?: any) {
    this.viewer = viewer;
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

  toggleFullscreen(): void {
    // 存根实现 - 保持向后兼容
  }

  setInitialCenter(center: { longitude: number; latitude: number; height: number }): void {
    // 存根实现 - 保持向后兼容
  }

  getInitialCenter(): { longitude: number; latitude: number; height: number } | null {
    // 存根实现 - 保持向后兼容
    return null;
  }

  resetLocation(): void {
    // 存根实现 - 保持向后兼容
  }

  setupCameraZoomLimitListener(): void {
    // 存根实现 - 保持向后兼容
  }
}