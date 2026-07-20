import * as Cesium from 'cesium';
import type { Viewer, Entity, Color, MaterialProperty, HeightReference } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';
/**
 * Circle 配置选项
 */
export interface CircleOptions extends BaseOverlayOptions {
    /** 圆心位置 */
    position: OverlayPosition;
    /** 半径（米） */
    radius: number;
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
    /** 高度参考 */
    heightReference?: HeightReference;
    /** 拉伸高度 */
    extrudedHeight?: number;
    /** 兼容旧版渲染模式配置 */
    renderMode?: 'auto' | 'entity' | 'primitive';
    /** 兼容旧版圆周分段数 */
    segments?: number;
}
/**
 * Circle 圆形类
 *
 * 用于在地图上创建圆形区域，支持自定义填充、边框和贴地属性。
 * 使用 Cesium Ellipse 实现。
 *
 * @example
 * ```typescript
 * const circle = new Circle(viewer, {
 *   position: [120.1, 30.2],
 *   radius: 1000,
 *   material: 'rgba(255, 0, 0, 0.3)',
 *   outline: true,
 *   outlineColor: '#FF0000'
 * });
 * viewer.entities.add(circle.getEntity());
 * ```
 */
export declare class Circle extends BaseOverlay {
    private static primitiveManagers;
    private circleOptions;
    private innerEntity?;
    private primitiveMode;
    private primitiveManager;
    constructor(viewer: Viewer, options: CircleOptions);
    private static getPrimitiveManager;
    private canUsePrimitive;
    private resolveMaterialColor;
    private getDefaultSegmentsForRadius;
    private initPrimitiveCircle;
    private updatePrimitiveGeometry;
    private getPrimitiveRoot;
    private getPrimitiveBatchColorFallback;
    /**
     * 创建粗边框圆形（环形）
     */
    private createThickCircle;
    /**
     * 创建 EllipseGraphics 对象
     */
    private createEllipseGraphics;
    /**
     * 生成近似圆（多边形）顶点
     */
    private generateCirclePositions;
    /**
     * 解析材质
     */
    private resolveMaterial;
    /**
     * 解析颜色值
     */
    private resolveColor;
    /**
     * 更新 Circle 配置
     */
    update(options: Partial<CircleOptions>): void;
    /**
     * 更新几何形状（位置和半径）
     */
    private updateGeometry;
    /**
     * 更新位置
     */
    setPosition(position: OverlayPosition): void;
    /**
     * 更新半径
     */
    setRadius(radius: number): void;
    /**
     * 获取位置（经纬度）
     */
    getPosition(): [number, number] | null;
    /**
     * 获取半径
     */
    getRadius(): number;
    setPrimitiveVisible(entity: Entity, visible: boolean): void;
    applyPrimitiveHighlight(entity: Entity, hlColor: Cesium.Color, _fillAlpha: number): void;
    restorePrimitiveHighlight(entity: Entity): void;
    setVisible(show: boolean): void;
    /**
     * 从场景中移除圆形
     */
    remove(): void;
}
