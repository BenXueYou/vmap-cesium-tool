import * as Cesium from 'cesium';
import type { CustomLayerConfig } from '../types';
import { MapLayer } from './MapLayer';
/**
 * 自定义地图图层类
 * 支持用户自定义的影像提供者数组
 */
export declare class CustomMapLayer extends MapLayer {
    private config;
    /**
     * 构造函数
     * @param viewer Cesium Viewer 实例
     * @param config 自定义图层配置
     */
    constructor(viewer: Cesium.Viewer, config: CustomLayerConfig);
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
     * @param config 新的自定义图层配置
     */
    updateConfig(config: Partial<CustomLayerConfig>): void;
    /**
     * 获取当前配置
     */
    getConfig(): CustomLayerConfig;
    /**
     * 添加单个影像提供者
     * @param provider 影像提供者
     */
    addProvider(provider: Cesium.ImageryProvider): void;
    /**
     * 移除指定索引的影像提供者
     * @param index 提供者索引
     */
    removeProvider(index: number): void;
}
