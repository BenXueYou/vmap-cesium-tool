import * as Cesium from 'cesium';
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

/**
 * 覆盖物服务选项
 */
export interface OverlayServiceOptions {
  /** 是否启用 hover 处理器（默认 true） */
  enableHoverHandler?: boolean;
  /** 点击节流间隔（毫秒，默认 120） */
  clickPickMinIntervalMs?: number;
}

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
export class OverlayService {
  private viewer: Viewer;
  private overlays: Map<string, any> = new Map();
  private options: Required<OverlayServiceOptions>;
  private nextId = 1;

  // 各种覆盖物工厂实例
  private markerFactory: MarkerFactory;
  private labelFactory: LabelFactory;
  private iconFactory: IconFactory;
  private svgFactory: SVGFactory;
  private infoWindowFactory: InfoWindowFactory;
  private polylineFactory: PolylineFactory;
  private polygonFactory: PolygonFactory;
  private rectangleFactory: RectangleFactory;
  private circleFactory: CircleFactory;
  private ringFactory: RingFactory;

  constructor(viewer: Viewer, options: OverlayServiceOptions = {}) {
    this.viewer = viewer;
    this.options = {
      enableHoverHandler: options.enableHoverHandler ?? true,
      clickPickMinIntervalMs: options.clickPickMinIntervalMs ?? 120,
    };

    // 初始化各个工厂
    this.markerFactory = new MarkerFactory(viewer, this);
    this.labelFactory = new LabelFactory(viewer, this);
    this.iconFactory = new IconFactory(viewer, this);
    this.svgFactory = new SVGFactory(viewer, this);
    this.infoWindowFactory = new InfoWindowFactory(viewer, this);
    this.polylineFactory = new PolylineFactory(viewer, this);
    this.polygonFactory = new PolygonFactory(viewer, this);
    this.rectangleFactory = new RectangleFactory(viewer, this);
    this.circleFactory = new CircleFactory(viewer, this);
    this.ringFactory = new RingFactory(viewer, this);

    // 安装事件处理器
    if (this.options.enableHoverHandler) {
      this.setupHoverHandler();
    }
    this.setupClickHandler();
  }

  /**
   * 生成唯一 ID
   */
  generateId(prefix: string = 'overlay'): string {
    return `${prefix}_${this.nextId++}_${Date.now()}`;
  }

  /**
   * 注册覆盖物
   */
  registerOverlay(id: string, overlay: any): void {
    this.overlays.set(id, overlay);
  }

  /**
   * 注销覆盖物
   */
  unregisterOverlay(id: string): void {
    this.overlays.delete(id);
  }

  /**
   * 根据 ID 获取覆盖物
   */
  getOverlay(id: string): any {
    return this.overlays.get(id);
  }

  /**
   * 获取所有覆盖物 ID
   */
  getAllOverlayIds(): string[] {
    return Array.from(this.overlays.keys());
  }

  /**
   * 添加 Marker
   */
  addMarker(options: MarkerOptions): Marker {
    return this.markerFactory.create(options);
  }

  /**
   * 添加 Label
   */
  addLabel(options: LabelOptions): Label {
    return this.labelFactory.create(options);
  }

  /**
   * 添加 Icon
   */
  addIcon(options: IconOptions): Icon {
    return this.iconFactory.create(options);
  }

  /**
   * 添加 SVG
   */
  addSvg(options: SvgOptions): SVG {
    return this.svgFactory.create(options);
  }

  /**
   * 添加 InfoWindow
   */
  addInfoWindow(options: InfoWindowOptions): InfoWindow {
    return this.infoWindowFactory.create(options);
  }

  /**
   * 添加 Polyline
   */
  addPolyline(options: PolylineOptions): Polyline {
    return this.polylineFactory.create(options);
  }

  /**
   * 添加 Polygon
   */
  addPolygon(options: PolygonOptions): Polygon {
    return this.polygonFactory.create(options);
  }

  /**
   * 添加 Rectangle
   */
  addRectangle(options: RectangleOptions): Rectangle {
    return this.rectangleFactory.create(options);
  }

  /**
   * 添加 Circle
   */
  addCircle(options: CircleOptions): Circle {
    return this.circleFactory.create(options);
  }

  /**
   * 添加 Ring
   */
  addRing(options: RingOptions): Ring {
    return this.ringFactory.create(options);
  }

  /**
   * 根据 ID 删除覆盖物
   */
  removeOverlay(id: string): boolean {
    const overlay = this.overlays.get(id);
    if (!overlay) return false;
    
    overlay.remove();
    this.overlays.delete(id);
    return true;
  }

  /**
   * 删除所有覆盖物
   */
  removeAllOverlays(): void {
    const ids = this.getAllOverlayIds();
    ids.forEach(id => this.removeOverlay(id));
  }

