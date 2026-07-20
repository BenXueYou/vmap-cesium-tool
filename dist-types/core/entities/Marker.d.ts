import * as Cesium from 'cesium';
import type { Viewer, Color, HeightReference } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';
/**
 * Marker 配置选项
 */
export interface MarkerOptions extends BaseOverlayOptions {
    /** 点像素大小（默认 10） */
    pixelSize?: number;
    /** 填充颜色（默认红色） */
    color?: Color | string;
    /** 描边颜色（默认白色） */
    outlineColor?: Color | string;
    /** 描边宽度（默认 2） */
    outlineWidth?: number;
    /** 高度参考（默认 NONE） */
    heightReference?: HeightReference;
    /** 根据距离缩放 */
    scaleByDistance?: Cesium.NearFarScalar;
    /** 禁用深度测试距离 */
    disableDepthTestDistance?: number;
}
/**
 * Marker 点标记类
 *
 * 用于在地图上创建一个点标记，支持自定义颜色、大小、描边等样式。
 *
 * @example
 * ```typescript
 * const marker = new Marker(viewer, {
 *   position: [120.1, 30.2],
 *   pixelSize: 12,
 *   color: '#FF0000',
 *   onClick: (entity) => console.log('Marker clicked')
 * });
 * viewer.entities.add(marker.getEntity());
 * ```
 */
export declare class Marker extends BaseOverlay {
    private markerOptions;
    constructor(viewer: Viewer, options: MarkerOptions);
    /**
     * 创建 PointGraphics 对象
     */
    private createPointGraphics;
    /**
     * 解析颜色值
     */
    private resolveColor;
    /**
     * 更新 Marker 配置
     */
    update(options: Partial<MarkerOptions>): void;
    /**
     * 更新位置
     */
    setPosition(position: OverlayPosition): void;
    /**
     * 获取位置（经纬度）
     */
    getPosition(): [number, number] | null;
    /**
     * 获取点样式
     */
    getStyle(): Partial<MarkerOptions>;
}
