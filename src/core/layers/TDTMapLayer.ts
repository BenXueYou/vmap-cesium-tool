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

const buildTDTAuthParams = (token: string, sk?: string, includeSk = true): string => {
  const params: string[] = [];
  if (token) {
    params.push(`tk=${encodeURIComponent(token)}`);
  }
  if (includeSk && sk) {
    params.push(`sk=${encodeURIComponent(sk)}`);
  }
  return params.length > 0 ? `&${params.join('&')}` : '';
};

export const hasTDT3DExtension = (_CesiumNS: typeof Cesium): boolean => {
  return isTDTPluginReady(getTDTPlugin());
};

const warnMissingTDT3DExtension = (): void => {
  console.warn('未检测到 tdt-terrain-cesium-plugin 可用导出，tdt3d 模式将只加载影像底图。');
};

const warnMissingToken = (): void => {
  console.warn('天地图 token 未提供，图层可能无法正常加载');
};

const hasValidToken = (token: string): boolean => {
  const ok = !!token && token.trim().length > 0;
  if (!ok) {
    warnMissingToken();
  }
  return ok;
};

/**
 * 天地图影像图层配置（带注记）
 */
export const createTDTImageryConfig = (token: string, sk?: string): Cesium.ImageryProvider[] => {
  if (!hasValidToken(token)) {
    return [];
  }

  return [
    new Cesium.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}${buildTDTAuthParams(token, sk)}`,
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
      url: `https://t{s}.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}${buildTDTAuthParams(token, sk)}`,
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
export const createTDTVectorConfig = (token: string, sk?: string): Cesium.ImageryProvider[] => {
  if (!hasValidToken(token)) {
    return [];
  }

  return [
    new Cesium.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}${buildTDTAuthParams(token, sk)}`,
      subdomains: TDT_SUBDOMAINS,
      layer: 'vec',
      style: 'default',
      tileMatrixSetID: 'GoogleMapsCompatible',
      minimumLevel: 1,
      maximumLevel: 18,
      credit: '© 天地图',
    }),
    new Cesium.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}${buildTDTAuthParams(token, sk)}`,
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
export const createTDTTerrainConfig = (token: string, sk?: string): Cesium.ImageryProvider[] => {
  if (!hasValidToken(token)) {
    return [];
  }

  return [
    new Cesium.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/ter_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ter&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}${buildTDTAuthParams(token, sk)}`,
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
      url: `https://t{s}.tianditu.gov.cn/cta_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cta&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}${buildTDTAuthParams(token, sk)}`,
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
export const createTDT3DImageryConfig = (token: string, sk?: string): Cesium.ImageryProvider[] => {
  if (!hasValidToken(token)) {
    return [];
  }

  // 与 mountTdtScene 方案保持一致：三维底图仍使用 WMTS 影像/注记，
  // 地形与三维注记由 mapservice 插件能力补齐。
  const wmtsAuthParams = buildTDTAuthParams(token, sk);

  return [
    new Cesium.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}${wmtsAuthParams}`,
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
      url: `https://t{s}.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}${wmtsAuthParams}`,
      layer: 'cia',
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
 * 天地图三维地形提供者配置
 */
export const createTDT3DTerrainProvider = (token: string, sk?: string): Cesium.TerrainProvider | null => {
  if (!hasValidToken(token)) {
    return null;
  }

  if (!hasTDT3DExtension(Cesium)) {
    warnMissingTDT3DExtension();
    return null;
  }

  const plugin = getTDTPlugin() as TDTPluginModule;
  return new plugin.GeoTerrainProvider!({
    url: `${TDT_BASE_URL}mapservice/swdx?T=elv_c&x={x}&y={y}&l={z}${buildTDTAuthParams(token, sk)}`,
    subdomains: TDT_SUBDOMAINS,
    token,
  });
};

export const createTDT3DGeoWTFS = (token: string, viewer: Cesium.Viewer, sk?: string): any | null => {
  if (!hasValidToken(token)) {
    return null;
  }

  if (!hasTDT3DExtension(Cesium)) {
    warnMissingTDT3DExtension();
    return null;
  }

  const plugin = getTDTPlugin() as TDTPluginModule;
  const wtfs = new plugin.GeoWTFS!(viewer, {
    url: `${TDT_BASE_URL}mapservice/GetTiles?lxys={z},{x},{y}&version=1.0.0${buildTDTAuthParams(token, sk)}`,
    icoUrl: `${TDT_BASE_URL}mapservice/GetIcon?id={id}&version=1.0.0${buildTDTAuthParams(token, sk)}`,
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
  /**
   * 获取地图服务提供者数组
   * @returns {Cesium.ImageryProvider[]} 返回符合配置的地图服务提供者数组
   */
  protected getProviders(): Cesium.ImageryProvider[] {
    // 从配置中解构获取token、mapTypeId和showLabel，并设置默认值
    const { token = '', mapTypeId = 'img', showLabel = true } = this.config;
    debugger;
    // 初始化地图服务提供者数组
    let providers: Cesium.ImageryProvider[] = [];

    // 输出当前获取提供者配置的日志信息
    console.log('==========================================', this.config);

    // 根据mapTypeId的值创建不同的地图服务提供者配置
    switch (mapTypeId) {
      case 'vec': // 矢量地图
        providers = createTDTVectorConfig(token, this.config.sk);
        break;
      case 'img': // 影像地图
        providers = createTDTImageryConfig(token, this.config.sk);
        break;
      case 'ter': // 地形图
        providers = createTDTTerrainConfig(token, this.config.sk);
        break;
      case 'tdt3d': // 三维地图
        providers = createTDT3DImageryConfig(token, this.config.sk);
        break;
      default: // 默认使用影像地图
        providers = createTDTImageryConfig(token, this.config.sk);
    }

    // 如果不需要显示标签且提供者数量大于1，则只返回第一个提供者
    if (!showLabel && providers.length > 1) {
      return [providers[0]];
    }

    // 返回完整的提供者数组
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