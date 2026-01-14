import * as Cesium from "cesium";
import type { Viewer, Entity } from "cesium";
import type { DrawEntity } from './drawHelper';
import type { OverlayEntity } from './overlay/types';
import { MapMarker, type MarkerOptions } from './overlay/MapMarker';
import { MapLabel, type LabelOptions } from './overlay/MapLabel';
import { MapIcon, type IconOptions } from './overlay/MapIcon';
import { MapSVG, type SvgOptions } from './overlay/MapSVG';
import { MapInfoWindow, type InfoWindowOptions } from './overlay/MapInfoWindow';
import { MapPolyline, type PolylineOptions } from './overlay/MapPolyline';
import { MapPolygon, type PolygonOptions } from './overlay/MapPolygon';
import { MapRectangle, type RectangleOptions } from './overlay/MapRectangle';
import { MapCircle, type CircleOptions } from './overlay/MapCircle';
import { MapRing, type RingOptions } from './overlay/MapRing';
import type { OverlayPosition } from './overlay/types';

/**
 * Cesium 覆盖物服务类
 * 统一管理各种覆盖物工具类
 */
export class CesiumOverlayService {
  private viewer: Viewer;
  private entities: Cesium.EntityCollection;
  private overlayMap: Map<string, Entity> = new Map(); // 通过ID管理覆盖物
  private infoWindowContainer: HTMLElement | null = null;

  private static readonly DEFAULT_HIGHLIGHT_COLOR = Cesium.Color.YELLOW;
  private static readonly DEFAULT_HIGHLIGHT_FILL_ALPHA = 0.35;

  // 各种覆盖物工具类实例
  public readonly marker: MapMarker;
  public readonly label: MapLabel;
  public readonly icon: MapIcon;
  public readonly svg: MapSVG;
  public readonly infoWindow: MapInfoWindow;
  public readonly polyline: MapPolyline;
  public readonly polygon: MapPolygon;
  public readonly rectangle: MapRectangle;
  public readonly circle: MapCircle;
  public readonly ring: MapRing;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.entities = viewer.entities;
    this.initInfoWindowContainer();
    this.setupEntityClickHandler();

