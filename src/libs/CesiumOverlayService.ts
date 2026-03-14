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
import { OverlayEditController } from './overlay/OverlayEditController';
import { OverlayHighlight } from './overlay/OverlayHighlight';

export interface CesiumOverlayServiceOptions {
  /**
   * 是否启用实体 hover 处理器（MOUSE_MOVE 下会执行 pick/drillPick 并触发 hover 高亮）。
   * 大屏/高负载场景可考虑关闭以规避 Cesium 在 primitive 重建窗口期的边界问题。
   * @default true
   */
  enableHoverHandler?: boolean;

  /**
   * 覆盖物处于编辑模式时：一次拖拽结束（LEFT_UP）且几何发生变化会触发。
   * 参数为“已回写后的覆盖物 entity”。
   */
  onOverlayEditChange?: (entity: DrawEntity & OverlayEntity) => void;

  /**
   * 点击 pick 节流间隔（毫秒）。
   * 用于降低 “贴地几何 + pick + ground pipeline” 的偶发 DataCloneError 风险。
   * @default 120
   */
  clickPickMinIntervalMs?: number;
}

/**
 * Cesium 覆盖物服务类
 * 统一管理各种覆盖物工具类
 */
export class CesiumOverlayService {
  private viewer: Viewer;
  private entities: Cesium.EntityCollection;
  private overlayMap: Map<string, Entity> = new Map(); // 通过ID管理覆盖物
  private infoWindowContainer: HTMLElement | null = null;

  /** 构造参数（用于开关 hover handler 等运行时策略） */
  private readonly options: CesiumOverlayServiceOptions;

  // 覆盖物编辑模式（已拆分为独立 controller）
  private overlayEditor: OverlayEditController;
  private overlayHighlight: OverlayHighlight;

  private lastHoverTargets: Entity[] | null = null;
  private hoverPickRAF: number | null = null;
  private hoverPickPos: Cesium.Cartesian2 | null = null;

  // hover pick 的负载控制：在“批量增删覆盖物 / ground primitive 异步重建”窗口期内，减少 pick 频率以避免触发 Cesium worker/update 的边界问题
  private overlayMutationRevision = 0;
  private hoverSuspendUntil = 0;
  private lastHoverPickTime = 0;
  private lastHoverPickPos: Cesium.Cartesian2 | null = null;

  private bulkUpdateDepth = 0;

  private lastClickPickTime = 0;
  private readonly clickPickMinIntervalMs: number;

  // 鼠标 hover 时最多每隔一段时间 pick 一次（降低 pick pass 对 primitive.update 的压力）
  private static readonly HOVER_PICK_MIN_INTERVAL_MS = 66; // ~15fps
  // 鼠标在很小范围抖动时不做 pick
  private static readonly HOVER_PICK_MIN_MOVE_PX = 2;
  // 每次覆盖物发生结构性变更（add/remove）后，暂停 hover pick 一小段时间
  private static readonly HOVER_SUSPEND_AFTER_MUTATION_MS = 180;

  // 点击 pick 的最小间隔（默认 120ms）
  private static readonly CLICK_PICK_MIN_INTERVAL_MS = 120;

  private markOverlayMutated(): void {
    this.overlayMutationRevision++;
    // 批量增删时会连续调用多次：这里始终把暂停窗口往后推
    this.hoverSuspendUntil = Date.now() + CesiumOverlayService.HOVER_SUSPEND_AFTER_MUTATION_MS;
  }

  /**
   * 显式开始一次批量更新：在 begin/end 期间暂停 hover pick。
   * 建议 websocket 批量 add/remove 覆盖物时包裹使用，降低 Cesium GroundPrimitive 异步重建窗口期的 pick/update 压力。
   */
  public beginBulkUpdate(): void {
    this.bulkUpdateDepth++;
    // 进入批量窗口：立即清理 hover 高亮，避免 hover 状态在批量变更时“粘住”
    if (this.lastHoverTargets && this.lastHoverTargets.length > 0) {
      try {
        this.overlayHighlight.setOverlayHighlightReason(this.lastHoverTargets, 'hover', false);
      } catch {
        // ignore
      }
    }
    this.lastHoverTargets = null;
    // 也暂停一小段时间，让 ground primitive 的异步任务先启动/稳定
    this.hoverSuspendUntil = Math.max(this.hoverSuspendUntil, Date.now() + CesiumOverlayService.HOVER_SUSPEND_AFTER_MUTATION_MS);
  }

