import * as Cesium from 'cesium';
import type { TDTLayerConfig } from '../types';
import { MapLayer } from './MapLayer';

/**
 * 天地图影像图层配置（带注记）
 */
export const createTDTImageryConfig = (token: string): Cesium.ImageryProvider[] => {
  if (!token) {
    console.warn('天地图 token 未提供，图层可能无法正常加载');
  }
  return [
    // 影像底图
          new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
            layer: "img",
            style: "default",
            format: "tiles",
            subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
            tileMatrixSetID: "GoogleMapsCompatible",
            minimumLevel: 1,
            maximumLevel: 18,
            credit: '© 天地图'
          }),
          // 影像路网标注
          new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
            minimumLevel: 1,
            maximumLevel: 18,
            layer: "cia",
            style: "default",
            format: "tiles",
            tileMatrixSetID: "GoogleMapsCompatible",
            credit: '© 天地图'
          })

  ];
};

/**
 * 天地图矢量图层配置（带注记）
 */
export const createTDTVectorConfig = (token: string): Cesium.ImageryProvider[] => {
  if (!token) {
    console.warn('天地图 token 未提供，图层可能无法正常加载');
  }
  return [
    // 矢量底图
    new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
            layer: "vec",
            style: "default",
            tileMatrixSetID: "GoogleMapsCompatible",
            minimumLevel: 1,
            maximumLevel: 18,
            credit: '© 天地图'
          }),
          // 普通路网标注
          new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
            layer: "cva",
            style: "default",
            format: "tiles",
            subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
            tileMatrixSetID: "GoogleMapsCompatible",
            minimumLevel: 1,
            maximumLevel: 18,
            credit: '© 天地图'
          })

  ];
};

/**
 * 天地图地形图层配置（带注记）
 */
export const createTDTTerrainConfig = (token: string): Cesium.ImageryProvider[] => {
  if (!token) {
    console.warn('天地图 token 未提供，图层可能无法正常加载');
  }
  return [
    // 地形晕渲
    new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/ter_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ter&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
            minimumLevel: 1,
            maximumLevel: 14,  // 限制地形图最大缩放级别
            format: "tiles",
            layer: "ter",
            style: "default",
            tileMatrixSetID: "GoogleMapsCompatible",
            credit: '© 天地图'
          }),
          // 地形路网标注
          new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/cta_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cta&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
            minimumLevel: 1,
            maximumLevel: 14,  // 限制地形标注最大缩放级别
            layer: "cta",
            style: "default",
            format: "tiles",
            tileMatrixSetID: "GoogleMapsCompatible",
            credit: '© 天地图'
          })

  ];
};

/**
 * 天地图图层类
 * 支持矢量、影像、地形三种类型的天地图图层
 */
export class TDTMapLayer extends MapLayer {
  private config: TDTLayerConfig;

  /**
   * 构造函数
   * @param viewer Cesium Viewer 实例
   * @param config 天地图图层配置
   */
  constructor(viewer: Cesium.Viewer, config: TDTLayerConfig) {
    super(viewer);
    this.config = config;
  }

  /**
   * 获取影像提供者数组
   */
  protected getProviders(): Cesium.ImageryProvider[] {
    const { token = '', mapTypeId = 'img', showLabel = true } = this.config;

    let providers: Cesium.ImageryProvider[] = [];

    switch (mapTypeId) {
      case 'vec':
        providers = createTDTVectorConfig(token);
        break;
      case 'img':
        providers = createTDTImageryConfig(token);
        break;
      case 'ter':
        providers = createTDTTerrainConfig(token);
        break;
      default:
        providers = createTDTImageryConfig(token);
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
      console.warn('TDT 图层已添加到 Viewer 中');
      return;
    }

    const providers = this.getProviders();
    this.addImageryProviders(providers);
  }

  /**
   * 更新图层配置
   * @param config 新的天地图图层配置
   */
  updateConfig(config: Partial<TDTLayerConfig>): void {
    this.config = { ...this.config, ...config };

    // 重新添加图层
    this.removeFromViewer();
    this.addToViewer();
  }

  /**
   * 获取当前配置
   */
  getConfig(): TDTLayerConfig {
    return { ...this.config };
  }
}