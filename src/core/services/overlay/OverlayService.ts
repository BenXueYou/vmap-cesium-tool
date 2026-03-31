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
import type { OverlayClickHighlightOptions, OverlayEntity } from '../../entities/BaseOverlay';

type OverlayInstance = Marker | Label | Icon | SVG | InfoWindow | Polyline | Polygon | Rectangle | Circle | Ring;

interface OverlayGraphicsSnapshot {
  point?: {
    color?: Cesium.Color;
    outlineColor?: Cesium.Color;
    pixelSize?: number;
  };
  label?: {
    fillColor?: Cesium.Color;
    outlineColor?: Cesium.Color;
    scale?: number;
  };
  billboard?: {
    color?: Cesium.Color;
    scale?: number;
  };
  polyline?: {
    width?: number;
    material?: any;
  };
  polygon?: {
    material?: any;
    outlineColor?: Cesium.Color;
  };
  rectangle?: {
    material?: any;
    outlineColor?: Cesium.Color;
  };
  ellipse?: {
    material?: any;
    outlineColor?: Cesium.Color;
  };
}

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
  private overlays: Map<string, OverlayInstance> = new Map();
  private entityOverlayMap: Map<Entity, OverlayInstance> = new Map();
  private options: Required<OverlayServiceOptions>;
  private nextId = 1;
  private clickHandler: Cesium.ScreenSpaceEventHandler | null = null;
  private hoverHandler: Cesium.ScreenSpaceEventHandler | null = null;
  private clickHighlightTargets: Entity[] = [];
  private hoverHighlightTargets: Entity[] = [];
  private lastClickPickAt = 0;
  private pendingHoverRaf: number | null = null;
  private pendingHoverPosition: Cesium.Cartesian2 | null = null;
  private readonly highlightCache = new WeakMap<Entity, OverlayGraphicsSnapshot>();

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
  registerOverlay(id: string, overlay: OverlayInstance): void {
    this.overlays.set(id, overlay);
    this.bindOverlayEntities(overlay);
  }

  /**
   * 注销覆盖物
   */
  unregisterOverlay(id: string): void {
    const overlay = this.overlays.get(id);
    if (overlay) {
      this.unbindOverlayEntities(overlay);
    }
    this.overlays.delete(id);
  }

  /**
   * 根据 ID 获取覆盖物
   */
  getOverlay(id: string): OverlayInstance | undefined {
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

    this.clearOverlayHighlightState(overlay);
    this.unbindOverlayEntities(overlay);
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

    if ('setVisible' in overlay && typeof overlay.setVisible === 'function') {
      overlay.setVisible(visible);
    } else if (visible && 'show' in overlay && typeof (overlay as InfoWindow).show === 'function') {
      (overlay as InfoWindow).show();
    } else if (!visible && 'hide' in overlay && typeof (overlay as InfoWindow).hide === 'function') {
      (overlay as InfoWindow).hide();
    }

    if (!visible) {
      this.clearOverlayHighlightState(overlay);
    }

    return true;
  }

  /**
   * 显式切换覆盖物高亮状态。
   */
  toggleOverlayHighlight(entityOrId: OverlayEntity | Entity | string, reason: 'click' | 'hover' = 'click'): boolean {
    const entity = this.resolveOverlayEntity(entityOrId);
    if (!entity) {
      return false;
    }

    return this.setOverlayHighlight(entity, !this.isHighlightActive(entity, reason), reason);
  }

  /**
   * 显式设置覆盖物高亮状态。
   */
  setOverlayHighlight(
    entityOrId: OverlayEntity | Entity | string,
    enabled: boolean,
    reason: 'click' | 'hover' = 'click',
  ): boolean {
    const entity = this.resolveOverlayEntity(entityOrId);
    if (!entity) {
      return false;
    }

    const targets = this.getHighlightTargets(entity, reason);
    const currentTargets = reason === 'click' ? this.clickHighlightTargets : this.hoverHighlightTargets;

    if (currentTargets.length > 0) {
      this.setHighlightTargets(currentTargets, reason, false);
    }

    if (reason === 'click') {
      this.clickHighlightTargets = enabled ? targets : [];
    } else {
      this.hoverHighlightTargets = enabled ? targets : [];
    }

    if (enabled) {
      this.setHighlightTargets(targets, reason, true);
    }

    return true;
  }

  /**
   * 安装 Hover 处理器
   */
  private setupHoverHandler(): void {
    this.hoverHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    const clearHover = (): void => {
      this.setHighlightTargets(this.hoverHighlightTargets, 'hover', false);
      this.hoverHighlightTargets = [];
    };

    this.hoverHandler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      if (!movement.endPosition) {
        clearHover();
        return;
      }

      this.pendingHoverPosition = movement.endPosition;
      if (this.pendingHoverRaf !== null) {
        return;
      }

      this.pendingHoverRaf = window.requestAnimationFrame(() => {
        this.pendingHoverRaf = null;

        const pickPosition = this.pendingHoverPosition;
        this.pendingHoverPosition = null;
        if (!pickPosition) {
          clearHover();
          return;
        }

        const overlayEntity = this.pickOverlayEntity(pickPosition, 'hover');
        if (!overlayEntity) {
          clearHover();
          return;
        }

        const targets = this.getHighlightTargets(overlayEntity, 'hover');
        const isSameTarget =
          targets.length === this.hoverHighlightTargets.length &&
          targets.every((target, index) => target === this.hoverHighlightTargets[index]);

        if (isSameTarget) {
          return;
        }

        clearHover();
        this.hoverHighlightTargets = targets;
        this.setHighlightTargets(targets, 'hover', true);
      });
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    this.viewer.scene.canvas.addEventListener('mouseleave', clearHover);
  }

  /**
   * 安装点击处理器
   */
  private setupClickHandler(): void {
    this.clickHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    this.clickHandler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const now = Date.now();
      if (now - this.lastClickPickAt < this.options.clickPickMinIntervalMs) {
        return;
      }

      this.lastClickPickAt = now;
      const overlayEntity = this.pickOverlayEntity(click.position, 'click');
      if (!overlayEntity) {
        this.setHighlightTargets(this.clickHighlightTargets, 'click', false);
        this.clickHighlightTargets = [];
        return;
      }

      const targets = this.getHighlightTargets(overlayEntity, 'click');
      const shouldEnable = !this.isHighlightActive(overlayEntity, 'click');

      if (this.clickHighlightTargets.length > 0) {
        this.setHighlightTargets(this.clickHighlightTargets, 'click', false);
      }

      this.clickHighlightTargets = shouldEnable ? targets : [];
      if (targets.length > 0) {
        this.setHighlightTargets(targets, 'click', shouldEnable);
      }

      overlayEntity._onClick?.(overlayEntity);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  private bindOverlayEntities(overlay: OverlayInstance): void {
    const rootEntity = overlay.getEntity() as OverlayEntity;
    const entities = this.collectOverlayEntities(rootEntity);
    entities.forEach((entity) => {
      this.entityOverlayMap.set(entity, overlay);
      (entity as OverlayEntity)._overlayId = rootEntity.id;
    });

    rootEntity._highlightEntities = entities;
  }

  private unbindOverlayEntities(overlay: OverlayInstance): void {
    const rootEntity = overlay.getEntity() as OverlayEntity;
    this.collectOverlayEntities(rootEntity).forEach((entity) => {
      this.entityOverlayMap.delete(entity);
    });
  }

  private collectOverlayEntities(rootEntity: OverlayEntity): Entity[] {
    const entities: Entity[] = [rootEntity];
    if (rootEntity._borderEntity) {
      entities.push(rootEntity._borderEntity);
    }
    if (rootEntity._innerEntity) {
      entities.push(rootEntity._innerEntity);
    }
    return entities;
  }

  private pickOverlayEntity(
    windowPosition: Cesium.Cartesian2,
    reason: 'click' | 'hover',
  ): OverlayEntity | null {
    const pickedObjects = this.safeDrillPick(windowPosition);
    for (const pickedObject of pickedObjects) {
      const entity = this.resolvePickedOverlayEntity(pickedObject);
      if (!entity || entity.show === false) {
        continue;
      }

      if (reason === 'hover' && !entity._hoverHighlight) {
        continue;
      }

      if (reason === 'click' && !entity._clickHighlight && !entity._onClick) {
        continue;
      }

      return entity;
    }

    return null;
  }

  private safeDrillPick(windowPosition: Cesium.Cartesian2): any[] {
    try {
      const picks = this.viewer.scene.drillPick(windowPosition);
      return Array.isArray(picks) ? picks : [];
    } catch {
      return [];
    }
  }

  private resolvePickedOverlayEntity(pickedObject: any): OverlayEntity | null {
    const candidate = pickedObject?.id instanceof Cesium.Entity
      ? pickedObject.id
      : pickedObject?.primitive instanceof Cesium.Entity
        ? pickedObject.primitive
        : null;

    if (!candidate) {
      return null;
    }

    const overlay = this.entityOverlayMap.get(candidate);
    if (!overlay) {
      return null;
    }

    return overlay.getEntity() as OverlayEntity;
  }

  private resolveOverlayEntity(entityOrId: OverlayEntity | Entity | string): OverlayEntity | null {
    if (typeof entityOrId === 'string') {
      return this.getOverlay(entityOrId)?.getEntity() as OverlayEntity | null;
    }

    return entityOrId as OverlayEntity;
  }

  private getHighlightTargets(entity: OverlayEntity, reason: 'click' | 'hover'): Entity[] {
    const targets = entity._highlightEntities?.length ? entity._highlightEntities : [entity];
    if (reason === 'hover') {
      return targets.filter((target) => !!(target as OverlayEntity)._hoverHighlight || target === entity);
    }

    return targets;
  }

  private setHighlightTargets(targets: Entity[], reason: 'click' | 'hover', enabled: boolean): void {
    targets.forEach((target) => {
      this.setEntityHighlight(target as OverlayEntity, reason, enabled);
    });
  }

  private setEntityHighlight(entity: OverlayEntity, reason: 'click' | 'hover', enabled: boolean): void {
    const highlightConfig = (reason === 'click' ? entity._clickHighlight : entity._hoverHighlight) || true;
    const state = entity._highlightState || {};
    state[reason] = enabled;
    entity._highlightState = state;

    const shouldRemainHighlighted = !!state.click || !!state.hover;
    if (!shouldRemainHighlighted) {
      this.restoreEntityStyle(entity);
      entity._isHighlighted = false;
      return;
    }

    this.applyEntityHighlight(entity, this.normalizeHighlightOptions(highlightConfig, reason));
    entity._isHighlighted = true;
  }

  private isHighlightActive(entity: OverlayEntity, reason: 'click' | 'hover'): boolean {
    return !!entity._highlightState?.[reason];
  }

  private clearOverlayHighlightState(overlay: OverlayInstance): void {
    this.collectOverlayEntities(overlay.getEntity() as OverlayEntity).forEach((entity) => {
      this.restoreEntityStyle(entity as OverlayEntity);
      (entity as OverlayEntity)._highlightState = {};
      (entity as OverlayEntity)._isHighlighted = false;
    });
  }

  private normalizeHighlightOptions(
    options: boolean | OverlayClickHighlightOptions,
    reason: 'click' | 'hover',
  ): Required<OverlayClickHighlightOptions> {
    const defaultColor = reason === 'click'
      ? Cesium.Color.YELLOW
      : Cesium.Color.CYAN;

    if (options === true || options === false) {
      return {
        color: defaultColor,
        fillAlpha: reason === 'click' ? 0.35 : 0.22,
      };
    }

    return {
      color: options.color || defaultColor,
      fillAlpha: options.fillAlpha ?? (reason === 'click' ? 0.35 : 0.22),
    };
  }

  private resolveHighlightColor(color: Cesium.Color | string): Cesium.Color {
    if (color instanceof Cesium.Color) {
      return color;
    }

    const parsed = Cesium.Color.fromCssColorString(color);
    return parsed || Cesium.Color.YELLOW;
  }

  private applyEntityHighlight(entity: OverlayEntity, options: Required<OverlayClickHighlightOptions>): void {
    const highlightColor = this.resolveHighlightColor(options.color);
    const snapshot = this.captureEntityStyle(entity);

    if (entity.point) {
      entity.point.color = new Cesium.ConstantProperty(highlightColor.withAlpha(0.95));
      entity.point.outlineColor = new Cesium.ConstantProperty(highlightColor.brighten(0.2, new Cesium.Color()));
      const basePixelSize = snapshot.point?.pixelSize ?? 10;
      entity.point.pixelSize = new Cesium.ConstantProperty(basePixelSize + 2);
    }

    if (entity.label) {
      entity.label.fillColor = new Cesium.ConstantProperty(highlightColor);
      entity.label.outlineColor = new Cesium.ConstantProperty(Cesium.Color.WHITE);
      entity.label.scale = new Cesium.ConstantProperty((snapshot.label?.scale ?? 1) * 1.06);
    }

    if (entity.billboard) {
      entity.billboard.color = new Cesium.ConstantProperty(highlightColor);
      entity.billboard.scale = new Cesium.ConstantProperty((snapshot.billboard?.scale ?? 1) * 1.08);
    }

    if (entity.polyline) {
      entity.polyline.material = new Cesium.ColorMaterialProperty(highlightColor.withAlpha(0.95));
      entity.polyline.width = new Cesium.ConstantProperty((snapshot.polyline?.width ?? 2) + 1);
    }

    if (entity.polygon) {
      entity.polygon.material = new Cesium.ColorMaterialProperty(highlightColor.withAlpha(options.fillAlpha));
      entity.polygon.outlineColor = new Cesium.ConstantProperty(highlightColor);
    }

    if (entity.rectangle) {
      entity.rectangle.material = new Cesium.ColorMaterialProperty(highlightColor.withAlpha(options.fillAlpha));
      entity.rectangle.outlineColor = new Cesium.ConstantProperty(highlightColor);
    }

    if (entity.ellipse) {
      entity.ellipse.material = new Cesium.ColorMaterialProperty(highlightColor.withAlpha(options.fillAlpha));
      entity.ellipse.outlineColor = new Cesium.ConstantProperty(highlightColor);
    }
  }

  private restoreEntityStyle(entity: OverlayEntity): void {
    const snapshot = this.highlightCache.get(entity);
    if (!snapshot) {
      return;
    }

    if (entity.point) {
      if (snapshot.point?.color) {
        entity.point.color = new Cesium.ConstantProperty(snapshot.point.color);
      }
      if (snapshot.point?.outlineColor) {
        entity.point.outlineColor = new Cesium.ConstantProperty(snapshot.point.outlineColor);
      }
      if (snapshot.point?.pixelSize !== undefined) {
        entity.point.pixelSize = new Cesium.ConstantProperty(snapshot.point.pixelSize);
      }
    }

    if (entity.label) {
      if (snapshot.label?.fillColor) {
        entity.label.fillColor = new Cesium.ConstantProperty(snapshot.label.fillColor);
      }
      if (snapshot.label?.outlineColor) {
        entity.label.outlineColor = new Cesium.ConstantProperty(snapshot.label.outlineColor);
      }
      if (snapshot.label?.scale !== undefined) {
        entity.label.scale = new Cesium.ConstantProperty(snapshot.label.scale);
      }
    }

    if (entity.billboard) {
      if (snapshot.billboard?.color) {
        entity.billboard.color = new Cesium.ConstantProperty(snapshot.billboard.color);
      }
      if (snapshot.billboard?.scale !== undefined) {
        entity.billboard.scale = new Cesium.ConstantProperty(snapshot.billboard.scale);
      }
    }

    if (entity.polyline) {
      if (snapshot.polyline?.material !== undefined) {
        entity.polyline.material = snapshot.polyline.material;
      }
      if (snapshot.polyline?.width !== undefined) {
        entity.polyline.width = new Cesium.ConstantProperty(snapshot.polyline.width);
      }
    }

    if (entity.polygon) {
      if (snapshot.polygon?.material !== undefined) {
        entity.polygon.material = snapshot.polygon.material;
      }
      if (snapshot.polygon?.outlineColor) {
        entity.polygon.outlineColor = new Cesium.ConstantProperty(snapshot.polygon.outlineColor);
      }
    }

    if (entity.rectangle) {
      if (snapshot.rectangle?.material !== undefined) {
        entity.rectangle.material = snapshot.rectangle.material;
      }
      if (snapshot.rectangle?.outlineColor) {
        entity.rectangle.outlineColor = new Cesium.ConstantProperty(snapshot.rectangle.outlineColor);
      }
    }

    if (entity.ellipse) {
      if (snapshot.ellipse?.material !== undefined) {
        entity.ellipse.material = snapshot.ellipse.material;
      }
      if (snapshot.ellipse?.outlineColor) {
        entity.ellipse.outlineColor = new Cesium.ConstantProperty(snapshot.ellipse.outlineColor);
      }
    }
  }

  private captureEntityStyle(entity: OverlayEntity): OverlayGraphicsSnapshot {
    const existing = this.highlightCache.get(entity);
    if (existing) {
      return existing;
    }

    const now = Cesium.JulianDate.now();
    const snapshot: OverlayGraphicsSnapshot = {};

    if (entity.point) {
      snapshot.point = {
        color: entity.point.color?.getValue(now),
        outlineColor: entity.point.outlineColor?.getValue(now),
        pixelSize: entity.point.pixelSize?.getValue(now),
      };
    }

    if (entity.label) {
      snapshot.label = {
        fillColor: entity.label.fillColor?.getValue(now),
        outlineColor: entity.label.outlineColor?.getValue(now),
        scale: entity.label.scale?.getValue(now),
      };
    }

    if (entity.billboard) {
      snapshot.billboard = {
        color: entity.billboard.color?.getValue(now),
        scale: entity.billboard.scale?.getValue(now),
      };
    }

    if (entity.polyline) {
      snapshot.polyline = {
        width: entity.polyline.width?.getValue(now),
        material: entity.polyline.material,
      };
    }

    if (entity.polygon) {
      snapshot.polygon = {
        material: entity.polygon.material,
        outlineColor: entity.polygon.outlineColor?.getValue(now),
      };
    }

    if (entity.rectangle) {
      snapshot.rectangle = {
        material: entity.rectangle.material,
        outlineColor: entity.rectangle.outlineColor?.getValue(now),
      };
    }

    if (entity.ellipse) {
      snapshot.ellipse = {
        material: entity.ellipse.material,
        outlineColor: entity.ellipse.outlineColor?.getValue(now),
      };
    }

    this.highlightCache.set(entity, snapshot);
    return snapshot;
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.setHighlightTargets(this.clickHighlightTargets, 'click', false);
    this.setHighlightTargets(this.hoverHighlightTargets, 'hover', false);
    this.clickHighlightTargets = [];
    this.hoverHighlightTargets = [];

    if (this.pendingHoverRaf !== null) {
      window.cancelAnimationFrame(this.pendingHoverRaf);
      this.pendingHoverRaf = null;
    }

    this.clickHandler?.destroy();
    this.clickHandler = null;
    this.hoverHandler?.destroy();
    this.hoverHandler = null;
    this.entityOverlayMap.clear();
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