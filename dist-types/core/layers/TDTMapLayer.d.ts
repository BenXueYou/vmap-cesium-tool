import * as Cesium from 'cesium';
import type { TDTLayerConfig } from '../types';
import { MapLayer } from './MapLayer';
export declare function setTDTPlugin(plugin: unknown): void;
export declare function ensureTDT3DExtensionLoaded(): Promise<boolean>;
export declare const hasTDT3DExtension: (_CesiumNS: typeof Cesium) => boolean;
/**
 * 天地图影像图层配置（带注记）
 */
export declare const createTDTImageryConfig: (token: string, sk?: string) => Cesium.ImageryProvider[];
/**
 * 天地图矢量图层配置（带注记）
 */
export declare const createTDTVectorConfig: (token: string, sk?: string) => Cesium.ImageryProvider[];
/**
 * 天地图地形图层配置（带注记）
 */
export declare const createTDTTerrainConfig: (token: string, sk?: string) => Cesium.ImageryProvider[];
/**
 * 天地图三维影像图层配置（带注记）
 */
export declare const createTDT3DImageryConfig: (token: string, sk?: string) => Cesium.ImageryProvider[];
/**
 * 天地图三维地形提供者配置
 */
export declare const createTDT3DTerrainProvider: (token: string, sk?: string) => Cesium.TerrainProvider | null;
export declare const createTDT3DGeoWTFS: (token: string, viewer: Cesium.Viewer, sk?: string) => any | null;
/**
 * 天地图图层类
 * 支持矢量、影像、地形、三维地图四种类型的天地图图层
 */
export declare class TDTMapLayer extends MapLayer {
    private config;
    /**
     * 构造函数
     * @param viewer Cesium Viewer 实例
     * @param config 天地图图层配置
     */
    constructor(viewer: Cesium.Viewer, config: TDTLayerConfig);
    /**
     * 获取影像提供者数组
     */
    /**
     * 获取地图服务提供者数组
     * @returns {Cesium.ImageryProvider[]} 返回符合配置的地图服务提供者数组
     */
    protected getProviders(): Cesium.ImageryProvider[];
    /**
     * 添加图层到 Viewer
     */
    addToViewer(): void;
    /**
     * 更新图层配置
     * @param config 新的天地图图层配置
     */
    updateConfig(config: Partial<TDTLayerConfig>): void;
    /**
     * 获取当前配置
     */
    getConfig(): TDTLayerConfig;
}