  /**
   * 结束一次批量更新。
   */
  public endBulkUpdate(): void {
    this.bulkUpdateDepth = Math.max(0, this.bulkUpdateDepth - 1);
    if (this.bulkUpdateDepth === 0) {
      // 批量更新结束后的短窗口内仍暂停 pick，让异步构建收尾
      this.hoverSuspendUntil = Math.max(this.hoverSuspendUntil, Date.now() + CesiumOverlayService.HOVER_SUSPEND_AFTER_MUTATION_MS);
    }
  }

  /**
   * 批量更新包裹器（自动 begin/end）。
   */
  public bulkUpdate<T>(fn: () => T): T {
    this.beginBulkUpdate();
    try {
      return fn();
    } finally {
      this.endBulkUpdate();
    }
  }

  /**
   * Primitive 模式下，GeometryInstance.id 会是字符串（structured-cloneable），
   * 需要映射回 overlayMap 内的根覆盖物 id。
   */
  private normalizeOverlayPickId(raw: any): string | null {
    try {
      if (raw === null || raw === undefined) return null;
      if (typeof raw === 'string' || typeof raw === 'number') return String(raw);
      if (raw instanceof Cesium.Entity) return String((raw as any).id);

      // Cesium pick 结果有时把 entity 放在 { id: Entity } 或 { entity: Entity }
      const anyRaw: any = raw as any;
      if (anyRaw && anyRaw.id instanceof Cesium.Entity) return String((anyRaw.id as any).id);
      if (anyRaw && anyRaw.entity instanceof Cesium.Entity) return String((anyRaw.entity as any).id);
      if (anyRaw && (typeof anyRaw.id === 'string' || typeof anyRaw.id === 'number')) return String(anyRaw.id);
      return null;
    } catch {
      return null;
    }
  }

  private resolveOverlayByPickId(raw: any): (DrawEntity & OverlayEntity) | null {
    const id = this.normalizeOverlayPickId(raw);
    if (!id) return null;

    const direct = this.overlayMap.get(id);
    if (direct) return direct as DrawEntity & OverlayEntity;

    // primitive 子部件：__outer/__fill/__border -> 根 id
    const rootId = id.replace(/__(fill|border|outer)$/, '');
    if (rootId !== id) {
      const root = this.overlayMap.get(rootId);
      if (root) return root as DrawEntity & OverlayEntity;
    }

    return null;
  }

  private resolvePickedOverlayEntity(pickedObject: any): (DrawEntity & OverlayEntity) | null {
    if (!pickedObject) return null;

    // 1) 正常 entity pick：pickedObject.id === Entity
    try {
      if (Cesium.defined((pickedObject as any).id) && (pickedObject as any).id instanceof Cesium.Entity) {
        const pickedEntity = (pickedObject as any).id as Cesium.Entity;
        // 编辑控制点：不作为覆盖物处理
        if ((pickedEntity as any).__vmapOverlayEditHandle) {
          return null;
        }
        const mapped = this.overlayHighlight.mapGlowOutlineEntityToRoot(pickedEntity);
        return mapped || (pickedEntity as DrawEntity & OverlayEntity);
      }
    } catch {
      // ignore
    }

    // 2) primitive instance pick：pickedObject.id === string（GeometryInstance.id）
    if (Cesium.defined((pickedObject as any).id)) {
      const byId = this.resolveOverlayByPickId((pickedObject as any).id);
      if (byId) return byId;
    }

    // 3) 有时挂在 primitive 字段上
    if (Cesium.defined((pickedObject as any).primitive)) {
      const byPrim = this.resolveOverlayByPickId((pickedObject as any).primitive);
      if (byPrim) return byPrim;
    }

    return null;
  }

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

