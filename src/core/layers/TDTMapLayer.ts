import * as Cesium from 'cesium';
import type { TDTLayerConfig } from '../types';
import { MapLayer } from './MapLayer';

type TDTPluginModule = {
  GeoTerrainProvider?: new (options: {
    url: string;
    subdomains?: string[];
    token?: string;
  }) => Cesium.TerrainProvider;
  GeoWTFS?: new (viewer: Cesium.Viewer, options: Record<string, unknown>) => any;
};

type TDTPluginImport = TDTPluginModule & {
  default?: TDTPluginModule;
};

let TDT_PLUGIN: TDTPluginModule | null = null;
let tdtPluginLoadPromise: Promise<TDTPluginModule | null> | null = null;

const isTDTPluginReady = (plugin: TDTPluginModule | null): boolean => {
  return plugin !== null
    && typeof plugin.GeoTerrainProvider === 'function'
    && typeof plugin.GeoWTFS === 'function';
};

const normalizeTDTPlugin = (plugin: unknown): TDTPluginModule | null => {
  const pluginModule = plugin as TDTPluginImport;
  const normalized = pluginModule.default || pluginModule;
  return normalized || null;
};

async function tryAutoLoadPlugin(): Promise<void> {
  if (isTDTPluginReady(TDT_PLUGIN)) {
    return;
  }

  if (tdtPluginLoadPromise) {
    TDT_PLUGIN = await tdtPluginLoadPromise;
    return;
  }

  tdtPluginLoadPromise = import('tdt-terrain-cesium-plugin')
    .then((mod) => {
      const plugin = normalizeTDTPlugin(mod);
      TDT_PLUGIN = plugin;
      console.debug('成功加载 tdt-terrain-cesium-plugin');
      return plugin;
    })
    .catch((e) => {
      console.debug('未找到 tdt-terrain-cesium-plugin，天地图三维功能将不可用', e);
      return null;
    })
    .finally(() => {
      tdtPluginLoadPromise = null;
    });

  TDT_PLUGIN = await tdtPluginLoadPromise;
}

export function setTDTPlugin(plugin: unknown): void {
  TDT_PLUGIN = normalizeTDTPlugin(plugin);
  if (isTDTPluginReady(TDT_PLUGIN)) {
    console.debug('天地图插件已设置');
  }
}

export async function ensureTDT3DExtensionLoaded(): Promise<boolean> {
  if (isTDTPluginReady(TDT_PLUGIN)) {
    return true;
  }

  await tryAutoLoadPlugin();
  return isTDTPluginReady(TDT_PLUGIN);
}

function getTDTPlugin(): TDTPluginModule | null {
  return TDT_PLUGIN;
}


const TDT_SUBDOMAINS = ['0', '1', '2', '3', '4', '5', '6', '7'];
const TDT_BASE_URL = 'https://t{s}.tianditu.gov.cn/';

export const hasTDT3DExtension = (_CesiumNS: typeof Cesium): boolean => {
  return isTDTPluginReady(getTDTPlugin());
};

const warnMissingTDT3DExtension = (): void => {
  console.warn('未检测到 tdt-terrain-cesium-plugin 可用导出，tdt3d 模式将只加载影像底图。');
};

const warnMissingToken = (): void => {
  console.warn('天地图 token 未提供，图层可能无法正常加载');
};

/**
 * 天地图影像图层配置（带注记）
 */
export const createTDTImageryConfig = (token: string): Cesium.ImageryProvider[] => {
  if (!token) {
    warnMissingToken();
  }

  return [
    new Cesium.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
      layer: 'img',
      style: 'default',
      format: 'tiles',
      subdomains: TDT_SUBDOMAINS,
      tileMatrixSetID: 'GoogleMapsCompatible',
      minimumLevel: 1,
      maximumLevel: 18,
      credit: '© 天地图',
    }),
    new Cesium.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
      subdomains: TDT_SUBDOMAINS,
      minimumLevel: 1,
      maximumLevel: 18,
      layer: 'cia',
      style: 'default',
      format: 'tiles',
      tileMatrixSetID: 'GoogleMapsCompatible',
      credit: '© 天地图',
    }),
  ];
};

