import * as Cesium from 'cesium';
import type { CustomLayerConfig } from '../types';
import { MapLayer } from './MapLayer';

/**
 * 自定义地图图层类
 * 支持用户自定义的影像提供者数组
 */
export class CustomMapLayer extends MapLayer {
  private config: CustomLayerConfig;

  /**
   * 构造函数
   * @param viewer Cesium Viewer 实例
   * @param config 自定义图层配置
   */
  constructor(viewer: Cesium.Viewer, config: CustomLayerConfig) {
    super(viewer);
    this.config = config;
  }

  /**
   * 获取影像提供者数组
   */
  protected getProviders(): Cesium.ImageryProvider[] {
    return this.config.providers || [];
  }

  /**
   * 添加图层到 Viewer
   */
  addToViewer(): void {
    if (this.isAdded()) {
      console.warn('自定义图层已添加到 Viewer 中');
      return;
    }

    const providers = this.getProviders();
    if (providers.length === 0) {
      console.warn('自定义图层配置中没有提供者');
      return;
    }

    this.addImageryProviders(providers);
  }

  /**
   * 更新图层配置
   * @param config 新的自定义图层配置
   */
  updateConfig(config: Partial<CustomLayerConfig>): void {
    this.config = { ...this.config, ...config };

    // 重新添加图层
    this.removeFromViewer();
    this.addToViewer();
  }

  /**
   * 获取当前配置
   */
  getConfig(): CustomLayerConfig {
    return { ...this.config };
  }

  /**
   * 添加单个影像提供者
   * @param provider 影像提供者
   */
  addProvider(provider: Cesium.ImageryProvider): void {
    const layer = this.viewer.imageryLayers.addImageryProvider(provider);
    this.imageryLayers.push(layer);
  }

  /**
   * 移除指定索引的影像提供者
   * @param index 提供者索引
   */
  removeProvider(index: number): void {
    if (index >= 0 && index < this.imageryLayers.length) {
      this.viewer.imageryLayers.remove(this.imageryLayers[index], false);
      this.imageryLayers.splice(index, 1);
    }
  }
}
