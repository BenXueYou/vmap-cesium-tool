import type { Viewer, Entity } from 'cesium';
import { Marker, type MarkerOptions } from '../../entities/Marker';
import { Label, type LabelOptions } from '../../entities/Label';
import { Icon, type IconOptions } from '../../entities/Icon';
import { SVG, type SvgOptions } from '../../entities/SVG';
import { InfoWindow, type InfoWindowOptions } from '../../entities/InfoWindow';
import { Polyline, type PolylineOptions } from '../../entities/Polyline';
import { Polygon, type PolygonOptions } from '../../entities/Polygon';
import { Rectangle, type RectangleOptions } from '../../entities/Rectangle';
import { Circle, type CircleOptions } from '../../entities/Circle';
import { Ring, type RingOptions } from '../../entities/Ring';
import type { OverlayEntity } from '../../entities/BaseOverlay';
import { type PickGovernorOptions } from '../../../utils/PickGovernor';
type OverlayInstance = Marker | Label | Icon | SVG | InfoWindow | Polyline | Polygon | Rectangle | Circle | Ring;
/**
 * 覆盖物服务选项
 */
export interface OverlayServiceOptions {
    /** 是否启用 hover 处理器（默认 true） */
    enableHoverHandler?: boolean;
    /** 点击防抖/节流间隔（毫秒，默认 250） */
    clickPickMinIntervalMs?: number;
    /** 拾取交互的集中配置，旧的平铺选项仍可继续使用。 */
    picking?: OverlayPickingOptions;
    /** 覆盖物编辑变化回调 */
    onOverlayEditChange?: (entity: Entity) => void;
    /** 覆盖物编辑结束回调 */
    onOverlayEditEnd?: (entity: Entity | null) => void;
}
/**
 * 覆盖物拾取配置。
 *
 * `enabled` 是 hover 和点击指针交互的总开关；`hover` 和 `selection`
 * 分别控制两类指针交互。尺寸和数量配置会直接约束每次 drill picking
 * 的工作量。
 */
export interface OverlayPickingOptions {
    enabled?: boolean;
    hover?: boolean;
    selection?: boolean;
    pickWidth?: number;
    pickHeight?: number;
    drillLimit?: number;
    clickDebounceMs?: number;
    governorProfiles?: PickGovernorOptions['profiles'];
}
export type OverlaySelectionChangeReason = 'pointer-select' | 'pointer-toggle-off' | 'empty-click' | 'api-select' | 'api-clear' | 'disabled';
export interface OverlaySelectionChangeEvent {
    current: OverlayEntity | null;
    previous: OverlayEntity | null;
    currentId: string | null;
    previousId: string | null;
    reason: OverlaySelectionChangeReason;
}
type OverlaySelectionChangeListener = (event: OverlaySelectionChangeEvent) => void;
/**
 * 覆盖物服务类
 *
 * 统一管理所有覆盖物的创建、更新和删除。
 * 基于新的实体类架构，提供便捷的服务层 API。
 *
 * @example
 * ```typescript
 * const overlayService = new OverlayService(viewer);
 *
 * // 添加标记
 * const marker = overlayService.addMarker({
 *   position: [120.1, 30.2],
 *   pixelSize: 12,
 *   color: '#FF0000'
 * });
 *
 * // 添加多边形
 * const polygon = overlayService.addPolygon({
 *   positions: [[120.1, 30.2], [120.2, 30.3], [120.3, 30.25]],
 *   material: 'rgba(255, 0, 0, 0.3)'
 * });
 *
 * // 根据 ID 获取覆盖物
 * const m = overlayService.getOverlay(marker.getId());
 *
 * // 删除覆盖物
 * overlayService.removeOverlay(marker.getId());
 * ```
 */
