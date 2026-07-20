import * as Cesium from 'cesium';
import type { Viewer, Color, HeightReference, LabelStyle, VerticalOrigin, HorizontalOrigin } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';
/**
 * Label 配置选项
 */
export interface LabelOptions extends BaseOverlayOptions {
    /** 文本内容 */
    text: string;
    /** 字体（默认 '14px sans-serif'） */
    font?: string;
    /** 填充颜色（默认白色） */
    fillColor?: Color | string;
    /** 描边颜色（默认黑色） */
    outlineColor?: Color | string;
    /** 描边宽度（默认 2） */
    outlineWidth?: number;
    /** 标签样式（默认 FILL_AND_OUTLINE） */
    style?: LabelStyle;
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
    /** 缩放比例（默认 1.0） */
    scale?: number;
    /** 显示背景（默认 false） */
    showBackground?: boolean;
    /** 背景颜色 */
    backgroundColor?: Color | string;
    /** 背景内边距 */
    backgroundPadding?: Cesium.Cartesian2;
    /** 禁用深度测试距离 */
    disableDepthTestDistance?: number;
}
/**
 * Label 文本标签类
 *
 * 用于在地图上创建文本标签，支持自定义字体、颜色、背景等样式。
 *
 * @example
 * ```typescript
 * const label = new Label(viewer, {
 *   position: [120.1, 30.2],
 *   text: '杭州市',
 *   font: 'bold 16px sans-serif',
 *   fillColor: '#FFFFFF'
 * });
 * viewer.entities.add(label.getEntity());
 * ```
 */
export declare class Label extends BaseOverlay {
    private labelOptions;
    constructor(viewer: Viewer, options: LabelOptions);
    /**
     * 创建 LabelGraphics 对象
     */
    private createLabelGraphics;
    /**
     * 解析颜色值
     */
    private resolveColor;
    /**
     * 更新 Label 配置
     */
    update(options: Partial<LabelOptions>): void;
    /**
     * 更新位置
     */
    setPosition(position: OverlayPosition): void;
    /**
     * 更新文本
     */
    setText(text: string): void;
    /**
     * 获取文本内容
     */
    getText(): string;
    /**
     * 获取位置（经纬度）
     */
    getPosition(): [number, number] | null;
    /**
     * 获取标签样式
     */
    getStyle(): Partial<LabelOptions>;
}
