import * as Cesium from 'cesium';
import type { Viewer, Color, HeightReference, VerticalOrigin, HorizontalOrigin } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';
/**
 * Icon 配置选项
 */
export interface IconOptions extends BaseOverlayOptions {
    /** 图片 URL 或 base64 */
    image: string;
    /** 宽度（像素） */
    width?: number;
    /** 高度（像素） */
    height?: number;
    /** 缩放比例（默认 1.0） */
    scale?: number;
    /** 旋转角度（弧度） */
    rotation?: number;
    /** 像素偏移 */
    pixelOffset?: Cesium.Cartesian2;
    /** 视线偏移 */
    eyeOffset?: Cesium.Cartesian3;
    /** 水平原点（默认 CENTER） */
    horizontalOrigin?: HorizontalOrigin;
    /** 垂直原点（默认 BOTTOM） */
    verticalOrigin?: VerticalOrigin;
    /** 高度参考（默认 NONE） */
    heightReference?: HeightReference;
    /** 禁用深度测试距离 */
    disableDepthTestDistance?: number;
    /** 颜色（可用于着色） */
    color?: Color | string;
}
/**
 * Icon 图标类
 *
 * 用于在地图上创建图标标记，使用 Billboard 实现。
 * 支持自定义图片、大小、旋转、颜色等样式。
 *
 * @example
 * ```typescript
 * const icon = new Icon(viewer, {
 *   position: [120.1, 30.2],
 *   image: '/images/marker.png',
 *   width: 32,
 *   height: 32,
 *   onClick: (entity) => console.log('Icon clicked')
 * });
 * viewer.entities.add(icon.getEntity());
 * ```
 */
export declare class Icon extends BaseOverlay {
    private iconOptions;
    constructor(viewer: Viewer, options: IconOptions);
    /**
     * 创建 BillboardGraphics 对象
     */
    private createBillboardGraphics;
    /**
     * 解析颜色值
     */
    private resolveColor;
    /**
     * 更新 Icon 配置
     */
    update(options: Partial<IconOptions>): void;
    /**
     * 更新位置
     */
    setPosition(position: OverlayPosition): void;
    /**
     * 更新图片
     */
    setImage(image: string): void;
    /**
     * 获取图片 URL
     */
    getImage(): string;
    /**
     * 获取位置（经纬度）
     */
    getPosition(): [number, number] | null;
    /**
     * 获取图标样式
     */
    getStyle(): Partial<IconOptions>;
}