export declare class OverlayService {
    private viewer;
    private overlays;
    private entityOverlayMap;
    private options;
    private readonly picking;
    private readonly pickGovernor;
    private hoverEnabled;
    private selectionEnabled;
    private readonly creationOrderById;
    private nextCreationOrder;
    private nextId;
    private clickHandler;
    private hoverHandler;
    private clickHighlightTargets;
    private hoverHighlightTargets;
    private selectedOverlayId;
    private readonly selectionListeners;
    private lastClickPickAt;
    private pendingHoverRaf;
    private pendingHoverPosition;
    private lastHoverPosition;
    private readonly highlightCache;
    private overlayEditEnabled;
    private overlayEditOptions;
    private overlayEditState;
    private markerFactory;
    private labelFactory;
    private iconFactory;
    private svgFactory;
    private infoWindowFactory;
    private polylineFactory;
    private polygonFactory;
    private rectangleFactory;
    private circleFactory;
    private ringFactory;
    constructor(viewer: Viewer, options?: OverlayServiceOptions);
    /**
     * 生成唯一 ID
     */
    generateId(prefix?: string): string;
    /**
     * 注册覆盖物
     */
    registerOverlay(id: string, overlay: OverlayInstance): void;
    /**
     * 注销覆盖物
     */
    unregisterOverlay(id: string): void;
    /**
     * 根据 ID 获取覆盖物
     */
    getOverlay(id: string): OverlayInstance | undefined;
    /**
     * 获取所有覆盖物 ID
     */
    getAllOverlayIds(): string[];
    /**
     * 获取当前选中的覆盖物根实体。
     */
    getSelectedOverlay(): OverlayEntity | null;
    /**
     * 获取当前选中的覆盖物 ID。
     */
    getSelectedOverlayId(): string | null;
    /**
     * 订阅选中态变化。
     */
    onSelectionChange(listener: OverlaySelectionChangeListener): () => void;
    /**
     * 通过实体或 ID 选中覆盖物。
     */
    selectOverlay(entityOrId: OverlayEntity | Entity | string): boolean;
    /**
     * 清空当前选中态。
     */
    clearSelection(): boolean;
    /**
     * 设置覆盖物是否允许参与 pointer / API 选中。
     */
    setOverlaySelectable(entityOrId: OverlayEntity | Entity | string, selectable: boolean): boolean;
    /**
     * 动态开启/关闭 pointer selection。
     */
    setSelectionEnabled(enabled: boolean): void;
    /**
     * 运行时更新覆盖物的拾取优先级。
     */
    setOverlayPickPriority(entityOrId: OverlayEntity | Entity | string, pickPriority: number): boolean;
    /**
     * 基于最近一次有效鼠标位置立即重算 hover。
     */
    refreshHover(): boolean;
    /**
     * 添加 Marker
     */
    addMarker(options: MarkerOptions): Marker;
    /**
     * 添加 Label
     */
    addLabel(options: LabelOptions): Label;
    /**
     * 添加 Icon
     */
    addIcon(options: IconOptions): Icon;
    /**
     * 添加 SVG
     */
    addSvg(options: SvgOptions): SVG;
    /**
     * 添加 InfoWindow
     */
    addInfoWindow(options: InfoWindowOptions): InfoWindow;
    /**
     * 添加 Polyline
     */
    addPolyline(options: PolylineOptions): Polyline;
    /**
     * 添加 Polygon
     */
    addPolygon(options: PolygonOptions): Polygon;
    /**
     * 添加 Rectangle
     */
    addRectangle(options: RectangleOptions): Rectangle;
    /**
     * 添加 Circle
     */
    addCircle(options: CircleOptions): Circle;
    /**
     * 添加 Ring
     */
    addRing(options: RingOptions): Ring;
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
     * 显式切换覆盖物高亮状态。
     */
    toggleOverlayHighlight(entityOrId: OverlayEntity | Entity | string, reason?: 'click' | 'hover'): boolean;
    /**
     * 显式设置覆盖物高亮状态。
     */
    setOverlayHighlight(entityOrId: OverlayEntity | Entity | string, enabled: boolean, reason?: 'click' | 'hover'): boolean;
    /**
     * 动态开启/关闭 hover 高亮处理器。
     * 兼容旧版 overlayService 的运行时切换行为。
     */
    setHoverEnabled(enabled: boolean): void;
    /**
     * 获取当前 hover 高亮开关状态。
     */
    isHoverEnabled(): boolean;
    setOverlayEditMode(enabled: boolean, overlayEditOptions?: Record<string, any>): void;
    getOverlayEditModeEnabled(): boolean;
    startOverlayEdit(entityOrId: OverlayEntity | Entity | string | number, overlayEditOptions?: Record<string, any>): boolean;
    stopOverlayEdit(): Entity | null;
    private resolveSelectionEntity;
    private commitSelection;
    private clearSelectionForOverlay;
    private emitSelectionChange;
    private invokeOverlayClickCallback;
    private handlePointerSelectionClick;
    private suspendCameraControls;
    private restoreCameraControls;
    private releaseEditDrag;
    private resolveEditableOverlay;
    private detectEditableKind;
    private resolveEditableControlPoints;
    private createEditHandles;
    private resolveHandleStyle;
    private resolveHandleColor;
    private resolvePickedEditHandle;
    private pickEditPosition;
    private applyDragForHandle;
    private syncEditHandles;
    private emitOverlayEditChange;
    private emitOverlayEditEnd;
    private applyPointPosition;
    private applyPolylinePositions;
    private applyPolygonPositions;
    private applyRectangleCoordinates;
    private applyCircle;
    private getEntityPosition;
    private getPolylinePositions;
    private getPolygonPositions;
    private getRectangleCoordinates;
    private getRectangleHeight;
    private resolveCircleRadius;
    private getCircleInfo;
    private calculateCircleRadiusMeters;
    private circleRadiusHandlePosition;
    private rectangleToPositions;
    private positionsToRectangle;
    private normalizePositiveInteger;
    private normalizeNonNegativeNumber;
    /**
     * 安装 Hover 处理器
     */
    private setupHoverHandler;
    /**
     * 安装点击处理器
     */
    private setupClickHandler;
    private bindOverlayEntities;
    private unbindOverlayEntities;
    private collectOverlayEntities;
    private pickOverlayEntity;
    private safeDrillPick;
    private resolvePickedOverlayRoot;
    private resolvePickedOverlayEntity;
    private resolveOverlayByPickId;
    private resolveOverlayEntity;
    private isOverlaySelectable;
    private isSelectionOwnedByEditTarget;
    private cancelPendingHoverFrame;
    private cloneWindowPosition;
    private getLatestHoverPosition;
    private clearHoverTargets;
    private updateHoverAtPosition;
    private getHighlightTargets;
    private setHighlightTargets;
    private setEntityHighlight;
    private isHighlightActive;
    private clearOverlayHighlightState;
    private normalizeHighlightOptions;
    private resolveHighlightColor;
    private applyEntityHighlight;
    private restoreEntityStyle;
    private captureEntityStyle;
    /**
     * 销毁服务
     */
    destroy(): void;
}
export {};
