import * as Cesium from 'cesium';
import type { BaiduLayerConfig } from '../types';
import { MapLayer } from './MapLayer';

/**
 * 百度地图影像图层配置
 */
export const createBaiduImageryConfig = (token?: string): Cesium.ImageryProvider[] => {
  const ak = token || '';
  if (!ak) {
    console.warn('百度 ak 未提供，图层可能无法正常加载');
  }
  // 百度使用 BD-09 坐标系，需要转换
  return [
    new Cesium.UrlTemplateImageryProvider({
      url: `https://shangetu{s}.map.bdimg.com/it/u=x={x};y={y};z={z};v=009;type=sate&fm=46`,
      subdomains: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
      maximumLevel: 18,
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
    }),
  ];
};

/**
 * 百度地图图层类
 * 支持普通、卫星、地形三种类型的百度地图图层
 */
export class BaiduMapLayer extends MapLayer {
  private config: BaiduLayerConfig;

  /**
   * 构造函数
   * @param viewer Cesium Viewer 实例
   * @param config 百度地图图层配置
   */
  constructor(viewer: Cesium.Viewer, config: BaiduLayerConfig) {
    super(viewer);
    this.config = config;
  }

  /**
   * 获取影像提供者数组
   */
  protected getProviders(): Cesium.ImageryProvider[] {
    const { token, mapTypeId = 'satellite', showLabel = true } = this.config;

    let providers: Cesium.ImageryProvider[] = [];

    switch (mapTypeId) {
      case 'normal':
        // 百度普通地图（矢量），但当前实现只支持影像
        providers = createBaiduImageryConfig(token);
        break;
      case 'satellite':
        providers = createBaiduImageryConfig(token);
        break;
      case 'terrain':
        // 百度暂不支持地形，降级到卫星图
        providers = createBaiduImageryConfig(token);
        break;
      default:
        providers = createBaiduImageryConfig(token);
    }

    // 百度地图通常不单独控制注记显示
    return providers;
  }

  /**
   * 添加图层到 Viewer
   */
  addToViewer(): void {
    if (this.isAdded()) {
      console.warn('百度地图图层已添加到 Viewer 中');
      return;
    }

    const providers = this.getProviders();
    this.addImageryProviders(providers);
  }

  /**
   * 更新图层配置
   * @param config 新的百度地图图层配置
   */
  updateConfig(config: Partial<BaiduLayerConfig>): void {
    this.config = { ...this.config, ...config };

    // 重新添加图层
    this.removeFromViewer();
    this.addToViewer();
  }

  /**
   * 获取当前配置
   */
  getConfig(): BaiduLayerConfig {
    return { ...this.config };
  }
}