  constructor(viewer: Viewer, options: CesiumOverlayServiceOptions = {}) {
    this.viewer = viewer;
    this.options = options;
    this.entities = viewer.entities;
    this.clickPickMinIntervalMs = Math.max(
      0,
      options.clickPickMinIntervalMs ?? CesiumOverlayService.CLICK_PICK_MIN_INTERVAL_MS
    );

    // 覆盖物编辑模式 controller（解耦编辑状态机/handler/控制点）
    this.overlayEditor = new OverlayEditController({
      getViewer: () => this.viewer,
      getEntities: () => this.entities,
      getOverlayById: (id: string) => this.overlayMap.get(id) as (DrawEntity & OverlayEntity) | undefined,
      pickCartographic: (pos: Cesium.Cartesian2) => this.pickCartographic(pos),
      prepareEntityForEdit: (entity: DrawEntity & OverlayEntity) => {
        try {
          const targets = (entity._highlightEntities && entity._highlightEntities.length > 0)
            ? entity._highlightEntities
            : [entity];
          this.overlayHighlight.setOverlayHighlightReason(targets, 'hover', false);
          this.overlayHighlight.setOverlayHighlightReason(targets, 'click', false);
          this.lastHoverTargets = null;
        } catch {
          // ignore
        }
      },
      applyPolygonPositions: (entity: DrawEntity & OverlayEntity, positions: Cesium.Cartesian3[]) => {
        this.polygon.updatePositions(entity, positions as any);
      },
      applyRectangleCoordinates: (entity: DrawEntity & OverlayEntity, rect: Cesium.Rectangle) => {
        this.rectangle.updateCoordinates(entity, rect);
      },
      applyCircle: (entity: DrawEntity & OverlayEntity, center: Cesium.Cartesian3, radiusMeters: number) => {
        // update center
        const carto = Cesium.Cartographic.fromCartesian(center);
        const pos: OverlayPosition = [Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude), 0];
        try {
          this.circle.updatePosition(entity, pos);
        } catch {
          // ignore
        }
        // update radius
        try {
          this.circle.updateRadius(entity, radiusMeters);
        } catch {
          // ignore
        }
      },
      applyPolylinePositions: (entity: DrawEntity & OverlayEntity, positions: Cesium.Cartesian3[]) => {
        try {
          this.polyline.updatePositions(entity, positions as any);
        } catch {
          // ignore
        }
      },
      applyPointPosition: (entity: DrawEntity & OverlayEntity, position: Cesium.Cartesian3) => {
        try {
          if (entity.point) {
            this.marker.updatePosition(entity, position as any);
            return;
          }
          if (entity.billboard) {
            this.icon.updatePosition(entity, position as any);
            return;
          }
          entity.position = new Cesium.ConstantPositionProperty(position);
        } catch {
          // ignore
        }
      },
    }, {
      onChange: options.onOverlayEditChange,
    });

    // this.enableTranslucentPicking();
    this.initInfoWindowContainer();

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

    this.overlayHighlight = new OverlayHighlight({
      getEntities: () => this.entities,
      getOverlayById: (id: string) => this.overlayMap.get(id) as (DrawEntity & OverlayEntity) | undefined,
      getPropertyValue: (prop, fallback) => this.getPropertyValue(prop, fallback),
      getNumberProperty: (prop, fallback) => this.getNumberProperty(prop, fallback),
      getCircle: () => this.circle,
      getPolygon: () => this.polygon,
      getRectangle: () => this.rectangle,
    });

    this.setupEntityClickHandler();

