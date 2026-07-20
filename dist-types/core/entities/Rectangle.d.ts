import * as Cesium from 'cesium';
import type { Viewer, Color, MaterialProperty, HeightReference } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions } from './BaseOverlay';
/**
 * Rectangle 配置选项
 */
export interface RectangleOptions extends BaseOverlayOptions {
    /** 矩形坐标范围 */
    coordinates: Cesium.Rectangle;
    /** 填充材质 */
    material?: MaterialProperty | Color | string;
    /** 是否显示边框（默认 true） */
    outline?: boolean;
    /** 边框颜色 */
    outlineColor?: Color | string;
    /** 边框宽度（默认 1） */
    outlineWidth?: number;
    /** 是否贴地（默认 true） */
    clampToGround?: boolean;
    /** 贴地抬高量（米，clampToGround=true 时生效） */
    groundHeightEpsilon?: number;
    /** 基准高度（米，clampToGround=false 时有效） */
    height?: number;
    /** 高度参考 */
    heightReference?: HeightReference;
    /** 拉伸高度 */
    extrudedHeight?: number;
    /** 兼容旧版渲染模式配置 */
    renderMode?: 'auto' | 'entity' | 'primitive';
}
/**
 * Rectangle 矩形类
 *
 * 用于在地图上创建矩形区域，支持自定义填充、边框和贴地属性。
 *
 * @example
 * ```typescript
 * const rectangle = new Rectangle(viewer, {
 *   coordinates: Cesium.Rectangle.fromDegrees(120, 30, 121, 31),
 *   material: 'rgba(0, 255, 0, 0.3)',
 *   outline: true,
 *   outlineColor: '#00FF00'
 * });
 * viewer.entities.add(rectangle.getEntity());
 * ```
 */
export declare class Rectangle extends BaseOverlay {
    private rectangleOptions;
    private innerEntity?;
    constructor(viewer: Viewer, options: RectangleOptions);
    /**
     * 创建粗边框矩形（环形）
     */
    private createThickRectangle;
    /**
     * 创建 RectangleGraphics 对象
     */
    private createRectangleGraphics;
    /**
     * 将 Rectangle 转为四点多边形顶点
     */
    private rectangleToPositions;
    /**
     * 按米单位向内收缩矩形边界
     */
    private shrinkRectangle;
    /**
     * 解析材质
     */
    private resolveMaterial;
    /**
     * 解析颜色值
     */
    private resolveColor;
    /**
     * 更新 Rectangle 配置
     */
    update(options: Partial<RectangleOptions>): void;
    /**
     * 更新坐标
     */
    setCoordinates(coordinates: Cesium.Rectangle): void;
    /**
     * 更新坐标（内部方法）
     */
    private updateCoordinates;
    /**
     * 获取矩形坐标
     */
    getCoordinates(): Cesium.Rectangle | null;
    /**
     * 获取矩形样式
     */
    getStyle(): Partial<RectangleOptions>;
    /**
     * 从场景中移除矩形
     */
    remove(): void;
}
