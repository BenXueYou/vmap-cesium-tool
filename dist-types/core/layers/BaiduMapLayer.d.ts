import * as Cesium from 'cesium';
import type { BaiduLayerConfig } from '../types';
import { MapLayer } from './MapLayer';
/**
 * 百度地图影像图层配置
 */
export declare const createBaiduImageryConfig: (token?: string) => Cesium.ImageryProvider[];
/**
 * 百度地图图层类
 * 支持普通、卫星、地形三种类型的百度地图图层
 */
export declare class BaiduMapLayer extends MapLayer {
    private config;
    /**
     * 构造函数
     * @param viewer Cesium Viewer 实例
     * @param config 百度地图图层配置
     */
    constructor(viewer: Cesium.Viewer, config: BaiduLayerConfig);
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
     * @param config 新的百度地图图层配置
     */
    updateConfig(config: Partial<BaiduLayerConfig>): void;
    /**
     * 获取当前配置
     */
    getConfig(): BaiduLayerConfig;
}
