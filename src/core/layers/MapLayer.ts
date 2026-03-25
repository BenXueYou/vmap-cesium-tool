import * as Cesium from 'cesium';

/**
 * 地图图层基类
 * 提供统一的图层管理接口
 */
export abstract class MapLayer {
  protected viewer: Cesium.Viewer;
  protected imageryLayers: Cesium.ImageryLayer[] = [];

  /**
   * 构造函数
   * @param viewer Cesium Viewer 实例
   */
  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
  }

  /**
   * 添加图层到 Viewer
   * 子类必须实现此方法
   */
  abstract addToViewer(): void;

  /**
   * 从 Viewer 移除图层
   */
  removeFromViewer(): void {
    this.imageryLayers.forEach(layer => {
      this.viewer.imageryLayers.remove(layer, false);
    });
    this.imageryLayers = [];
  }

  /**
   * 获取图层提供者数组
   * 子类必须实现此方法
   */
  protected abstract getProviders(): Cesium.ImageryProvider[];

  /**
   * 添加影像图层到 Viewer
   * @param providers 影像提供者数组
   */
  protected addImageryProviders(providers: Cesium.ImageryProvider[]): void {
    providers.forEach(provider => {
      const layer = this.viewer.imageryLayers.addImageryProvider(provider);
      this.imageryLayers.push(layer);
    });
  }

  /**
   * 检查图层是否已添加到 Viewer
   */
  isAdded(): boolean {
    return this.imageryLayers.length > 0;
  }
}