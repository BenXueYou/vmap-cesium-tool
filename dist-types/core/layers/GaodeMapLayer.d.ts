import * as Cesium from 'cesium';
import type { GaodeLayerConfig } from '../types';
import { MapLayer } from './MapLayer';
/**
 * 高德地图影像图层配置（带注记）
 */
export declare const createGaodeImageryConfig: (token?: string) => Cesium.ImageryProvider[];
/**
 * 高德地图矢量图层配置
 */
export declare const createGaodeVectorConfig: (token?: string) => Cesium.ImageryProvider[];
/**
 * 高德地图图层类
 * 支持矢量和卫星两种类型的高德地图图层
 */
export declare class GaodeMapLayer extends MapLayer {
    private config;
    /**
     * 构造函数
     * @param viewer Cesium Viewer 实例
     * @param config 高德地图图层配置
     */
    constructor(viewer: Cesium.Viewer, config: GaodeLayerConfig);
    /**
     * 获取影像提供者数组
     */
    protected getProviders(): Cesium.ImageryProvider[];
    /**
     * 添加图层到 Viewer
     */
    addToViewer(): void;
    /**
     * 更新图层配置
     * @param config 新的高德地图图层配置
     */
    updateConfig(config: Partial<GaodeLayerConfig>): void;
    /**
     * 获取当前配置
     */
    getConfig(): GaodeLayerConfig;
}
