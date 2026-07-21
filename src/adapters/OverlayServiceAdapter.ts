import * as Cesium from 'cesium';
import type { Viewer, Entity } from 'cesium';
import { OverlayService, type OverlayServiceOptions } from '../core/services/overlay/OverlayService';
import { lngLatToCartesian } from '../core/mapProviders/coordinates/cesium';
import type {
  MarkerOptions,
  LabelOptions,
  IconOptions,
  SvgOptions,
  InfoWindowOptions,
  PolylineOptions,
  PolygonOptions,
  RectangleOptions,
  CircleOptions,
  RingOptions,
  OverlayEntity,
  OverlayPosition,
} from '../core/entities';

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
export class OverlayServiceAdapter {
  private viewer: Viewer;
  private overlayService: OverlayService;
  private hoverEnabled: boolean;
  private bulkUpdateDepth = 0;
  private overlayEditOptions: Record<string, any> | undefined;

  constructor(viewer: Viewer, options: LegacyCesiumOverlayServiceOptions = {}) {
    this.viewer = viewer;
    this.hoverEnabled = options.picking?.hover ?? options.enableHoverHandler ?? true;
    this.overlayEditOptions = options.overlayEditOptions;
    this.overlayService = new OverlayService(viewer, {
      enableHoverHandler: this.hoverEnabled,
      clickPickMinIntervalMs: options.clickPickMinIntervalMs,
      picking: options.picking,
      onOverlayEditChange: options.onOverlayEditChange as any,
      onOverlayEditEnd: options.onOverlayEditEnd as any,
    });
  }

  private resolveOverlayEntity(entityOrId: OverlayEntity | Entity | string | number): Entity | undefined {
    if (typeof entityOrId === 'string' || typeof entityOrId === 'number') {
      return this.getOverlay(String(entityOrId));
    }

    return entityOrId as Entity;
  }

  private applyHoverState(): void {
    const shouldEnable = this.hoverEnabled && !this.getOverlayEditModeEnabled() && this.bulkUpdateDepth === 0;
    this.overlayService.setHoverEnabled(shouldEnable);
  }

  // ==================== 公共 API（保持与旧版兼容） ====================

  /**
   * 添加 Marker
   */
  addMarker(options: MarkerOptions): Entity {
    const marker = this.overlayService.addMarker(options);
    return marker.getEntity();
  }

  /**
   * 添加 Label
   */
  addLabel(options: LabelOptions): Entity {
    const label = this.overlayService.addLabel(options);
    return label.getEntity();
  }

  /**
   * 添加 Icon
   */
  addIcon(options: IconOptions): Entity {
    const icon = this.overlayService.addIcon(options);
    return icon.getEntity();
  }

  /**
   * 添加 SVG
   */
  addSvg(options: SvgOptions): Entity {
    const svg = this.overlayService.addSvg(options);
    return svg.getEntity();
  }

  /**
   * 添加 InfoWindow
   */
  addInfoWindow(options: InfoWindowOptions): Entity {
    const infoWindow = this.overlayService.addInfoWindow(options);
    return infoWindow.getEntity();
  }

  /**
   * 添加 Polyline
   */
  addPolyline(options: PolylineOptions): Entity {
    const polyline = this.overlayService.addPolyline(options);
    return polyline.getEntity();
  }

  /**
   * 添加 Polygon
   */
  addPolygon(options: PolygonOptions): Entity {
    const polygon = this.overlayService.addPolygon(options);
    return polygon.getEntity();
  }

  /**
   * 添加 Rectangle
   */
  addRectangle(options: RectangleOptions): Entity {
    const rectangle = this.overlayService.addRectangle(options);
    return rectangle.getEntity();
  }

  /**
   * 添加 Circle
   */
  addCircle(options: CircleOptions): Entity {
    const circle = this.overlayService.addCircle(options);
    return circle.getEntity();
  }

  /**
   * 添加 Ring
   */
  addRing(options: RingOptions): Entity {
    const ring = this.overlayService.addRing(options);
    return ring.getEntity();
  }

  /**
   * 根据 ID 获取覆盖物
   */
  getOverlay(id: string): Entity | undefined {
    const overlay = this.overlayService.getOverlay(id);
    return overlay?.getEntity();
  }

  /**
   * 获取所有覆盖物实体。
   */
  getAllOverlays(): Entity[] {
    return this.getAllOverlayIds()
      .map((id) => this.getOverlay(id))
      .filter((entity): entity is Entity => !!entity);
  }

  /**
   * 根据 ID 删除覆盖物
   */
  removeOverlay(id: string): boolean {
    return this.overlayService.removeOverlay(id);
  }

  /**
   * 删除所有覆盖物
   */
  removeAllOverlays(): void {
    this.overlayService.removeAllOverlays();
  }

  /**
   * 设置覆盖物可见性
   */
  setOverlayVisible(id: string, visible: boolean): boolean {
    return this.overlayService.setOverlayVisible(id, visible);
  }