    // 初始化各种覆盖物工具类
    this.marker = new MapMarker(viewer);
    this.label = new MapLabel(viewer);
    this.icon = new MapIcon(viewer);
    this.svg = new MapSVG(viewer);
    this.infoWindow = new MapInfoWindow(viewer, this.infoWindowContainer!);
    this.polyline = new MapPolyline(viewer);
    this.polygon = new MapPolygon(viewer);
    this.rectangle = new MapRectangle(viewer);
    this.circle = new MapCircle(viewer);
    this.ring = new MapRing(viewer);
  }

  /**
   * 初始化信息窗口容器
   */
  private initInfoWindowContainer(): void {
    const container = this.viewer.container;
    this.infoWindowContainer = document.createElement('div');
    this.infoWindowContainer.id = 'cesium-info-window-container';
    this.infoWindowContainer.style.position = 'absolute';
    this.infoWindowContainer.style.left = '0';
    this.infoWindowContainer.style.top = '0';
    this.infoWindowContainer.style.width = '100%';
    this.infoWindowContainer.style.height = '100%';
    this.infoWindowContainer.style.pointerEvents = 'none';
    this.infoWindowContainer.style.zIndex = '1000';
    container.appendChild(this.infoWindowContainer);
  }

  /**
   * 设置实体点击处理器
   */
  private setupEntityClickHandler(): void {
    this.viewer.cesiumWidget.screenSpaceEventHandler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      // 绘制过程中禁用覆盖物 pick：避免与 DrawHelper 的绘制交互冲突，并减少 ground/worker 管线异常概率
      const anyViewer: any = this.viewer as any;
      if (anyViewer.__vmapDrawHelperIsDrawing) {
        return;
      }

      // 绘制刚结束的短窗口内也禁用 pick（避免“结束绘制的那次点击/双击”继续触发 overlay pick）
      const blockUntil = Number(anyViewer.__vmapDrawHelperBlockPickUntil) || 0;
      if (Date.now() < blockUntil) {
        return;
      }

      // 防御：偶发会收到非有限的屏幕坐标
      const anyPos: any = (click as any).position;
      if (!anyPos || !Number.isFinite(anyPos.x) || !Number.isFinite(anyPos.y)) {
        return;
      }

      const pickedObject = this.viewer.scene.pick(click.position);
      if (pickedObject && Cesium.defined(pickedObject.id) && pickedObject.id instanceof Cesium.Entity) {
        const entity = pickedObject.id as DrawEntity & OverlayEntity;
        // 如果是绘制模块创建的实体（带有 _drawType），交给绘制模块自己的点击处理器，避免重复触发
        if (entity._drawType !== undefined) {
          return;
        }

        // 覆盖物点击高亮（可按每个覆盖物选项开启/关闭）
        if (entity._clickHighlight) {
          this.toggleOverlayHighlight(entity);
        }

        const onClick = entity._onClick as ((entity: Entity) => void) | undefined;
        if (onClick) {
          onClick(entity);
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  private getPropertyValue<T>(prop: any, fallback: T): T {
    try {
      if (prop && typeof prop.getValue === 'function') {
        return prop.getValue(Cesium.JulianDate.now()) as T;
      }
      if (prop !== undefined) {
        return prop as T;
      }
      return fallback;
    } catch {
      return fallback;
    }
  }

  private getNumberProperty(prop: any, fallback: number): number {
    const v = this.getPropertyValue<any>(prop, fallback);
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  private resolveHighlightOptions(entity: OverlayEntity): { color: Cesium.Color; fillAlpha: number } {
    const raw = entity._clickHighlight;
    const fillAlphaRaw = (typeof raw === 'object' && raw) ? (raw as any).fillAlpha : undefined;
    const fillAlpha =
      typeof fillAlphaRaw === 'number'
        ? Cesium.Math.clamp(fillAlphaRaw, 0.0, 1.0)
        : CesiumOverlayService.DEFAULT_HIGHLIGHT_FILL_ALPHA;

    const colorRaw = (typeof raw === 'object' && raw) ? (raw as any).color : undefined;
    const resolveColor = (input?: Cesium.Color | string): Cesium.Color => {
      try {
        if (!input) return CesiumOverlayService.DEFAULT_HIGHLIGHT_COLOR;
        if (input instanceof Cesium.Color) return input;
        return Cesium.Color.fromCssColorString(String(input));
      } catch {
        return CesiumOverlayService.DEFAULT_HIGHLIGHT_COLOR;
      }
    };
    const color = resolveColor(colorRaw);
    return { color, fillAlpha };
  }

  private applyOverlayHighlightStyle(entity: OverlayEntity): void {
    if (entity._isHighlighted) return;
    if (!entity._highlightOriginalStyle) entity._highlightOriginalStyle = {};

    const { color: hl, fillAlpha } = this.resolveHighlightOptions(entity);

    // 点
    if (entity.point) {
      const p = entity.point;
      if (!entity._highlightOriginalStyle.point) {
        entity._highlightOriginalStyle.point = {
          pixelSize: p.pixelSize,
          color: p.color,
          outlineColor: p.outlineColor,
          outlineWidth: p.outlineWidth,
        };
      }
      const pixelSize = this.getNumberProperty(p.pixelSize, 10);
      const outlineWidth = this.getNumberProperty(p.outlineWidth, 2);
      p.pixelSize = new Cesium.ConstantProperty(pixelSize + 3);
      p.color = new Cesium.ConstantProperty(hl.withAlpha(0.9));
      p.outlineColor = new Cesium.ConstantProperty(hl);
      p.outlineWidth = new Cesium.ConstantProperty(Math.max(3, outlineWidth + 1));
    }

    // 文本
    if (entity.label) {
      const l = entity.label;
      if (!entity._highlightOriginalStyle.label) {
        entity._highlightOriginalStyle.label = {
          fillColor: l.fillColor,
          outlineColor: l.outlineColor,
          outlineWidth: l.outlineWidth,
          scale: l.scale,
        };
      }
      const scale = this.getNumberProperty(l.scale, 1);
      const outlineWidth = this.getNumberProperty(l.outlineWidth, 2);
      l.fillColor = new Cesium.ConstantProperty(hl);
      l.outlineColor = new Cesium.ConstantProperty(Cesium.Color.BLACK);
      l.outlineWidth = new Cesium.ConstantProperty(Math.max(2, outlineWidth));
      l.scale = new Cesium.ConstantProperty(scale * 1.08);
    }

    // Billboard（Icon/SVG）
    if (entity.billboard) {
      const b = entity.billboard;
      if (!entity._highlightOriginalStyle.billboard) {
        entity._highlightOriginalStyle.billboard = {
          scale: b.scale,
          color: b.color,
        };
      }
      const scale = this.getNumberProperty(b.scale, 1);
      b.scale = new Cesium.ConstantProperty(scale * 1.08);
      b.color = new Cesium.ConstantProperty(hl);
    }

    // 折线
    if (entity.polyline) {
      const pl = entity.polyline;
      if (!entity._highlightOriginalStyle.polyline) {
        entity._highlightOriginalStyle.polyline = {
          width: pl.width,
          material: pl.material,
        };
      }
      const width = this.getNumberProperty(pl.width, 2);
      pl.width = new Cesium.ConstantProperty(width + 2);

      // 尽量保留材质语义：
      // - ColorMaterialProperty：直接替换颜色
      // - PolylineGlowMaterialProperty：复制一份新的 glow 材质并替换颜色（不改原对象，方便还原）
      if (pl.material instanceof Cesium.ColorMaterialProperty) {
        pl.material = new Cesium.ColorMaterialProperty(hl);
      } else if (pl.material instanceof Cesium.PolylineGlowMaterialProperty) {
        const glowPower = (pl.material as any).glowPower;
        pl.material = new Cesium.PolylineGlowMaterialProperty({
          color: hl,
          glowPower: typeof glowPower === 'number' ? glowPower : 0.25,
        });
      }
    }

    // 面（Polygon）
    if (entity.polygon) {
      const pg = entity.polygon;
      if (!entity._highlightOriginalStyle.polygon) {
        entity._highlightOriginalStyle.polygon = {
          outline: (pg as any).outline,
          outlineColor: pg.outlineColor,
          outlineWidth: pg.outlineWidth,
          material: pg.material,
        };
      }
      const outlineWidth = this.getNumberProperty(pg.outlineWidth, 1);
      (pg as any).outline = new Cesium.ConstantProperty(true);
      pg.outlineColor = new Cesium.ConstantProperty(hl);
      pg.outlineWidth = new Cesium.ConstantProperty(Math.max(2, outlineWidth + 2));

      // NOTE: 贴地多边形的 outline 很可能不可见或宽度无效，因此用“改材质”保证高亮可见
      pg.material = new Cesium.ColorMaterialProperty(hl.withAlpha(fillAlpha));
    }

    // 矩形
    if (entity.rectangle) {
      const r = entity.rectangle;
      if (!entity._highlightOriginalStyle.rectangle) {
        entity._highlightOriginalStyle.rectangle = {
          outline: (r as any).outline,
          outlineColor: r.outlineColor,
          outlineWidth: r.outlineWidth,
          material: r.material,
        };
      }
      const outlineWidth = this.getNumberProperty(r.outlineWidth, 1);
      (r as any).outline = new Cesium.ConstantProperty(true);
      r.outlineColor = new Cesium.ConstantProperty(hl);
      r.outlineWidth = new Cesium.ConstantProperty(Math.max(2, outlineWidth + 2));

      // 同 polygon：用材质保证贴地高亮可见
      r.material = new Cesium.ColorMaterialProperty(hl.withAlpha(fillAlpha));
    }

    // 圆/椭圆
    if (entity.ellipse) {
      const el = entity.ellipse;
      if (!entity._highlightOriginalStyle.ellipse) {
        entity._highlightOriginalStyle.ellipse = {
          outline: (el as any).outline,
          outlineColor: el.outlineColor,
          outlineWidth: el.outlineWidth,
          material: el.material,
        };
      }
      const outlineWidth = this.getNumberProperty(el.outlineWidth, 1);
      (el as any).outline = new Cesium.ConstantProperty(true);
      el.outlineColor = new Cesium.ConstantProperty(hl);
      el.outlineWidth = new Cesium.ConstantProperty(Math.max(2, outlineWidth + 2));

      // NOTE: 贴地 ellipse 的 outline 也可能不可见，因此改材质兜底
      el.material = new Cesium.ColorMaterialProperty(hl.withAlpha(fillAlpha));
    }

    entity._isHighlighted = true;
  }

  private restoreOverlayHighlightStyle(entity: OverlayEntity): void {
    if (!entity._isHighlighted) return;
    const orig = entity._highlightOriginalStyle;
    if (!orig) {
      entity._isHighlighted = false;
      return;
    }

    if (entity.point && orig.point) {
      const p = entity.point;
      p.pixelSize = orig.point.pixelSize;
      p.color = orig.point.color;
      p.outlineColor = orig.point.outlineColor;
      p.outlineWidth = orig.point.outlineWidth;
    }

    if (entity.label && orig.label) {
      const l = entity.label;
      l.fillColor = orig.label.fillColor;
      l.outlineColor = orig.label.outlineColor;
      l.outlineWidth = orig.label.outlineWidth;
      l.scale = orig.label.scale;
    }

    if (entity.billboard && orig.billboard) {
      const b = entity.billboard;
      b.scale = orig.billboard.scale;
      b.color = orig.billboard.color;
    }

    if (entity.polyline && orig.polyline) {
      const pl = entity.polyline;
      pl.width = orig.polyline.width;
      pl.material = orig.polyline.material;
    }

    if (entity.polygon && orig.polygon) {
      const pg = entity.polygon;
      (pg as any).outline = orig.polygon.outline;
      pg.outlineColor = orig.polygon.outlineColor;
      pg.outlineWidth = orig.polygon.outlineWidth;
      pg.material = orig.polygon.material;
    }

    if (entity.rectangle && orig.rectangle) {
      const r = entity.rectangle;
      (r as any).outline = orig.rectangle.outline;
      r.outlineColor = orig.rectangle.outlineColor;
      r.outlineWidth = orig.rectangle.outlineWidth;
      r.material = orig.rectangle.material;
    }

    if (entity.ellipse && orig.ellipse) {
      const el = entity.ellipse;
      (el as any).outline = orig.ellipse.outline;
      el.outlineColor = orig.ellipse.outlineColor;
      el.outlineWidth = orig.ellipse.outlineWidth;
      el.material = orig.ellipse.material;
    }

    entity._isHighlighted = false;
  }

  /**
   * 生成唯一ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========== 便捷方法：直接调用工具类方法并管理ID ==========

  public toggleOverlayHighlight(entity: OverlayEntity): void {
    const targets = (entity._highlightEntities && entity._highlightEntities.length > 0)
      ? entity._highlightEntities
      : [entity];
    const shouldHighlight = !targets.some((e) => (e as OverlayEntity)._isHighlighted);

    for (const e of targets) {
      const oe = e as OverlayEntity;
      if (shouldHighlight) {
        this.applyOverlayHighlightStyle(oe);
      } else {
        this.restoreOverlayHighlightStyle(oe);
      }
    }
  }

  /**
   * 添加 Marker
   */
  public addMarker(options: MarkerOptions): Entity {
    const id = options.id || this.generateId('marker');
    const entity = this.marker.add({ ...options, id });
    this.overlayMap.set(id, entity);
    return entity;
  }

  /**
   * 添加 Label
   */
  public addLabel(options: LabelOptions): Entity {
    const id = options.id || this.generateId('label');
    const entity = this.label.add({ ...options, id });
    this.overlayMap.set(id, entity);
    return entity;
  }

  /**
   * 添加 Icon
   */
  public addIcon(options: IconOptions): Entity {
    const id = options.id || this.generateId('icon');
    const entity = this.icon.add({ ...options, id });
    this.overlayMap.set(id, entity);
    return entity;
  }

  /**
   * 添加 SVG
   */
  public addSvg(options: SvgOptions): Entity {
    const id = options.id || this.generateId('svg');
    const entity = this.svg.add({ ...options, id });
    this.overlayMap.set(id, entity);
    return entity;
  }

  /**
   * 添加 InfoWindow
   */
  public addInfoWindow(options: InfoWindowOptions): Entity {
    const id = options.id || this.generateId('infowindow');
    const entity = this.infoWindow.add({ ...options, id });
    this.overlayMap.set(id, entity);
    return entity;
  }

  /**
   * 添加 Polyline
   */
  public addPolyline(options: PolylineOptions): Entity {
    const id = options.id || this.generateId('polyline');
    const entity = this.polyline.add({ ...options, id });
    this.overlayMap.set(id, entity);
    return entity;
  }

  /**
   * 添加 Polygon
   */
  public addPolygon(options: PolygonOptions): Entity {
    const id = options.id || this.generateId('polygon');
    const entity = this.polygon.add({ ...options, id });
    this.overlayMap.set(id, entity);
    return entity;
  }

  /**
   * 添加 Rectangle
   */
  public addRectangle(options: RectangleOptions): Entity {
    const id = options.id || this.generateId('rectangle');
    const entity = this.rectangle.add({ ...options, id });
    this.overlayMap.set(id, entity);
    return entity;
  }

  /**
   * 添加 Circle
   */
  public addCircle(options: CircleOptions): Entity {
    const id = options.id || this.generateId('circle');
    const entity = this.circle.add({ ...options, id });
    this.overlayMap.set(id, entity);
    return entity;
  }

  /**
   * 添加 Ring
   */
  public addRing(options: RingOptions): Entity {
    const id = options.id || this.generateId('ring');
    const entity = this.ring.add({ ...options, id });
    this.overlayMap.set(id, entity);
    return entity;
  }

  // ========== 管理方法 ==========

  /**
   * 根据ID获取覆盖物
   */
  public getOverlay(id: string): Entity | undefined {
    return this.overlayMap.get(id);
  }

  /**
   * 根据ID删除覆盖物
   */
  public removeOverlay(id: string): boolean {
    const entity = this.overlayMap.get(id);
    if (entity) {
      // 如果是信息窗口，移除DOM元素
      const overlay = entity as OverlayEntity;
      const infoWindow = overlay._infoWindow;
      if (infoWindow) {
        this.infoWindow.remove(entity);
      }

      // 复合覆盖物：同时移除关联实体（如圆环的内层线、图形边框等）
      if (overlay._innerEntity) {
        this.entities.remove(overlay._innerEntity);
        overlay._innerEntity = undefined;
      }
      if (overlay._borderEntity) {
        this.entities.remove(overlay._borderEntity);
        overlay._borderEntity = undefined;
      }

      this.entities.remove(entity);
      this.overlayMap.delete(id);
      return true;
    }
    return false;
  }

  /**
   * 删除所有覆盖物
   */
  public removeAllOverlays(): void {
    const ids = Array.from(this.overlayMap.keys());
    ids.forEach(id => this.removeOverlay(id));
  }

  /**
   * 更新覆盖物位置
   */
  public updateOverlayPosition(id: string, position: OverlayPosition): boolean {
    const entity = this.overlayMap.get(id);
    if (!entity) return false;

    const overlay = entity as OverlayEntity;

    // 根据实体类型调用对应的更新方法
    if (entity.point && !overlay._infoWindow) {
      // Marker
      this.marker.updatePosition(entity, position);
    } else if (entity.label) {
      // Label
      this.label.updatePosition(entity, position);
    } else if (entity.billboard) {
      // Icon 或 SVG
      this.icon.updatePosition(entity, position);
    } else if (entity.polyline) {
      // Polyline：若为 Ring，允许更新中心；否则保持原行为
      if (overlay._overlayType === 'ring') {
        this.ring.updatePosition(entity, position);
      } else {
        // Polyline - 需要多个位置，这里只更新第一个位置（实际使用中可能需要重新设计）
        console.warn('Polyline position update requires multiple positions');
      }
    } else if (entity.polygon) {
      // Polygon - 需要多个位置，这里只更新第一个位置（实际使用中可能需要重新设计）
      console.warn('Polygon position update requires multiple positions');
    } else if (entity.ellipse) {
      // Circle
      this.circle.updatePosition(entity, position);
    }

    // 如果是信息窗口，更新位置
    if (overlay._infoWindow) {
      this.infoWindow.updatePosition(entity, position);
    }

    return true;
  }

  /**
   * 显示/隐藏覆盖物
   */
  public setOverlayVisible(id: string, visible: boolean): boolean {
    const entity = this.overlayMap.get(id);
    if (entity) {
      entity.show = visible;
      const overlay = entity as OverlayEntity;

      // 复合覆盖物：联动显示/隐藏关联实体
      if (overlay._innerEntity) {
        overlay._innerEntity.show = visible;
      }
      if (overlay._borderEntity) {
        overlay._borderEntity.show = visible;
      }

      // 如果是信息窗口，更新DOM显示
      if (overlay._infoWindow) {
        this.infoWindow.setVisible(entity, visible);
      }

      return true;
    }
    return false;
  }

  /**
   * 获取所有覆盖物ID
   */
  public getAllOverlayIds(): string[] {
    return Array.from(this.overlayMap.keys());
  }

  /**
   * 获取所有覆盖物
   */
  public getAllOverlays(): Entity[] {
    return Array.from(this.overlayMap.values());
  }

  /**
   * 销毁服务，清理所有资源
   */
  public destroy(): void {
    this.removeAllOverlays();
    if (this.infoWindowContainer && this.infoWindowContainer.parentNode) {
      this.infoWindowContainer.parentNode.removeChild(this.infoWindowContainer);
    }
    this.overlayMap.clear();
  }
}