  /**
   * 设置覆盖物可见性
   */
  setOverlayVisible(id: string, visible: boolean): boolean {
    const overlay = this.overlays.get(id);
    if (!overlay) return false;
    
    if (visible) {
      overlay.show();
    } else {
      overlay.hide();
    }
    return true;
  }

  /**
   * 安装 Hover 处理器
   */
  private setupHoverHandler(): void {
    // TODO: 实现 hover 高亮逻辑
    // 这部分逻辑可以从原 CesiumOverlayService 迁移过来
  }

  /**
   * 安装点击处理器
   */
  private setupClickHandler(): void {
    // TODO: 实现点击回调逻辑
    // 这部分逻辑可以从原 CesiumOverlayService 迁移过来
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.removeAllOverlays();
  }
}

// ==================== 工厂类定义 ====================

abstract class OverlayFactory<T, O> {
  protected viewer: Viewer;
  protected service: OverlayService;

  constructor(viewer: Viewer, service: OverlayService) {
    this.viewer = viewer;
    this.service = service;
  }

  abstract create(options: O): T;
}

class MarkerFactory extends OverlayFactory<Marker, MarkerOptions> {
  create(options: MarkerOptions): Marker {
    const opts = { ...options, id: options.id || this.service.generateId('marker') };
    const marker = new Marker(this.viewer, opts);
    this.viewer.entities.add(marker.getEntity());
    this.service.registerOverlay(opts.id!, marker);
    return marker;
  }
}

class LabelFactory extends OverlayFactory<Label, LabelOptions> {
  create(options: LabelOptions): Label {
    const opts = { ...options, id: options.id || this.service.generateId('label') };
    const label = new Label(this.viewer, opts);
    this.viewer.entities.add(label.getEntity());
    this.service.registerOverlay(opts.id!, label);
    return label;
  }
}

class IconFactory extends OverlayFactory<Icon, IconOptions> {
  create(options: IconOptions): Icon {
    const opts = { ...options, id: options.id || this.service.generateId('icon') };
    const icon = new Icon(this.viewer, opts);
    this.viewer.entities.add(icon.getEntity());
    this.service.registerOverlay(opts.id!, icon);
    return icon;
  }
}

class SVGFactory extends OverlayFactory<SVG, SvgOptions> {
  create(options: SvgOptions): SVG {
    const opts = { ...options, id: options.id || this.service.generateId('svg') };
    const svg = new SVG(this.viewer, opts);
    this.viewer.entities.add(svg.getEntity());
    this.service.registerOverlay(opts.id!, svg);
    return svg;
  }
}

class InfoWindowFactory extends OverlayFactory<InfoWindow, InfoWindowOptions> {
  create(options: InfoWindowOptions): InfoWindow {
    const opts = { ...options, id: options.id || this.service.generateId('infowindow') };
    const infoWindow = new InfoWindow(this.viewer, opts);
    this.service.registerOverlay(opts.id!, infoWindow);
    return infoWindow;
  }
}

class PolylineFactory extends OverlayFactory<Polyline, PolylineOptions> {
  create(options: PolylineOptions): Polyline {
    const opts = { ...options, id: options.id || this.service.generateId('polyline') };
    const polyline = new Polyline(this.viewer, opts);
    this.viewer.entities.add(polyline.getEntity());
    this.service.registerOverlay(opts.id!, polyline);
    return polyline;
  }
}

class PolygonFactory extends OverlayFactory<Polygon, PolygonOptions> {
  create(options: PolygonOptions): Polygon {
    const opts = { ...options, id: options.id || this.service.generateId('polygon') };
    const polygon = new Polygon(this.viewer, opts);
    this.viewer.entities.add(polygon.getEntity());
    this.service.registerOverlay(opts.id!, polygon);
    return polygon;
  }
}

class RectangleFactory extends OverlayFactory<Rectangle, RectangleOptions> {
  create(options: RectangleOptions): Rectangle {
    const opts = { ...options, id: options.id || this.service.generateId('rectangle') };
    const rectangle = new Rectangle(this.viewer, opts);
    this.viewer.entities.add(rectangle.getEntity());
    this.service.registerOverlay(opts.id!, rectangle);
    return rectangle;
  }
}

class CircleFactory extends OverlayFactory<Circle, CircleOptions> {
  create(options: CircleOptions): Circle {
    const opts = { ...options, id: options.id || this.service.generateId('circle') };
    const circle = new Circle(this.viewer, opts);
    this.viewer.entities.add(circle.getEntity());
    this.service.registerOverlay(opts.id!, circle);
    return circle;
  }
}

class RingFactory extends OverlayFactory<Ring, RingOptions> {
  create(options: RingOptions): Ring {
    const opts = { ...options, id: options.id || this.service.generateId('ring') };
    const ring = new Ring(this.viewer, opts);
    this.viewer.entities.add(ring.getEntity());
    this.service.registerOverlay(opts.id!, ring);
    return ring;
  }
}