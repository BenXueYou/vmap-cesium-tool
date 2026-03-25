import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';

/**
 * 禁飞区服务 - 存根实现
 * 为了保持向后兼容性
 */
export class NotFlyZonesService {
  private viewer: Viewer;

  constructor(viewer: Viewer, config?: any) {
    this.viewer = viewer;
  }

  showNoFlyZones(): Promise<void> {
    return Promise.resolve();
  }

  hideNoFlyZones(): void {
    // 存根实现
  }

  toggleVisibility(): void {
    // 存根实现
  }

  getNoFlyZoneVisible(): boolean {
    // 存根实现
    return false;
  }
}