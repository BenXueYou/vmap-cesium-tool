import * as Cesium from 'cesium';
import type { Viewer, Entity, Cartesian3 } from 'cesium';
import { type DrawMode, type MeasurementTheme, type MeasurementSummaryLabelStyle } from '../core/services/draw/DrawService';
import type { CoordSystem, LngLat } from '../core/types';
/**
 * 旧版绘制回调接口（保持向后兼容）
 */
export interface LegacyDrawCallbacks {
    onDrawStart?: () => void;
    onDrawEnd?: (entity: Entity | null) => void;
    onEntityRemoved?: (entity: Entity) => void;
    onMeasureComplete?: (result: {
        type: 'line' | 'polygon' | 'rectangle' | 'circle';
        positions: Cartesian3[];
        geographicPositions?: LngLat[];
        outputCoordSystem?: CoordSystem;
        distance?: number;
        areaKm2?: number;
    }) => void;
}
/**
 * 旧版绘制选项接口（保持向后兼容）
 */
export interface LegacyDrawOptions {
    measurementTheme?: MeasurementTheme;
    lineColor?: Cesium.Color | string;
    lineWidth?: number;
    strokeColor?: Cesium.Color | string;
    strokeWidth?: number;
    outlineColor?: Cesium.Color | string;
    outlineWidth?: number;
    fillColor?: Cesium.Color | string;
    clampToGround?: boolean;
    segmentDistanceLabelStyle?: MeasurementSummaryLabelStyle;
    totalDistanceLabelStyle?: MeasurementSummaryLabelStyle;
    previewAreaLabelStyle?: MeasurementSummaryLabelStyle;
    totalAreaLabelStyle?: MeasurementSummaryLabelStyle;
    hintBubbleStyle?: MeasurementSummaryLabelStyle;
    selfIntersectionEnabled?: boolean;
    selfIntersectionAllowTouch?: boolean;
    selfIntersectionAllowContinue?: boolean;
    onClick?: (entity: Entity, positions?: Cartesian3[]) => void;
    outputCoordSystem?: CoordSystem;
}
/**
 * 旧版绘制实体类型（保持向后兼容）
 */
export interface LegacyDrawEntity extends Entity {
    _drawType?: string;
    _drawOptions?: LegacyDrawOptions;
    _groundPositions?: Cartesian3[];
    _groundPosition?: Cartesian3;
    _labelEntities?: Entity[];
}
/**
 * DrawHelper 适配器
 *
 * 基于新的 DrawService 架构，提供与旧版 DrawHelper 兼容的 API。
 * 用于平滑迁移，让现有代码无需修改即可使用新架构。
 *
 * @example
 * ```typescript
 * // 旧代码可以继续使用，无需修改
 * const drawHelper = new DrawHelperAdapter(viewer);
 * drawHelper.startDrawingLine({ lineColor: '#FF0000' });
 * ```
 */
export declare class DrawHelperAdapter {
    private viewer;
    private drawService;
    private callbacks;
    constructor(viewer: Viewer);
    /**
     * 转换选项格式
     */
    private convertOptions;
    /**
     * 开始绘制线
     */
    startDrawingLine(options?: LegacyDrawOptions): void;
    /**
     * 开始绘制多边形
     */
    startDrawingPolygon(options?: LegacyDrawOptions): void;
    /**
     * 开始绘制矩形
     */
    startDrawingRectangle(options?: LegacyDrawOptions): void;
    /**
     * 开始绘制圆形
     */
    startDrawingCircle(options?: LegacyDrawOptions): void;
    /**
     * 结束绘制
     */
    endDrawing(): void;
    /**
     * 取消绘制
     */
    cancelDrawing(): void;
    /**
     * 清除所有绘制
     */
    clearAll(): void;
    /**
     * 兼容旧版完整清空方法。
     * 旧实现会直接清空场景中的实体，这里保留同名 API。
     */
    clearAllEntities(): void;
    /**
     * 兼容旧版点实体清空方法。
     * 新版绘制服务不单独维护点池，这里退化为清空当前绘制结果。
     */
    clearAllPoints(): void;
    /**
     * 删除指定实体
     */
    removeEntity(entity: Entity): void;
    /**
     * 获取已完成的实体
     */
    getFinishedEntities(): Entity[];
    /**
     * 检查是否正在绘制
     */
    isDrawing(): boolean;
    /**
     * 兼容旧版场景模式切换通知。
     * 新绘制服务内部不依赖固定偏移，这里保留空实现以避免业务侧报错。
     */
    handleSceneModeChanged(): void;
    /**
     * 获取当前绘制模式
     */
    getCurrentDrawMode(): DrawMode;
    /**
     * 设置绘制开始回调
     */
    onDrawStart(callback: () => void): void;
    /**
     * 设置绘制结束回调
     */
    onDrawEnd(callback: (entity: Entity | null) => void): void;
    /**
     * 设置实体移除回调
     */
    onEntityRemoved(callback: (entity: Entity) => void): void;
    /**
     * 设置测量完成回调
     */
    onMeasureComplete(callback: (result: {
        type: 'line' | 'polygon' | 'rectangle' | 'circle';
        positions: Cartesian3[];
        geographicPositions?: LngLat[];
        outputCoordSystem?: CoordSystem;
        distance?: number;
        areaKm2?: number;
    }) => void): void;
    getPositionLngLat(position: Cartesian3, outputCoordSystem?: CoordSystem): LngLat;
    /**
     * 销毁助手
     */
    destroy(): void;
}
/**
 * 创建 DrawHelperAdapter 的工厂函数
 */
export declare function createDrawHelperAdapter(viewer: Viewer): DrawHelperAdapter;