/**
 * 天地图矢量图层配置（带注记）
 */
export const createTDTVectorConfig = (token: string): Cesium.ImageryProvider[] => {
  if (!token) {
    warnMissingToken();
  }

  return [
    new Cesium.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
      subdomains: TDT_SUBDOMAINS,
      layer: 'vec',
      style: 'default',
      tileMatrixSetID: 'GoogleMapsCompatible',
      minimumLevel: 1,
      maximumLevel: 18,
      credit: '© 天地图',
    }),
    new Cesium.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
      layer: 'cva',
      style: 'default',
      format: 'tiles',
      subdomains: TDT_SUBDOMAINS,
      tileMatrixSetID: 'GoogleMapsCompatible',
      minimumLevel: 1,
      maximumLevel: 18,
      credit: '© 天地图',
    }),
  ];
};

/**
 * 天地图地形图层配置（带注记）
 */
export const createTDTTerrainConfig = (token: string): Cesium.ImageryProvider[] => {
  if (!token) {
    warnMissingToken();
  }

  return [
    new Cesium.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/ter_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ter&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
      subdomains: TDT_SUBDOMAINS,
      minimumLevel: 1,
      maximumLevel: 14,
      format: 'tiles',
      layer: 'ter',
      style: 'default',
      tileMatrixSetID: 'GoogleMapsCompatible',
      credit: '© 天地图',
    }),
    new Cesium.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/cta_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cta&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
      subdomains: TDT_SUBDOMAINS,
      minimumLevel: 1,
      maximumLevel: 14,
      layer: 'cta',
      style: 'default',
      format: 'tiles',
      tileMatrixSetID: 'GoogleMapsCompatible',
      credit: '© 天地图',
    }),
  ];
};

/**
 * 天地图三维影像图层配置（带注记）
 */
export const createTDT3DImageryConfig = (token: string): Cesium.ImageryProvider[] => {
  if (!token) {
    warnMissingToken();
  }

  return [
    new Cesium.UrlTemplateImageryProvider({
      url: `${TDT_BASE_URL}DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${token}`,
      subdomains: TDT_SUBDOMAINS,
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      maximumLevel: 18,
      enablePickFeatures: false,
    }),
    new Cesium.UrlTemplateImageryProvider({
      url: `${TDT_BASE_URL}DataServer?T=ibo_w&x={x}&y={y}&l={z}&tk=${token}`,
      subdomains: TDT_SUBDOMAINS,
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      maximumLevel: 10,
      enablePickFeatures: false,
    }),
  ];
};
/**
 * 天地图三维地形提供者配置
 */
export const createTDT3DTerrainProvider = (token: string): Cesium.TerrainProvider | null => {
  if (!hasTDT3DExtension(Cesium)) {
    warnMissingTDT3DExtension();
    return null;
  }

  const plugin = getTDTPlugin() as TDTPluginModule;
  return new plugin.GeoTerrainProvider!({
    url: `${TDT_BASE_URL}mapservice/swdx?T=elv_c&x={x}&y={y}&l={z}&tk=${token}`,
    subdomains: TDT_SUBDOMAINS,
    token,
  });
};

export const createTDT3DGeoWTFS = (token: string, viewer: Cesium.Viewer): any | null => {
  if (!hasTDT3DExtension(Cesium)) {
    warnMissingTDT3DExtension();
    return null;
  }

  const plugin = getTDTPlugin() as TDTPluginModule;
  const wtfs = new plugin.GeoWTFS!(viewer, {
    url: `${TDT_BASE_URL}mapservice/GetTiles?lxys={z},{x},{y}&version=1.0.0&tk=${token}`,
    icoUrl: `${TDT_BASE_URL}mapservice/GetIcon?id={id}&version=1.0.0&tk=${token}`,
    subdomains: TDT_SUBDOMAINS,
    token,
  });
  wtfs.initTDT();
  return wtfs;
};

/**
 * 天地图图层类
 * 支持矢量、影像、地形、三维地图四种类型的天地图图层
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
      case 'tdt3d':
        providers = createTDT3DImageryConfig(token);
        break;
      default:
        providers = createTDTImageryConfig(token);
    }

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