import * as Cesium from 'cesium';
import type { OSMLayerConfig } from '../types';
import { MapLayer } from './MapLayer';

/**
 * OSM 标准图层配置
 */
export const createOSMConfig = (): Cesium.ImageryProvider[] => {
  return [
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      subdomains: ['a', 'b', 'c'],
      maximumLevel: 19,
      credit: '© OpenStreetMap contributors',
    }),
  ];
};

/**
 * OpenStreetMap 图层类
 * 支持标准 OSM 瓦片图层
 */
export class OSMMapLayer extends MapLayer {
  private config: OSMLayerConfig;

  /**
   * 构造函数
   * @param viewer Cesium Viewer 实例
   * @param config OSM 图层配置
   */
  constructor(viewer: Cesium.Viewer, config: OSMLayerConfig = {}) {
    super(viewer);
    this.config = config;
  }

  /**
   * 获取影像提供者数组
   */
  protected getProviders(): Cesium.ImageryProvider[] {
    // OSM 配置相对简单，主要使用默认配置
    return createOSMConfig();
  }

  /**
   * 添加图层到 Viewer
   */
  addToViewer(): void {
    if (this.isAdded()) {
      console.warn('OSM 图层已添加到 Viewer 中');
      return;
    }

    const providers = this.getProviders();
    this.addImageryProviders(providers);
  }

  /**
   * 更新图层配置
   * @param config 新的 OSM 图层配置
   */
  updateConfig(config: Partial<OSMLayerConfig>): void {
    this.config = { ...this.config, ...config };

    // 重新添加图层
    this.removeFromViewer();
    this.addToViewer();
  }

  /**
   * 获取当前配置
   */
  getConfig(): OSMLayerConfig {
    return { ...this.config };
  }
}
