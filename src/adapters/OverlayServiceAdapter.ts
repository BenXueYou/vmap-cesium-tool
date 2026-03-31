import * as Cesium from 'cesium';
import type { Viewer, Entity } from 'cesium';
import { OverlayService, type OverlayServiceOptions } from '../core/services/overlay/OverlayService';
import type { MarkerOptions, LabelOptions, IconOptions, SvgOptions, InfoWindowOptions, PolylineOptions, PolygonOptions, RectangleOptions, CircleOptions, RingOptions, OverlayEntity } from '../core/entities';

/**
 * 旧版覆盖物服务选项（保持向后兼容）
 */
export interface LegacyCesiumOverlayServiceOptions extends OverlayServiceOptions {
  /** 是否启用 hover 处理器 */
  enableHoverHandler?: boolean;
  /** 点击节流间隔 */
  clickPickMinIntervalMs?: number;
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

  constructor(viewer: Viewer, options: LegacyCesiumOverlayServiceOptions = {}) {
    this.viewer = viewer;
    this.overlayService = new OverlayService(viewer, {
      enableHoverHandler: options.enableHoverHandler,
      clickPickMinIntervalMs: options.clickPickMinIntervalMs,
    });
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
   * 获取所有覆盖物 ID
   */
  getAllOverlayIds(): string[] {
    return this.overlayService.getAllOverlayIds();
  }

  toggleOverlayHighlight(entityOrId: OverlayEntity | Entity | string, reason: 'click' | 'hover' = 'click'): boolean {
    return this.overlayService.toggleOverlayHighlight(entityOrId, reason);
  }

  setOverlayHighlight(
    entityOrId: OverlayEntity | Entity | string,
    enabled: boolean,
    reason: 'click' | 'hover' = 'click'
  ): boolean {
    return this.overlayService.setOverlayHighlight(entityOrId, enabled, reason);
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