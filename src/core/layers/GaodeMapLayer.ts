import * as Cesium from 'cesium';
import type { GaodeLayerConfig } from '../types';
import { MapLayer } from './MapLayer';

/**
 * 高德地图影像图层配置（带注记）
 */
export const createGaodeImageryConfig = (token?: string): Cesium.ImageryProvider[] => {
  const key = token || '';
  if (!key) {
    console.warn('高德 key 未提供，图层可能无法正常加载');
  }
  return [
    // 卫星影像
    new Cesium.UrlTemplateImageryProvider({
      url: `https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}`,
      subdomains: ['1', '2', '3', '4'],
      maximumLevel: 18,
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
    }),
    // 路网注记
    new Cesium.UrlTemplateImageryProvider({
      url: `https://webst0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}`,
      subdomains: ['1', '2', '3', '4'],
      maximumLevel: 18,
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
    }),
  ];
};

/**
 * 高德地图矢量图层配置
 */
export const createGaodeVectorConfig = (token?: string): Cesium.ImageryProvider[] => {
  const key = token || '';
  return [
    // 矢量底图
    new Cesium.UrlTemplateImageryProvider({
      url: `https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}`,
      subdomains: ['1', '2', '3', '4'],
      maximumLevel: 18,
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
    }),
  ];
};

/**
 * 高德地图图层类
 * 支持矢量和卫星两种类型的高德地图图层
 */
export class GaodeMapLayer extends MapLayer {
  private config: GaodeLayerConfig;

  /**
   * 构造函数
   * @param viewer Cesium Viewer 实例
   * @param config 高德地图图层配置
   */
  constructor(viewer: Cesium.Viewer, config: GaodeLayerConfig) {
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
      case 'vector':
        providers = createGaodeVectorConfig(token);
        break;
      case 'satellite':
        providers = createGaodeImageryConfig(token);
        break;
      case 'terrain':
        // 高德暂不支持地形，降级到卫星图
        providers = createGaodeImageryConfig(token);
        break;
      default:
        providers = createGaodeImageryConfig(token);
    }

    // 如果不显示注记，只返回底图
    if (!showLabel && providers.length > 1) {
      return [providers[0]];
    }

    return providers;
  }

  /**
   * 添加图层到 Viewer
   */
  addToViewer(): void {
    if (this.isAdded()) {
      console.warn('高德地图图层已添加到 Viewer 中');
      return;
    }

    const providers = this.getProviders();
    this.addImageryProviders(providers);
  }

  /**
   * 更新图层配置
   * @param config 新的高德地图图层配置
   */
  updateConfig(config: Partial<GaodeLayerConfig>): void {
    this.config = { ...this.config, ...config };

    // 重新添加图层
    this.removeFromViewer();
    this.addToViewer();
  }

  /**
   * 获取当前配置
   */
  getConfig(): GaodeLayerConfig {
    return { ...this.config };
  }
}
