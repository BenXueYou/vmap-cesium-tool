import * as Cesium from 'cesium';
import type { OSMLayerConfig } from '../types';
import { MapLayer } from './MapLayer';
/**
 * OSM 标准图层配置
 */
export declare const createOSMConfig: () => Cesium.ImageryProvider[];
/**
 * OpenStreetMap 图层类
 * 支持标准 OSM 瓦片图层
 */
export declare class OSMMapLayer extends MapLayer {
    private config;
    /**
     * 构造函数
     * @param viewer Cesium Viewer 实例
     * @param config OSM 图层配置
     */
    constructor(viewer: Cesium.Viewer, config?: OSMLayerConfig);
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
     * @param config 新的 OSM 图层配置
     */
    updateConfig(config: Partial<OSMLayerConfig>): void;
    /**
     * 获取当前配置
     */
    getConfig(): OSMLayerConfig;
}
