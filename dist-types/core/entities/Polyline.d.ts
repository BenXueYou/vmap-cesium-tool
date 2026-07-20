import type { Viewer, Color, MaterialProperty } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';
/**
 * Polyline 配置选项
 */
export interface PolylineOptions extends BaseOverlayOptions {
    /** 位置数组（至少 2 个点） */
    positions: OverlayPosition[];
    /** 线宽（默认 2） */
    width?: number;
    /** 材质（颜色、字符串或 MaterialProperty） */
    material?: MaterialProperty | Color | string;
    /** 兼容旧版颜色字段 */
    color?: Color | string;
    /** 是否贴地（默认 false） */
    clampToGround?: boolean;
    /** 贴地抬高量（米，clampToGround=true 时生效） */
    groundHeightEpsilon?: number;
}
/**
 * Polyline 折线类
 *
 * 用于在地图上创建折线，支持自定义宽度、材质和贴地属性。
 *
 * @example
 * ```typescript
 * const polyline = new Polyline(viewer, {
 *   positions: [
 *     [120.1, 30.2],
 *     [120.2, 30.3],
 *     [120.3, 30.4]
 *   ],
 *   width: 4,
 *   material: '#FF0000'
 * });
 * viewer.entities.add(polyline.getEntity());
 * ```
 */
export declare class Polyline extends BaseOverlay {
    private polylineOptions;
    constructor(viewer: Viewer, options: PolylineOptions);
    /**
     * 创建 PolylineGraphics 对象
     */
    private createPolylineGraphics;
    /**
     * 解析材质
     */
    private resolveMaterial;
    /**
     * 解析颜色值
     */
    private resolveColor;
    /**
     * 抬高位置点
     */
    private elevatePositions;
    /**
     * 更新 Polyline 配置
     */
    update(options: Partial<PolylineOptions>): void;
    /**
     * 更新位置
     */
    setPositions(positions: OverlayPosition[]): void;
    /**
     * 获取位置数组（经纬度）
     */
    getPositions(): [number, number][];
    /**
     * 获取折线样式
     */
    getStyle(): Partial<PolylineOptions>;
}