    // hover handler 在大屏/高负载场景可能带来高频 pick/drillPick 压力，可通过配置禁用
    if (this.options.enableHoverHandler !== false) {
      this.setupEntityHoverHandler();
    }
  }

  /**
   * Cesium 默认可能无法 pick 到半透明覆盖物（例如 alpha < 1 的填充面）。
   * 开启 pickTranslucentDepth 后，hover/click 才能稳定命中半透明面。
   */
  private enableTranslucentPicking(): void {
    try {
      const scene: any = this.viewer.scene as any;
      if (scene && 'pickTranslucentDepth' in scene) {
        scene.pickTranslucentDepth = true;
      }
    } catch {
      // ignore
    }
  }

  /**
   * 尝试从屏幕坐标拾取地表/模型位置并转为 Cartographic
   */
  private pickCartographic(windowPosition: Cesium.Cartesian2): Cesium.Cartographic | null {
    try {
      const scene = this.viewer.scene;
      let cartesian: Cesium.Cartesian3 | null = null;

      if ((scene as any).pickPositionSupported) {
        try {
          const picked = scene.pickPosition(windowPosition);
          if (picked && Number.isFinite((picked as any).x)) {
            cartesian = picked as Cesium.Cartesian3;
          }
        } catch {
          // ignore
        }
      }

      if (!cartesian) {
        cartesian = this.viewer.camera.pickEllipsoid(windowPosition, scene.globe.ellipsoid) as Cesium.Cartesian3 | null;
      }

      if (!cartesian) return null;
      return Cesium.Cartographic.fromCartesian(cartesian);
    } catch {
      return null;
    }
  }

  /**
   * 当 pick/drillPick 未命中时，使用经纬度判断是否落在 Rectangle 覆盖物内
   */
  private findHoverableRectangleByCartographic(carto: Cesium.Cartographic): (DrawEntity & OverlayEntity) | null {
    for (const entity of this.overlayMap.values()) {
      const e = entity as DrawEntity & OverlayEntity;
      if (e._drawType !== undefined) continue;
      if (e.show === false) continue;

      const hoverEnabled = !!(e._hoverHighlight || (e._highlightEntities && e._highlightEntities.some((h) => (h as OverlayEntity)._hoverHighlight)));
      if (!hoverEnabled) continue;

      let rect: Cesium.Rectangle | null = null;
      if (e.rectangle && (e.rectangle as any).coordinates !== undefined) {
        rect = this.getPropertyValue<Cesium.Rectangle | null>((e.rectangle as any).coordinates, null);
      }
      if (!rect && e._innerEntity && (e._innerEntity as any).rectangle && (e._innerEntity as any).rectangle.coordinates !== undefined) {
        rect = this.getPropertyValue<Cesium.Rectangle | null>((e._innerEntity as any).rectangle.coordinates, null);
      }

      if (rect && Cesium.Rectangle.contains(rect, carto)) {
        return e;
      }
    }
    return null;
  }

  /**
   * 判断点是否在多边形内（2D）
   */
  private isPointInPolygon2D(point: Cesium.Cartesian2, polygon: Cesium.Cartesian2[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi + 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private resolvePolygonPositions(entity: OverlayEntity): Cesium.Cartesian3[] | null {
    if (entity.polygon && (entity.polygon as any).hierarchy !== undefined) {
      const hierarchy = this.getPropertyValue<any>((entity.polygon as any).hierarchy, null);
      if (hierarchy && Array.isArray(hierarchy.positions)) {
        return hierarchy.positions as Cesium.Cartesian3[];
      }
    }
    return null;
  }

  private findHoverablePolygonByCartographic(carto: Cesium.Cartographic): (DrawEntity & OverlayEntity) | null {
    for (const entity of this.overlayMap.values()) {
      const e = entity as DrawEntity & OverlayEntity;
      if (e._drawType !== undefined) continue;
      if (e.show === false) continue;

      const hoverEnabled = !!(e._hoverHighlight || (e._highlightEntities && e._highlightEntities.some((h) => (h as OverlayEntity)._hoverHighlight)));
      if (!hoverEnabled) continue;

      const positions = this.resolvePolygonPositions(e) || (e._innerEntity ? this.resolvePolygonPositions(e._innerEntity as OverlayEntity) : null);
      if (!positions || positions.length < 3) continue;

      const plane = Cesium.EllipsoidTangentPlane.fromPoints(positions, this.viewer.scene.globe.ellipsoid);
      const point2 = plane.projectPointOntoPlane(Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0));
      if (!point2) continue;

      const poly2 = plane.projectPointsOntoPlane(positions);
      if (!poly2 || poly2.length < 3) continue;

      if (this.isPointInPolygon2D(point2, poly2)) {
        return e;
      }
    }
    return null;
  }

  private findHoverableCircleByCartographic(carto: Cesium.Cartographic): (DrawEntity & OverlayEntity) | null {
    for (const entity of this.overlayMap.values()) {
      const e = entity as DrawEntity & OverlayEntity;
      if (e._drawType !== undefined) continue;
      if (e.show === false) continue;

      const hoverEnabled = !!(e._hoverHighlight || (e._highlightEntities && e._highlightEntities.some((h) => (h as OverlayEntity)._hoverHighlight)));
      if (!hoverEnabled) continue;

      // entity 环形圆：使用中心+半径元数据
      if (e._isRing && e._outerRadius && e._centerCartographic) {
        const center = e._centerCartographic as Cesium.Cartographic;
        const d = Cesium.Cartesian3.distance(
          Cesium.Cartesian3.fromRadians(center.longitude, center.latitude, 0),
          Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0)
        );
        if (d <= e._outerRadius) return e;
      }

      // 非环形 ellipse：从 ellipse 取半径并计算距离
      if (e.ellipse && (e as any).position) {
        const semiMajor = this.getNumberProperty((e.ellipse as any).semiMajorAxis, 0);
        const semiMinor = this.getNumberProperty((e.ellipse as any).semiMinorAxis, 0);
        const radius = Math.max(0, Math.min(semiMajor, semiMinor));
        if (radius > 0) {
          const pos = this.getPropertyValue<Cesium.Cartesian3 | null>((e as any).position, null);
          if (pos) {
            const c = Cesium.Cartographic.fromCartesian(pos);
            const d = Cesium.Cartesian3.distance(
              Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, 0),
              Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0)
            );
            if (d <= radius) return e;
          }
        }
      }
    }
    return null;
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

      // 点击节流：减少 ground pipeline 在短时间内的多次 pick
      if (this.clickPickMinIntervalMs > 0) {
        const now = Date.now();
        if (now - this.lastClickPickTime < this.clickPickMinIntervalMs) {
          return;
        }
        this.lastClickPickTime = now;
      }

      const pickedObject = this.viewer.scene.pick(click.position);
      const entity = this.resolvePickedOverlayEntity(pickedObject);
      if (entity) {
        if (entity.show === false) {
          return;
        }
        // 如果是绘制模块创建的实体（带有 _drawType），交给绘制模块自己的点击处理器，避免重复触发
        if (entity._drawType !== undefined) {
          return;
        }

        // 覆盖物编辑模式：点击覆盖物进入编辑（优先于高亮/业务 onClick）
        if (this.overlayEditor.getEnabled()) {
          const started = this.overlayEditor.start(entity);
          if (started) {
            return;
          }
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

  /**
   * 开启或是关闭覆盖物的Hover高亮（鼠标移入高亮，移出取消）。
   * - 开启后：覆盖物会触发高亮，且高亮状态会在鼠标移出时取消。
   * - 关闭后：覆盖物不再触发 hover 高亮。
   */
  public toggleOverlayHoverHighlight(enabled: boolean): void {
    this.options.enableHoverHandler = enabled;
  }

  /**
   * 开启/关闭覆盖物编辑模式。
   * - 开启后：点击覆盖物会进入编辑，并显示可拖拽控制点。
   * - 关闭后：退出编辑并移除控制点。
   */
  public setOverlayEditMode(enabled: boolean): void {
    this.overlayEditor.setEnabled(enabled);
  }

  /** 当前是否处于覆盖物编辑模式（全局开关） */
  public getOverlayEditModeEnabled(): boolean {
    return this.overlayEditor.getEnabled();
  }

  /** 停止当前正在编辑的覆盖物（不会关闭全局编辑模式） */
  public stopOverlayEdit(): void {
    this.overlayEditor.stop();
  }

  /**
   * 主动开始编辑某个覆盖物。
   * @returns true 表示成功进入编辑
   */
  public startOverlayEdit(entityOrId: (DrawEntity & OverlayEntity) | string): boolean {
    return this.overlayEditor.start(entityOrId);
  }

  /**
   * 设置实体 hover 高亮处理器（鼠标移入高亮，移出取消）
   */
  private setupEntityHoverHandler(): void {
    const canvas = this.viewer.scene?.canvas;

    const clearHover = (): void => {
      if (this.lastHoverTargets && this.lastHoverTargets.length > 0) {
        this.overlayHighlight.setOverlayHighlightReason(this.lastHoverTargets, 'hover', false);
      }
      this.lastHoverTargets = null;
    };

    // 鼠标移出画布时，清除 hover 高亮
    if (canvas) {
      canvas.addEventListener('mouseleave', () => {
        clearHover();
      });
    }

    // 鼠标移动时 pick 覆盖物（用 RAF 合并高频事件）
    this.viewer.cesiumWidget.screenSpaceEventHandler.setInputAction(
      (movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
        // 配置项开关：禁用 hover 高亮
        if (this.options.enableHoverHandler === false) {
          clearHover();
          return;
        }
        const anyViewer: any = this.viewer as any;
        if (anyViewer.__vmapDrawHelperIsDrawing) {
          clearHover();
          return;
        }

        // 编辑覆盖物时，暂停 hover 高亮，避免与控制点交互冲突
        if (this.overlayEditor.isEditing()) {
          clearHover();
          return;
        }

        // 显式批量更新期间不做 hover pick
        if (this.bulkUpdateDepth > 0) {
          clearHover();
          return;
        }

        const blockUntil = Number(anyViewer.__vmapDrawHelperBlockPickUntil) || 0;
        if (Date.now() < blockUntil) {
          clearHover();
          return;
        }

        const pos: any = (movement as any).endPosition;
        if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
          clearHover();
          return;
        }

        // 覆盖物正处于批量更新/primitive 异步重建窗口期：暂停 hover pick，避免每帧 pick 放大 Cesium 的 worker/update 边界问题
        const now = Date.now();
        if (now < this.hoverSuspendUntil) {
          clearHover();
          return;
        }

        this.hoverPickPos = movement.endPosition;
        if (this.hoverPickRAF !== null) return;

        this.hoverPickRAF = window.requestAnimationFrame(() => {
          this.hoverPickRAF = null;
          const pickPos = this.hoverPickPos;
          if (!pickPos) {
            clearHover();
            return;
          }

          const t = Date.now();
          if (t - this.lastHoverPickTime < CesiumOverlayService.HOVER_PICK_MIN_INTERVAL_MS) {
            return;
          }
          if (this.lastHoverPickPos) {
            const dx = pickPos.x - this.lastHoverPickPos.x;
            const dy = pickPos.y - this.lastHoverPickPos.y;
            const min = CesiumOverlayService.HOVER_PICK_MIN_MOVE_PX;
            if ((dx * dx + dy * dy) < (min * min)) {
              return;
            }
          }
          this.lastHoverPickTime = t;
          this.lastHoverPickPos = new Cesium.Cartesian2(pickPos.x, pickPos.y);

          let pickedObject: any = null;
          try {
            pickedObject = this.viewer.scene.pick(pickPos);
          } catch {
            // pick pass 偶发会在 ground primitive 重建窗口期抛异常：避免异常向外冒泡导致渲染中断/黑屏
            clearHover();
            return;
          }
          let pickedEntity: (DrawEntity & OverlayEntity) | null = null;

          const asHoverableOverlayEntity = (id: any): (DrawEntity & OverlayEntity) | null => {
            // primitive GeometryInstance.id 可能是字符串，需要映射回 overlayMap 的根实体
            let entity: Cesium.Entity | null = null;
            if (id instanceof Cesium.Entity) {
              const mapped = this.overlayHighlight.mapGlowOutlineEntityToRoot(id);
              entity = mapped ? (mapped as unknown as Cesium.Entity) : id;
            } else {
              const mapped = this.resolveOverlayByPickId(id);
              if (mapped) entity = mapped as unknown as Cesium.Entity;
              else if (id && (id as any).id instanceof Cesium.Entity) {
                entity = (id as any).id as Cesium.Entity;
              } else if (id && (id as any).entity instanceof Cesium.Entity) {
                entity = (id as any).entity as Cesium.Entity;
              }
            }
            if (!entity) return null;
            const e = entity as DrawEntity & OverlayEntity;
            if ((e as any).__vmapOverlayEditHandle) return null;
            if (e._drawType !== undefined) return null;
            if (e.show === false) return null;
            // 只对启用 hoverHighlight 的覆盖物生效；否则允许继续 drillPick 找“下面那个”
            if (e._hoverHighlight) return e;

            // 兼容复合覆盖物：如果当前命中的子实体没有单独设置 hoverHighlight，
            // 但其联动组内有启用 hoverHighlight 的实体，则仍允许触发高亮（避免“填充区域闪烁”）
            const group = e._highlightEntities as (DrawEntity & OverlayEntity)[] | undefined;
            if (group && group.length > 0) {
              const candidate = group.find((g) => !!(g as OverlayEntity)._hoverHighlight);
              if (candidate && candidate.show !== false && (candidate as any)._drawType === undefined) {
                return candidate as DrawEntity & OverlayEntity;
              }
            }
            return null;
          };

          // Fast path: pick 命中 entity
          if (pickedObject) {
            if (Cesium.defined((pickedObject as any).id)) {
              pickedEntity = asHoverableOverlayEntity((pickedObject as any).id);
            }
            if (!pickedEntity && Cesium.defined((pickedObject as any).primitive)) {
              pickedEntity = asHoverableOverlayEntity((pickedObject as any).primitive);
            }
          }

          // Fallback: 当 pick 不是 hoverable overlay entity（例如命中地形/影像/其它 primitive，或命中未启用 hover 的 entity）时
          if (!pickedEntity) {
            try {
              const list = this.viewer.scene.drillPick(pickPos);
              if (Array.isArray(list)) {
                for (const obj of list) {
                  const e = asHoverableOverlayEntity((obj as any)?.id) || asHoverableOverlayEntity((obj as any)?.primitive);
                  if (e) {
                    pickedEntity = e;
                    break;
                  }
                }
              }
            } catch {
              // ignore
            }
          }

          // 如果没有命中 overlay，尝试用地表坐标做 Rectangle 覆盖物的范围判断（应对半透明面 pick 失败）
          if (!pickedEntity) {
            const carto = this.pickCartographic(pickPos);
            if (carto) {
              pickedEntity =
                this.findHoverableRectangleByCartographic(carto) ||
                this.findHoverableCircleByCartographic(carto) ||
                this.findHoverablePolygonByCartographic(carto);
            }
          }

          // 不是覆盖物 / 或来自绘制模块：取消 hover
          if (!pickedEntity) {
            clearHover();
            return;
          }

          if (pickedEntity.show === false) {
            clearHover();
            return;
          }

          // pickedEntity 已在筛选时保证 _hoverHighlight
          const targets = (pickedEntity._highlightEntities && pickedEntity._highlightEntities.length > 0)
            ? pickedEntity._highlightEntities
            : [pickedEntity];

          const sameTargets =
            this.lastHoverTargets &&
            this.lastHoverTargets.length === targets.length &&
            this.lastHoverTargets.every((e, idx) => e === targets[idx]);

          if (!sameTargets) {
            clearHover();
            this.lastHoverTargets = targets;
            this.overlayHighlight.setOverlayHighlightReason(targets, 'hover', true);
          }
        });
      },
      Cesium.ScreenSpaceEventType.MOUSE_MOVE
    );
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

  /**
   * 生成唯一ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========== 便捷方法：直接调用工具类方法并管理ID ==========

  public toggleOverlayHighlight(entity: OverlayEntity, reason: 'click' | 'hover' = 'click'): void {
    this.overlayHighlight.toggleOverlayHighlight(entity, reason);
  }

  /**
   * 高亮/取消高亮覆盖物（显式设置）
   * @param entityOrId 覆盖物实体或 id
   * @param enabled 是否高亮
   * @param reason 高亮原因（默认 click）
   */
  public setOverlayHighlight(entityOrId: OverlayEntity | string, enabled: boolean, reason: 'click' | 'hover' = 'click'): boolean {
    return this.overlayHighlight.setOverlayHighlight(entityOrId, enabled, reason);
  }

  /**
   * 添加 Marker
   */
  public addMarker(options: MarkerOptions): Entity {
    const id = options.id || this.generateId('marker');
    const entity = this.marker.add({ ...options, id });
    this.overlayMap.set(id, entity);
    this.markOverlayMutated();
    return entity;
  }

  /**
   * 添加 Label
   */
  public addLabel(options: LabelOptions): Entity {
    const id = options.id || this.generateId('label');
    const entity = this.label.add({ ...options, id });
    this.overlayMap.set(id, entity);
    this.markOverlayMutated();
    return entity;
  }

  /**
   * 添加 Icon
   */
  public addIcon(options: IconOptions): Entity {
    const id = options.id || this.generateId('icon');
    const entity = this.icon.add({ ...options, id });
    this.overlayMap.set(id, entity);
    this.markOverlayMutated();
    return entity;
  }

  /**
   * 添加 SVG
   */
  public addSvg(options: SvgOptions): Entity {
    const id = options.id || this.generateId('svg');
    const entity = this.svg.add({ ...options, id });
    this.overlayMap.set(id, entity);
    this.markOverlayMutated();
    return entity;
  }

  /**
   * 添加 InfoWindow
   */
  public addInfoWindow(options: InfoWindowOptions): Entity {
    const id = options.id || this.generateId('infowindow');
    const entity = this.infoWindow.add({ ...options, id });
    this.overlayMap.set(id, entity);
    this.markOverlayMutated();
    return entity;
  }

  /**
   * 添加 Polyline
   */
  public addPolyline(options: PolylineOptions): Entity {
    const id = options.id || this.generateId('polyline');
    const entity = this.polyline.add({ ...options, id });
    this.overlayMap.set(id, entity);
    this.markOverlayMutated();
    return entity;
  }

  /**
   * 添加 Polygon
   */
  public addPolygon(options: PolygonOptions): Entity {
    const id = options.id || this.generateId('polygon');
    const entity = this.polygon.add({ ...options, id });
    this.overlayMap.set(id, entity);
    this.markOverlayMutated();
    return entity;
  }

  /**
   * 添加 Rectangle
   */
  public addRectangle(options: RectangleOptions): Entity {
    const id = options.id || this.generateId('rectangle');
    const entity = this.rectangle.add({ ...options, id });
    this.overlayMap.set(id, entity);
    this.markOverlayMutated();
    return entity;
  }

  /**
   * 添加 Circle
   */
  public addCircle(options: CircleOptions): Entity {
    const id = options.id || this.generateId('circle');
    const entity = this.circle.add({ ...options, id });
    this.overlayMap.set(id, entity);
    this.markOverlayMutated();
    return entity;
  }

  /**
   * 添加 Ring
   */
  public addRing(options: RingOptions): Entity {
    const id = options.id || this.generateId('ring');
    const entity = this.ring.add({ ...options, id });
    this.overlayMap.set(id, entity);
    this.markOverlayMutated();
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
      if (overlay._overlayType === 'infoWindow') {
        this.infoWindow.remove(entity);
      }

      // Circle primitive：不在 entities 集合里，交由 MapCircle 释放 batch 资源
      if (overlay._overlayType === 'circle-primitive') {
        try {
          this.circle.remove(entity);
        } catch {
          // ignore
        }
        this.overlayMap.delete(id);
        this.markOverlayMutated();
        return true;
      }

      // Polygon primitive：不在 entities 集合里，交由 MapPolygon 释放 batch 资源
      if (overlay._overlayType === 'polygon-primitive') {
        try {
          this.polygon.remove(entity);
        } catch {
          // ignore
        }
        this.overlayMap.delete(id);
        this.markOverlayMutated();
        return true;
      }

      // Rectangle primitive：不在 entities 集合里，交由 MapRectangle 释放 batch 资源
      if (overlay._overlayType === 'rectangle-primitive') {
        try {
          this.rectangle.remove(entity);
        } catch {
          // ignore
        }
        this.overlayMap.delete(id);
        this.markOverlayMutated();
        return true;
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
      this.markOverlayMutated();
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

    if (overlay._overlayType === 'circle-primitive') {
      this.circle.updatePosition(entity, position);
      return true;
    }

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

      if (overlay._overlayType === 'circle-primitive') {
        this.circle.setPrimitiveVisible(entity, visible);
        if (overlay._innerEntity) {
          overlay._innerEntity.show = visible;
        }
        return true;
      }

      if (overlay._overlayType === 'polygon-primitive') {
        this.polygon.setPrimitiveVisible(entity, visible);
        if (overlay._borderEntity) {
          overlay._borderEntity.show = visible;
        }
        return true;
      }

      if (overlay._overlayType === 'rectangle-primitive') {
        this.rectangle.setPrimitiveVisible(entity, visible);
        if (overlay._innerEntity) {
          overlay._innerEntity.show = visible;
        }
        return true;
      }

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
    try {
      this.overlayEditor.destroy();
    } catch {
      // ignore
    }
    this.removeAllOverlays();
    if (this.infoWindowContainer && this.infoWindowContainer.parentNode) {
      this.infoWindowContainer.parentNode.removeChild(this.infoWindowContainer);
    }
    this.overlayMap.clear();
  }
}