  /**
   * 更新覆盖物位置。
   * 兼容旧版的单点位置更新 API。
   */
  updateOverlayPosition(id: string, position: OverlayPosition): boolean {
    const overlay = this.overlayService.getOverlay(id);
    if (!overlay) {
      return false;
    }

    const overlayAny = overlay as any;
    if (typeof overlayAny.setPosition === 'function') {
      overlayAny.setPosition(position);
      return true;
    }

    if (typeof overlayAny.setPositions === 'function') {
      overlayAny.setPositions(Array.isArray(position) ? [position] : [position]);
      return true;
    }

    const entity = overlay.getEntity?.();
    if (entity) {
      const cartesian = Array.isArray(position)
        ? lngLatToCartesian({
          longitude: position[0],
          latitude: position[1],
          height: position[2] ?? 0,
        })
        : position;
      entity.position = new Cesium.ConstantPositionProperty(cartesian);
      return true;
    }

    return false;
  }

  /**
   * 获取所有覆盖物 ID
   */
  getAllOverlayIds(): string[] {
    return this.overlayService.getAllOverlayIds();
  }

  getSelectedOverlay(): Entity | null {
    return this.overlayService.getSelectedOverlay() as Entity | null;
  }

  getSelectedOverlayId(): string | null {
    return this.overlayService.getSelectedOverlayId();
  }

  selectOverlay(entityOrId: OverlayEntity | Entity | string | number): boolean {
    const target = this.resolveOverlayEntity(entityOrId);
    if (!target) {
      return false;
    }

    return this.overlayService.selectOverlay(target);
  }

  clearSelection(): boolean {
    return this.overlayService.clearSelection();
  }

  onSelectionChange(listener: (event: any) => void): () => void {
    return this.overlayService.onSelectionChange(listener);
  }

  toggleOverlayHighlight(
    entityOrId: OverlayEntity | Entity | string | number,
    reason: 'click' | 'hover' = 'click'
  ): boolean {
    const target = this.resolveOverlayEntity(entityOrId);
    if (!target) {
      return false;
    }

    return this.overlayService.toggleOverlayHighlight(target, reason);
  }

  setOverlayHighlight(
    entityOrId: OverlayEntity | Entity | string | number,
    enabled: boolean,
    reason: 'click' | 'hover' = 'click'
  ): boolean {
    const target = this.resolveOverlayEntity(entityOrId);
    if (!target) {
      return false;
    }

    return this.overlayService.setOverlayHighlight(target, enabled, reason);
  }

  /**
   * 显式开启/关闭 hover 高亮处理。
   */
  toggleOverlayHoverHighlight(enabled: boolean): void {
    this.hoverEnabled = !!enabled;
    this.applyHoverState();
  }

  /**
   * 开启/关闭覆盖物编辑模式。
   * compat 层直接转发到底层 OverlayService。
   */
  setOverlayEditMode(enabled: boolean, overlayEditOptions?: Record<string, any>): void {
    if (overlayEditOptions) {
      this.overlayEditOptions = {
        ...(this.overlayEditOptions || {}),
        ...overlayEditOptions,
      };
    }
    this.overlayService.setOverlayEditMode(enabled, this.overlayEditOptions);
    this.applyHoverState();
  }

  /**
   * 获取当前编辑模式开关。
   */
  getOverlayEditModeEnabled(): boolean {
    return this.overlayService.getOverlayEditModeEnabled();
  }

  /**
   * 停止当前编辑目标，但不强制关闭全局编辑开关。
   */
  stopOverlayEdit(): void {
    this.overlayService.stopOverlayEdit();
    this.applyHoverState();
  }

  /**
   * 主动开始编辑某个覆盖物。
   * compat 层会切换到编辑状态并抑制 hover，但不会真正渲染编辑控制点。
   */
  startOverlayEdit(entityOrId: OverlayEntity | Entity | string | number, options?: Record<string, any>): boolean {
    const target = this.resolveOverlayEntity(entityOrId);
    if (!target) {
      return false;
    }

    if (options) {
      this.overlayEditOptions = {
        ...(this.overlayEditOptions || {}),
        ...options,
      };
    }

    this.overlayService.setOverlayEditMode(true, this.overlayEditOptions);
    const started = this.overlayService.startOverlayEdit(target, this.overlayEditOptions);
    this.applyHoverState();

    return started;
  }

  /**
   * 批量更新包裹器。
   */
  beginBulkUpdate(): void {
    this.bulkUpdateDepth++;
    this.applyHoverState();
  }

  /**
   * 结束一次批量更新。
   */
  endBulkUpdate(): void {
    this.bulkUpdateDepth = Math.max(0, this.bulkUpdateDepth - 1);
    this.applyHoverState();
  }

  /**
   * 批量更新包裹器（自动 begin/end）。
   */
  bulkUpdate<T>(fn: () => T): T {
    this.beginBulkUpdate();
    try {
      return fn();
    } finally {
      this.endBulkUpdate();
    }
  }

  getCoreService(): OverlayService {
    return this.overlayService;
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.overlayService.destroy();
  }
}

/**
 * 创建 OverlayServiceAdapter 的工厂函数
 */
export function createOverlayServiceAdapter(
  viewer: Viewer,
  options: LegacyCesiumOverlayServiceOptions = {}
): OverlayServiceAdapter {
  return new OverlayServiceAdapter(viewer, options);
}
