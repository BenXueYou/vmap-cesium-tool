import * as Cesium from 'cesium';
import type { Viewer, Color, HeightReference, VerticalOrigin, HorizontalOrigin } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';
/**
 * SVG 配置选项
 */
export interface SvgOptions extends BaseOverlayOptions {
    /** SVG 字符串 */
    svg: string;
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
 * SVG 图标类
 *
 * 用于在地图上创建 SVG 图标标记，使用 Billboard 实现。
 * 支持自定义 SVG 内容、大小、旋转、颜色等样式。
 *
 * @example
 * ```typescript
 * const svg = new SVG(viewer, {
 *   position: [120.1, 30.2],
 *   svg: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="red"/></svg>',
 *   width: 32,
 *   height: 32
 * });
 * viewer.entities.add(svg.getEntity());
 * ```
 */
export declare class SVG extends BaseOverlay {
    private svgOptions;
    constructor(viewer: Viewer, options: SvgOptions);
    /**
     * 将 SVG 字符串转换为 data URL
     */
    private svgToDataUrl;
    /**
     * 创建 BillboardGraphics 对象
     */
    private createBillboardGraphics;
    /**
     * 解析颜色值
     */
    private resolveColor;
    /**
     * 更新 SVG 配置
     */
    update(options: Partial<SvgOptions>): void;
    /**
     * 更新位置
     */
    setPosition(position: OverlayPosition): void;
    /**
     * 更新 SVG 内容
     */
    setSvg(svg: string): void;
    /**
     * 获取 SVG 字符串
     */
    getSvg(): string;
    /**
     * 获取位置（经纬度）
     */
    getPosition(): [number, number] | null;
    /**
     * 获取 SVG 样式
     */
    getStyle(): Partial<SvgOptions>;
}
