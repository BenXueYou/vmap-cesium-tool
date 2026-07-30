import type { Viewer, Entity } from 'cesium';
import { OverlayService, type OverlayServiceOptions } from '../core/services/overlay/OverlayService';
import type { MarkerOptions, LabelOptions, IconOptions, SvgOptions, InfoWindowOptions, PolylineOptions, PolygonOptions, RectangleOptions, CircleOptions, RingOptions, OverlayEntity, OverlayPosition } from '../core/entities';
/**
 * 旧版覆盖物服务选项（保持向后兼容）
 */
export interface LegacyCesiumOverlayServiceOptions extends OverlayServiceOptions {
    /** 是否启用 hover 处理器 */
    enableHoverHandler?: boolean;
    /** 点击节流间隔 */
    clickPickMinIntervalMs?: number;
    /** 兼容旧版编辑变化回调 */
    onOverlayEditChange?: (entity: Entity & OverlayEntity) => void;
    /** 兼容旧版编辑结束回调 */
    onOverlayEditEnd?: (entity: Entity & OverlayEntity | null) => void;
    /** 兼容旧版编辑参数 */
    overlayEditOptions?: Record<string, any>;
}
/**
 * OverlayService 适配器
 *
 * 基于新的 OverlayService 架构，提供与旧版 CesiumOverlayService 兼容的 API。
 * 用于平滑迁移，让现有代码无需修改即可使用新架构。
 *
 * @example
 * ```typescript
 * // 旧代码可以继续使用，无需修改
 * const overlayService = new OverlayServiceAdapter(viewer);
 * const marker = overlayService.addMarker({ position: [120.1, 30.2] });
 * const polygon = overlayService.addPolygon({ positions: [[120.1, 30.2], [120.2, 30.3]] });
 * ```
 */
export declare class OverlayServiceAdapter {
    private viewer;
    private overlayService;
    private hoverEnabled;
    private bulkUpdateDepth;
    private overlayEditOptions;
    constructor(viewer: Viewer, options?: LegacyCesiumOverlayServiceOptions);
    private resolveOverlayEntity;
    private applyHoverState;
    /**
     * 添加 Marker
     */
    addMarker(options: MarkerOptions): Entity;
    /**
     * 添加 Label
     */
    addLabel(options: LabelOptions): Entity;
    /**
     * 添加 Icon
     */
    addIcon(options: IconOptions): Entity;
    /**
     * 添加 SVG
     */
    addSvg(options: SvgOptions): Entity;
    /**
     * 添加 InfoWindow
     */
    addInfoWindow(options: InfoWindowOptions): Entity;
    /**
     * 添加 Polyline
     */
    addPolyline(options: PolylineOptions): Entity;
    /**
     * 添加 Polygon
     */
    addPolygon(options: PolygonOptions): Entity;
    /**
     * 添加 Rectangle
     */
    addRectangle(options: RectangleOptions): Entity;
    /**
     * 添加 Circle
     */
    addCircle(options: CircleOptions): Entity;
    /**
     * 添加 Ring
     */
    addRing(options: RingOptions): Entity;
    /**
     * 根据 ID 获取覆盖物
     */
    getOverlay(id: string): Entity | undefined;
    /**
     * 获取所有覆盖物实体。
     */
    getAllOverlays(): Entity[];
    /**
     * 根据 ID 删除覆盖物
     */
    removeOverlay(id: string): boolean;
    /**
     * 删除所有覆盖物
     */
    removeAllOverlays(): void;
    /**
     * 设置覆盖物可见性
     */
    setOverlayVisible(id: string, visible: boolean): boolean;
    /**
     * 更新覆盖物位置。
     * 兼容旧版的单点位置更新 API。
     */
    updateOverlayPosition(id: string, position: OverlayPosition): boolean;
    /**
     * 获取所有覆盖物 ID
     */
    getAllOverlayIds(): string[];
    getSelectedOverlay(): Entity | null;
    getSelectedOverlayId(): string | null;
    selectOverlay(entityOrId: OverlayEntity | Entity | string | number): boolean;
    clearSelection(): boolean;
    setOverlaySelectable(entityOrId: OverlayEntity | Entity | string | number, selectable: boolean): boolean;
    setSelectionEnabled(enabled: boolean): void;
    onSelectionChange(listener: (event: any) => void): () => void;
    toggleOverlayHighlight(entityOrId: OverlayEntity | Entity | string | number, reason?: 'click' | 'hover'): boolean;
    setOverlayHighlight(entityOrId: OverlayEntity | Entity | string | number, enabled: boolean, reason?: 'click' | 'hover'): boolean;
    /**
     * 显式开启/关闭 hover 高亮处理。
     */
    toggleOverlayHoverHighlight(enabled: boolean): void;
    /**
     * 开启/关闭覆盖物编辑模式。
     * compat 层直接转发到底层 OverlayService。
     */
    setOverlayEditMode(enabled: boolean, overlayEditOptions?: Record<string, any>): void;
    /**
     * 获取当前编辑模式开关。
     */
    getOverlayEditModeEnabled(): boolean;
    /**
     * 停止当前编辑目标，但不强制关闭全局编辑开关。
     */
    stopOverlayEdit(): void;
    /**
     * 主动开始编辑某个覆盖物。
     * compat 层会切换到编辑状态并抑制 hover，但不会真正渲染编辑控制点。
     */
    startOverlayEdit(entityOrId: OverlayEntity | Entity | string | number, options?: Record<string, any>): boolean;
    /**
     * 批量更新包裹器。
     */
    beginBulkUpdate(): void;
    /**
     * 结束一次批量更新。
     */
    endBulkUpdate(): void;
    /**
     * 批量更新包裹器（自动 begin/end）。
     */
    bulkUpdate<T>(fn: () => T): T;
    getCoreService(): OverlayService;
    /**
     * 销毁服务
     */
    destroy(): void;
}
/**
 * 创建 OverlayServiceAdapter 的工厂函数
 */
export declare function createOverlayServiceAdapter(viewer: Viewer, options?: LegacyCesiumOverlayServiceOptions): OverlayServiceAdapter;
