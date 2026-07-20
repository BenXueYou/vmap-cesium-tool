import type { Viewer, Color } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';
/**
 * Ring 配置选项
 */
export interface RingOptions extends BaseOverlayOptions {
    /** 中心点位置 */
    position: OverlayPosition;
    /** 半径（米） */
    radius: number;
    /** 发光颜色 */
    color?: Color | string;
    /** 是否显示内层线（默认 true） */
    showInnerLine?: boolean;
    /** 内层线颜色 */
    lineColor?: Color | string;
    /** 内层线型（默认 'solid'） */
    lineStyle?: 'solid' | 'dashed';
    /** 虚线材质模式（默认 'stripe'） */
    lineMaterialMode?: 'stripe' | 'dash';
    /** 条纹重复次数（默认 32） */
    stripeRepeat?: number;
    /** 虚线长度（默认 16） */
    dashLength?: number;
    /** 虚线模式（16bit pattern） */
    dashPattern?: number;
    /** 间隙颜色 */
    gapColor?: Color | string;
    /** 外环宽度（默认 8） */
    width?: number;
    /** 兼容旧版边线宽度配置 */
    lineWidth?: number;
    /** 发光强度（0-1，默认 0.25） */
    glowPower?: number;
    /** 是否贴地（默认 true） */
    clampToGround?: boolean;
    /** 贴地抬高量（米） */
    groundHeightEpsilon?: number;
    /** 圆环分段数（默认 128） */
    segments?: number;
    /** 兼容旧版发光宽度配置 */
    glowWidth?: number;
    /** 兼容旧版动画速度字段（当前保留，不参与渲染） */
    speed?: number;
}
/**
 * Ring 发光圆环类
 *
 * 用于在地图上创建边缘发光的圆环效果。
 * 使用 PolylineGlowMaterialProperty 实现发光效果。
 *
 * @example
 * ```typescript
 * const ring = new Ring(viewer, {
 *   position: [120.1, 30.2],
 *   radius: 1000,
 *   color: '#00FFFF',
 *   glowPower: 0.5,
 *   width: 10
 * });
 * viewer.entities.add(ring.getEntity());
 * ```
 */
export declare class Ring extends BaseOverlay {
    private ringOptions;
    private innerEntity?;
    constructor(viewer: Viewer, options: RingOptions);
    /**
     * 创建发光圆环
     */
    private createRing;
    /**
     * 创建内层线材质
     */
    private createLineMaterial;
    /**
     * 生成近似圆顶点
     */
    private generateCirclePositions;
    /**
     * 解析颜色值
     */
    private resolveColor;
    /**
     * 更新 Ring 配置
     */
    update(options: Partial<RingOptions>): void;
    /**
     * 重建内层线
     */
    private rebuildInnerLine;
    /**
     * 更新几何形状
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
    /**
     * 从场景中移除圆环
     */
    remove(): void;
}
