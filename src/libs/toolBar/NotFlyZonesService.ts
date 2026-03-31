import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';

/**
 * 禁飞区服务 - 存根实现
 * 为了保持向后兼容性
 */
export class NotFlyZonesService {
  private viewer: Viewer;
  private visible: boolean;

  constructor(viewer: Viewer, config?: any) {
    this.viewer = viewer;
    this.visible = Boolean(config?.autoLoad);
  }

  showNoFlyZones(): Promise<void> {
    this.visible = true;
    return Promise.resolve();
  }

  hideNoFlyZones(): void {
    this.visible = false;
  }

  toggleVisibility(): void {
    this.visible = !this.visible;
  }

  getNoFlyZoneVisible(): boolean {
    return this.visible;
  }

  toggleNoFlyZones(): Promise<void> {
    if (this.visible) {
      this.hideNoFlyZones();
      return Promise.resolve();
    }
    return this.showNoFlyZones();
  }

  destroy(): void {
    this.visible = false;
  }
}