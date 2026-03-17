import * as Cesium from "cesium";
import type { Viewer } from "cesium";
import type { DrawEntity } from "../drawHelper";
import type { OverlayEntity } from "./types";
import { PickGovernor } from "../PickGovernor";
import {
  buildCircleHandles,
  buildPointHandles,
  buildPolygonHandles,
  buildPolylineHandles,
  buildRectangleHandles,
  type HandleHelpers,
  updateCircleHandlePositions,
  updatePointHandlePositions,
  updatePolygonHandlePositions,
  updatePolylineHandlePositions,
} from "./OverlayEditHandles";

export type OverlayEditChangeCallback = (entity: DrawEntity & OverlayEntity) => void;

export interface OverlayEditControllerOptions {
  /**
   * 编辑模式下，拖拽结束（LEFT_UP）且覆盖物几何发生变化时触发。
   * 回调参数为“已回写后的覆盖物 entity”。
   */
  onChange?: OverlayEditChangeCallback;
}

export interface OverlayEditHost {
  getViewer(): Viewer;
  getEntities(): Cesium.EntityCollection;

  getOverlayById(id: string): (DrawEntity & OverlayEntity) | undefined;
  pickCartographic(windowPosition: Cesium.Cartesian2): Cesium.Cartographic | null;

  /**
   * 进入编辑前的宿主清理动作（例如清 hover/click 高亮、清 hover 状态等）。
   * 由宿主决定“高亮系统/hover 系统”如何处理。
   */
  prepareEntityForEdit(entity: DrawEntity & OverlayEntity): void;

  /** 将编辑结果回写到覆盖物 */
  applyPolygonPositions(entity: DrawEntity & OverlayEntity, positions: Cesium.Cartesian3[]): void;
  applyRectangleCoordinates(entity: DrawEntity & OverlayEntity, rect: Cesium.Rectangle): void;
  applyCircle(entity: DrawEntity & OverlayEntity, center: Cesium.Cartesian3, radiusMeters: number): void;
  applyPolylinePositions(entity: DrawEntity & OverlayEntity, positions: Cesium.Cartesian3[]): void;
  applyPointPosition(entity: DrawEntity & OverlayEntity, position: Cesium.Cartesian3): void;
}

type OverlayEditingKind = "polygon" | "rectangle" | "circle" | "polyline" | "point";

type OverlayEditDragging =
  | null
  | { type: "vertex"; index: number }
  | { type: "mid"; index: number }
  | { type: "move" }
  | { type: "center" }
  | { type: "radius" }
  | { type: "point" }
  | { type: "rotate" }
  | { type: "scale" };

type OverlayEditDragSnapshot =
  | null
  | { kind: "polygon" | "rectangle" | "polyline"; positions: Cesium.Cartesian3[] }
  | { kind: "circle"; center: Cesium.Cartesian3; radiusMeters: number }
  | { kind: "point"; center: Cesium.Cartesian3 };

export class OverlayEditController {
  private enabled = false;
  private handler: Cesium.ScreenSpaceEventHandler | null = null;
  private readonly pickGovernor: PickGovernor;

  private onChange: OverlayEditChangeCallback | null = null;

  private editingTarget: (DrawEntity & OverlayEntity) | null = null;
  private editingKind: OverlayEditingKind | null = null;

  private editingPositions: Cesium.Cartesian3[] = [];
  private editingCircleCenter: Cesium.Cartesian3 | null = null;
  private editingCircleRadiusMeters = 0;
  private editingPointPosition: Cesium.Cartesian3 | null = null;

  private handleEntities: Cesium.Entity[] = [];
  private dragging: OverlayEditDragging = null;

  private dragSnapshot: OverlayEditDragSnapshot = null;
  private dragChanged = false;

  private moveStartCenter: Cesium.Cartographic | null = null;
  private moveStartPositions: Cesium.Cartesian3[] | null = null;

  private transformStartCenter: Cesium.Cartesian3 | null = null;
  private transformStartPositions: Cesium.Cartesian3[] | null = null;
  private rotateStartAngle = 0;
  private scaleStartDistance = 1;

  private cameraBackup: null | {
    enableInputs?: boolean;
    enableRotate?: boolean;
    enableTranslate?: boolean;
    enableZoom?: boolean;
    enableTilt?: boolean;
    enableLook?: boolean;
  } = null;

  constructor(private readonly host: OverlayEditHost, options: OverlayEditControllerOptions = {}) {
    this.onChange = options.onChange ?? null;
    this.pickGovernor = new PickGovernor({
      profiles: {
        edit: { minIntervalMs: 80, minMovePx: 0 },
      },
    });
  }

  public setOnChange(cb?: OverlayEditChangeCallback | null): void {
    this.onChange = cb ?? null;
  }

  public setEnabled(enabled: boolean): void {
    const next = !!enabled;
    if (this.enabled === next) return;
    this.enabled = next;

    if (!next) {
      this.stop();
      this.destroyHandler();
      return;
    }

    this.ensureHandler();
  }

  public getEnabled(): boolean {
    return this.enabled;
  }

  public isEditing(): boolean {
    return !!this.editingTarget;
  }

  public destroy(): void {
    this.setEnabled(false);
  }

  /** 停止当前正在编辑的覆盖物（不会关闭全局编辑模式） */
  public stop(): void {
    this.restoreCameraController();
    this.dragging = null;
    this.dragSnapshot = null;
    this.dragChanged = false;
    this.moveStartCenter = null;
    this.moveStartPositions = null;
    this.transformStartCenter = null;
    this.transformStartPositions = null;
    this.rotateStartAngle = 0;
    this.scaleStartDistance = 1;

    this.editingTarget = null;
    this.editingKind = null;
    this.editingPositions = [];
    this.editingCircleCenter = null;
    this.editingCircleRadiusMeters = 0;
    this.editingPointPosition = null;

    this.clearHandles();
  }

  /**
   * 主动开始编辑某个覆盖物。
   * @returns true 表示成功进入编辑
   */
  public start(entityOrId: (DrawEntity & OverlayEntity) | string): boolean {
    const entity = typeof entityOrId === "string" ? this.host.getOverlayById(entityOrId) : entityOrId;
    if (!entity) return false;
    const target = this.resolveEditTarget(entity);
    if ((target as any).__vmapOverlayEditHandle) return false;
    if ((target as any)._drawType !== undefined) return false;
    if (target.show === false) return false;

    const kind = this.detectEditableKind(target);
    if (!kind) return false;

    this.ensureHandler();
    this.stop();

    this.editingTarget = target;
    this.editingKind = kind;

    try {
      this.host.prepareEntityForEdit(target);
    } catch {
      // ignore
    }

    if (kind === "polygon") {
      const positions = this.getEditablePolygonPositions(entity);
      if (!positions || positions.length < 3) {
        this.stop();
        return false;
      }
      this.editingPositions = positions;
      this.handleEntities = buildPolygonHandles(this.editingPositions, this.getHandleHelpers());
      return true;
    }

    if (kind === "rectangle") {
      const rect = this.getEditableRectangle(entity);
      if (!rect) {
        this.stop();
        return false;
      }
      const baseHeight = this.getRectangleEditHeight(entity);
      this.editingPositions = this.rectangleToPositions(rect, baseHeight);
      this.handleEntities = buildRectangleHandles(this.editingPositions, this.getHandleHelpers());
      return true;
    }

    if (kind === "circle") {
      const info = this.getEditableCircleInfo(entity);
      if (!info) {
        this.stop();
        return false;
      }
      this.editingCircleCenter = info.center;
      this.editingCircleRadiusMeters = info.radiusMeters;
      this.handleEntities = buildCircleHandles(this.editingCircleCenter, this.editingCircleRadiusMeters, this.getHandleHelpers());
      return true;
    }

    if (kind === "polyline") {
      const positions = this.getEditablePolylinePositions(entity);
      if (!positions || positions.length < 2) {
        this.stop();
        return false;
      }
      this.editingPositions = positions;
      this.handleEntities = buildPolylineHandles(this.editingPositions, this.getHandleHelpers());
      return true;
    }

    if (kind === "point") {
      const pos = this.getEditablePointPosition(entity);
      if (!pos) {
        this.stop();
        return false;
      }
      this.editingPointPosition = pos;
      this.handleEntities = buildPointHandles(this.editingPointPosition, this.getHandleHelpers());
      return true;
    }

    return false;
  }

  private resolveEditTarget(entity: (DrawEntity & OverlayEntity)): (DrawEntity & OverlayEntity) {
    const id = (entity as any).id;
    if (typeof id === "string" && id.endsWith("__fill")) {
      const rootId = id.replace(/__fill$/, "");
      const root = this.host.getOverlayById(rootId);
      if (root && (root as any)._isRing && ((root as any)._centerCartographic || (root as any)._outerRadius)) {
        return root as DrawEntity & OverlayEntity;
      }
    }

    const group = (entity as any)._highlightEntities as Array<DrawEntity & OverlayEntity> | undefined;
    if (Array.isArray(group) && group.length > 0) {
      for (const candidate of group) {
        if ((candidate as any)._isRing && ((candidate as any)._centerCartographic || (candidate as any)._outerRadius)) {
          return candidate as DrawEntity & OverlayEntity;
        }
      }
    }
    return entity;
  }

  // =====================
  // Editable kind & extract
  // =====================

  private detectEditableKind(entity: (DrawEntity & OverlayEntity)): OverlayEditingKind | null {
    const overlayType = String((entity as any)._overlayType ?? "");
    const isRingCircle = !!(entity as any)._isRing && ((entity as any)._centerCartographic || (entity as any)._outerRadius);

    if (overlayType === "circle-primitive" || isRingCircle || entity.ellipse) return "circle";
    if (entity.polygon || overlayType === "polygon-primitive") return "polygon";
    if (entity.rectangle || overlayType === "rectangle-primitive" || (entity as any)._outerRectangle) return "rectangle";
    if (entity.polyline) return "polyline";
    if (entity.label && !(entity.point || entity.billboard)) return null;
    if ((entity as any)._infoWindow) return null;
    if (entity.point || entity.billboard) return "point";

    return null;
  }

  private getPropertyValue<T>(prop: any, fallback: T): T {
    try {
      if (prop && typeof prop.getValue === "function") {
        return prop.getValue(Cesium.JulianDate.now()) as T;
      }
      if (prop !== undefined) return prop as T;
      return fallback;
    } catch {
      return fallback;
    }
  }

  private getNumberProperty(prop: any, fallback: number): number {
    const v = this.getPropertyValue<any>(prop, fallback);
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
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

  private resolvePolylinePositions(entity: OverlayEntity): Cesium.Cartesian3[] | null {
    if (entity.polyline && (entity.polyline as any).positions !== undefined) {
      const positions = this.getPropertyValue<any>((entity.polyline as any).positions, null);
      if (Array.isArray(positions)) {
        return positions as Cesium.Cartesian3[];
      }
    }
    return null;
  }

  private getEditablePolygonPositions(entity: (DrawEntity & OverlayEntity)): Cesium.Cartesian3[] | null {
    const overlayType = String((entity as any)._overlayType ?? "");
    if (overlayType === "polygon-primitive") {
      const root = (entity._highlightEntities && entity._highlightEntities.length > 0)
        ? (entity._highlightEntities[0] as OverlayEntity)
        : (entity as OverlayEntity);
      const outline = (root as any)._primitiveOutlinePositions as Cesium.Cartesian3[] | undefined;
      if (outline && outline.length >= 4) {
        const list = outline.slice();
        const first = list[0];
        const last = list[list.length - 1];
        if (first && last && Cesium.Cartesian3.equals(first, last)) {
          list.pop();
        }
        return list;
      }
      return null;
    }

    const direct = this.resolvePolygonPositions(entity);
    if (direct && direct.length >= 3) return direct.slice();

    if (entity._innerEntity) {
      const inner = this.resolvePolygonPositions(entity._innerEntity as OverlayEntity);
      if (inner && inner.length >= 3) return inner.slice();
    }
    return null;
  }

  private getEditablePolylinePositions(entity: (DrawEntity & OverlayEntity)): Cesium.Cartesian3[] | null {
    const direct = this.resolvePolylinePositions(entity);
    if (direct && direct.length >= 2) return direct.slice();

    if (entity._innerEntity) {
      const inner = this.resolvePolylinePositions(entity._innerEntity as OverlayEntity);
      if (inner && inner.length >= 2) return inner.slice();
    }

    return null;
  }

  private getEditablePointPosition(entity: (DrawEntity & OverlayEntity)): Cesium.Cartesian3 | null {
    if ((entity as any).position !== undefined) {
      const pos = this.getPropertyValue<Cesium.Cartesian3 | null>((entity as any).position, null);
      if (pos) return pos;
    }
    if (entity._innerEntity && (entity._innerEntity as any).position !== undefined) {
      const pos = this.getPropertyValue<Cesium.Cartesian3 | null>((entity._innerEntity as any).position, null);
      if (pos) return pos;
    }
    return null;
  }

  private getEditableRectangle(entity: (DrawEntity & OverlayEntity)): Cesium.Rectangle | null {
    const overlayType = String((entity as any)._overlayType ?? "");

    if (overlayType === "rectangle-primitive") {
      const root = (entity._highlightEntities && entity._highlightEntities.length > 0)
        ? (entity._highlightEntities[0] as OverlayEntity)
        : (entity as OverlayEntity);
      const rect = (root as any)._outerRectangle as Cesium.Rectangle | undefined;
      return rect ?? null;
    }

    if (entity.rectangle && (entity.rectangle as any).coordinates !== undefined) {
      const rect = this.getPropertyValue<Cesium.Rectangle | null>((entity.rectangle as any).coordinates, null);
      if (rect) return rect;
    }

    if ((entity as any)._outerRectangle) {
      return (entity as any)._outerRectangle as Cesium.Rectangle;
    }

    if (entity._innerEntity && (entity._innerEntity as any).rectangle && (entity._innerEntity as any).rectangle.coordinates !== undefined) {
      const rect = this.getPropertyValue<Cesium.Rectangle | null>(((entity._innerEntity as any).rectangle as any).coordinates, null);
      if (rect) return rect;
    }

    return null;
  }

  private getEditableCircleInfo(entity: (DrawEntity & OverlayEntity)): { center: Cesium.Cartesian3; radiusMeters: number } | null {
    const overlayType = String((entity as any)._overlayType ?? "");
    const clampToGround = this.getEditingClampToGround();

    if (overlayType === "circle-primitive") {
      const root = (entity._highlightEntities && entity._highlightEntities.length > 0)
        ? (entity._highlightEntities[0] as OverlayEntity)
        : (entity as OverlayEntity);
      const centerCarto = (root as any)._centerCartographic as Cesium.Cartographic | undefined;
      const radius = Number((root as any)._outerRadius ?? 0) || 0;
      if (!centerCarto || !(radius > 0)) return null;
      const h = clampToGround ? 0 : (Number.isFinite(centerCarto.height) ? centerCarto.height : 0);
      const center = Cesium.Cartesian3.fromRadians(centerCarto.longitude, centerCarto.latitude, h);
      return { center, radiusMeters: radius };
    }

    if (entity.ellipse && (entity as any).position) {
      const center = this.getPropertyValue<Cesium.Cartesian3 | null>((entity as any).position, null);
      const semiMajor = this.getNumberProperty((entity.ellipse as any).semiMajorAxis, 0);
      const semiMinor = this.getNumberProperty((entity.ellipse as any).semiMinorAxis, 0);
      const radius = Math.max(0, Math.min(semiMajor, semiMinor));
      if (center && radius > 0) {
        const carto = Cesium.Cartographic.fromCartesian(center);
        const h = clampToGround ? 0 : (Number.isFinite(carto.height) ? carto.height : 0);
        const editCenter = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, h);
        return { center: editCenter, radiusMeters: radius };
      }
    }

    const centerCarto = (entity as any)._centerCartographic as Cesium.Cartographic | undefined;
    const radius = Number((entity as any)._outerRadius ?? 0) || 0;
    if (centerCarto && radius > 0) {
      const h = clampToGround ? 0 : (Number.isFinite(centerCarto.height) ? centerCarto.height : 0);
      const center = Cesium.Cartesian3.fromRadians(centerCarto.longitude, centerCarto.latitude, h);
      return { center, radiusMeters: radius };
    }

    return null;
  }

  // =====================
  // Handler lifecycle
  // =====================

  /**
   * 确保屏幕空间事件处理器已初始化
   * 如果处理器不存在，则创建一个新的处理器并设置各种交互事件
   */
  private ensureHandler(): void {
    // 如果处理器已存在，直接返回
    if (this.handler) return;

    try {
      // 获取查看器实例
      const viewer = this.host.getViewer();
      // 创建屏幕空间事件处理器，用于处理用户与场景的交互
      this.handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

      /**
       * 处理鼠标左键按下事件
       * 用于选择处理点、开始拖动等操作
       */
      // LEFT_DOWN: pick handles & start drag
      this.handler.setInputAction((e: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        if (!this.enabled) return;
        if (!this.editingTarget || !this.editingKind) return;

        // block other pick handlers in this click chain
        try {
          const anyViewer: any = viewer as any;
          anyViewer.__vmapDrawHelperBlockPickUntil = Date.now() + 250;
        } catch {
          // ignore
        }

        // 获取鼠标点击位置的实体
        const pickPos: any = (e as any).position;
        if (!pickPos || !Number.isFinite(pickPos.x) || !Number.isFinite(pickPos.y)) {
          return;
        }
        if (!this.pickGovernor.shouldPick('edit', pickPos)) {
          return;
        }

        const picked = viewer.scene.pick(pickPos);
        const pickedEntity = picked && ((picked as any).id as Cesium.Entity | undefined);
        if (!pickedEntity || !(pickedEntity as any).__vmapOverlayEditHandle) {
          return;
        }

        // 获取实体的元数据
        const meta = (pickedEntity as any).__vmapOverlayEditHandleMeta as any;
        if (!meta) return;

        // 处理中点点击，插入新顶点
        if (meta.type === "mid" && typeof meta.index === "number") {
          if (this.editingKind !== "polygon" && this.editingKind !== "polyline") return;
          const insertIndex = meta.index + 1;
          this.beginDrag({ type: "vertex", index: insertIndex });
          const prev = this.editingPositions[meta.index];
          const next = this.editingPositions[insertIndex % this.editingPositions.length];
          const h0 = prev ? this.getCartesianHeight(prev) : 0;
          const h1 = next ? this.getCartesianHeight(next) : h0;
          const pos = this.pickCartesianOnGlobe(e.position as any, (h0 + h1) / 2);
          if (!pos) return;
          this.editingPositions.splice(insertIndex, 0, pos);

          // 立刻回写：避免“点中点新增顶点但不拖动”时不生效
          if (this.editingKind === "polygon") this.applyEditedPolygon();
          if (this.editingKind === "polyline") this.applyEditedPolyline();
          this.dragChanged = true;

          this.rebuildHandles();
          return;
        }

        // 处理顶点点击，开始拖动顶点
        if (meta.type === "vertex" && typeof meta.index === "number") {
          this.beginDrag({ type: "vertex", index: meta.index });
          return;
        }

        // 处理移动操作
        if (meta.type === "move") {
          if (this.editingKind === "polygon" || this.editingKind === "polyline" || this.editingKind === "rectangle") {
            this.beginMoveDrag();
          }
          return;
        }

        // 处理中心点操作
        if (meta.type === "center") {
          this.beginDrag({ type: "center" });
          return;
        }

        // 处理半径操作
        if (meta.type === "radius") {
          this.beginDrag({ type: "radius" });
          return;
        }

        if (meta.type === "point") {
          this.beginDrag({ type: "point" });
          return;
        }

        if (meta.type === "rotate" || meta.type === "scale") {
          if (this.editingKind !== "polyline") return;
          this.beginDrag(meta.type === "rotate" ? { type: "rotate" } : { type: "scale" });
          this.transformStartPositions = this.editingPositions.slice();
          this.transformStartCenter = this.computePolygonCenterCartesian(this.editingPositions);

          const h = this.getEditingClampToGround() ? 0 : this.getCartesianHeight(this.transformStartCenter);
          const pos = this.pickCartesianOnGlobe(e.position as any, h) ?? this.transformStartCenter;
          const info = this.getLocalAngleAndDistance(this.transformStartCenter, pos);
          this.rotateStartAngle = info.angle;
          this.scaleStartDistance = Math.max(1e-6, info.distance);

          return;
        }
      }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

      /**
       * 处理鼠标右键点击事件
       * 用于删除多边形的顶点
       */
      this.handler.setInputAction((e: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        if (!this.enabled) return;
        if (!this.editingTarget || (this.editingKind !== "polygon" && this.editingKind !== "polyline")) return;
        if (!e.position) return;

        try {
          const anyViewer: any = viewer as any;
          anyViewer.__vmapDrawHelperBlockPickUntil = Date.now() + 250;
        } catch {
          // ignore
        }

        const pickPos: any = (e as any).position;
        if (!pickPos || !Number.isFinite(pickPos.x) || !Number.isFinite(pickPos.y)) return;
        if (!this.pickGovernor.shouldPick('edit', pickPos)) return;

        const picked = viewer.scene.pick(pickPos);
        const pickedEntity = picked && ((picked as any).id as Cesium.Entity | undefined);
        if (!pickedEntity || !(pickedEntity as any).__vmapOverlayEditHandle) return;
        const meta = (pickedEntity as any).__vmapOverlayEditHandleMeta as any;
        if (!meta || meta.type !== "vertex" || typeof meta.index !== "number") return;

        // 确保多边形至少保留3个顶点，折线至少保留2个顶点
        if (this.editingKind === "polygon" && this.editingPositions.length <= 3) return;
        if (this.editingKind === "polyline" && this.editingPositions.length <= 2) return;

        const idx = meta.index;
        if (idx < 0 || idx >= this.editingPositions.length) return;

        // 删除指定顶点并更新多边形
        this.editingPositions.splice(idx, 1);
        if (this.editingKind === "polygon") this.applyEditedPolygon();
        if (this.editingKind === "polyline") this.applyEditedPolyline();
        this.rebuildHandles();
      }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

      /**
       * 处理鼠标移动事件
       * 用于更新拖动操作中的位置
       */
      this.handler.setInputAction((move: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
        if (!this.enabled) return;
        if (!this.dragging) return;
        if (!this.editingTarget || !this.editingKind) return;

        const endPos: any = (move as any).endPosition;
        if (!endPos || !Number.isFinite(endPos.x) || !Number.isFinite(endPos.y)) return;

        // 处理多边形的编辑
        if (this.editingKind === "polygon") {
          // 拖动顶点
          if (this.dragging.type === "vertex") {
            const idx = this.dragging.index;
            if (idx >= 0 && idx < this.editingPositions.length) {
              const h = this.getEditingClampToGround() ? 0 : this.getCartesianHeight(this.editingPositions[idx]);
              const pos = this.pickCartesianOnGlobe(endPos, h);
              if (!pos) return;
              this.editingPositions[idx] = pos;
              this.applyEditedPolygon();
              this.dragChanged = true;
              if (!updatePolygonHandlePositions(this.editingPositions, this.handleEntities, this.getHandleHelpers())) {
                this.rebuildHandles();
              }
            }
          }

          // 移动整个多边形
          if (this.dragging.type === "move") {
            if (!this.moveStartCenter || !this.moveStartPositions) return;
            const pos = this.pickCartesianOnGlobe(endPos, this.getCartesianHeight(this.moveStartPositions[0]));
            if (!pos) return;
            this.editingPositions = this.computeMovedPositions(this.moveStartCenter, this.moveStartPositions, pos);
            this.applyEditedPolygon();
            this.dragChanged = true;
            if (!updatePolygonHandlePositions(this.editingPositions, this.handleEntities, this.getHandleHelpers())) {
              this.rebuildHandles();
            }
          }

          return;
        }

        // 处理折线的编辑
        if (this.editingKind === "polyline") {
          if (this.dragging.type === "vertex") {
            const idx = this.dragging.index;
            if (idx >= 0 && idx < this.editingPositions.length) {
              const h = this.getEditingClampToGround() ? 0 : this.getCartesianHeight(this.editingPositions[idx]);
              const pos = this.pickCartesianOnGlobe(endPos, h);
              if (!pos) return;
              this.editingPositions[idx] = pos;
              this.applyEditedPolyline();
              this.dragChanged = true;
              if (!updatePolylineHandlePositions(this.editingPositions, this.handleEntities, this.getHandleHelpers())) {
                this.rebuildHandles();
              }
            }
          }

          if (this.dragging.type === "move") {
            if (!this.moveStartCenter || !this.moveStartPositions) return;
            const pos = this.pickCartesianOnGlobe(endPos, this.getCartesianHeight(this.moveStartPositions[0]));
            if (!pos) return;
            this.editingPositions = this.computeMovedPositions(this.moveStartCenter, this.moveStartPositions, pos);
            this.applyEditedPolyline();
            this.dragChanged = true;
            if (!updatePolylineHandlePositions(this.editingPositions, this.handleEntities, this.getHandleHelpers())) {
              this.rebuildHandles();
            }
          }

          if (this.dragging.type === "rotate" || this.dragging.type === "scale") {
            if (!this.transformStartCenter || !this.transformStartPositions) return;
            const h = this.getEditingClampToGround() ? 0 : this.getCartesianHeight(this.transformStartCenter);
            const pos = this.pickCartesianOnGlobe(endPos, h);
            if (!pos) return;

            const info = this.getLocalAngleAndDistance(this.transformStartCenter, pos);
            const angleDelta = info.angle - this.rotateStartAngle;
            const scale = Math.max(0.2, Math.min(5, info.distance / this.scaleStartDistance));

            const next = this.applyRotateScaleToPositions(
              this.transformStartPositions,
              this.transformStartCenter,
              angleDelta,
              scale
            );

            this.editingPositions = next;
            this.applyEditedPolyline();
            this.dragChanged = true;
            if (!updatePolylineHandlePositions(this.editingPositions, this.handleEntities, this.getHandleHelpers())) {
              this.rebuildHandles();
            }
          }

          return;
        }

        // 处理矩形的编辑
        if (this.editingKind === "rectangle") {
          if (this.dragging.type === "vertex") {
            const idx = this.dragging.index;
            if (idx >= 0 && idx < this.editingPositions.length) {
              const h = this.getEditingClampToGround() ? 0 : this.getCartesianHeight(this.editingPositions[idx]);
              const pos = this.pickCartesianOnGlobe(endPos, h);
              if (!pos) return;
              this.editingPositions[idx] = pos;
              this.applyEditedRectangle();
              this.dragChanged = true;
              this.rebuildHandles();
            }
          }
          if (this.dragging.type === "move") {
            if (!this.moveStartCenter || !this.moveStartPositions) return;
            const pos = this.pickCartesianOnGlobe(endPos, this.getCartesianHeight(this.moveStartPositions[0]));
            if (!pos) return;
            this.editingPositions = this.computeMovedPositions(this.moveStartCenter, this.moveStartPositions, pos);
            this.applyEditedRectangle();
            this.dragChanged = true;
            this.rebuildHandles();
          }
          return;
        }

        // 处理圆形的编辑
        if (this.editingKind === "circle") {
          if (!this.editingCircleCenter) return;

          // 拖动圆心
          if (this.dragging.type === "center") {
            const h = this.getEditingClampToGround() ? 0 : this.getCartesianHeight(this.editingCircleCenter);
            const pos = this.pickCartesianOnGlobe(endPos, h);
            if (!pos) return;
            this.editingCircleCenter = pos;
            this.applyEditedCircle();
            this.dragChanged = true;
            if (!updateCircleHandlePositions(this.editingCircleCenter, this.editingCircleRadiusMeters, this.handleEntities, this.getHandleHelpers())) {
              this.rebuildHandles();
            }
            return;
          }

          // 调整半径
          if (this.dragging.type === "radius") {
            const h = this.getEditingClampToGround() ? 0 : this.getCartesianHeight(this.editingCircleCenter);
            const pos = this.pickCartesianOnGlobe(endPos, h);
            if (!pos) return;
            const r = this.computeSurfaceDistanceMeters(this.editingCircleCenter, pos);
            this.editingCircleRadiusMeters = Math.max(0, r);
            this.applyEditedCircle();
            this.dragChanged = true;
            if (!updateCircleHandlePositions(this.editingCircleCenter, this.editingCircleRadiusMeters, this.handleEntities, this.getHandleHelpers())) {
              this.rebuildHandles();
            }
            return;
          }
        }

        if (this.editingKind === "point") {
          if (this.dragging.type === "point") {
            const h = this.editingPointPosition ? this.getCartesianHeight(this.editingPointPosition) : 0;
            const pos = this.pickCartesianOnGlobe(endPos, h);
            if (!pos) return;
            this.editingPointPosition = pos;
            this.applyEditedPoint();
            this.dragChanged = true;
            if (!updatePointHandlePositions(this.editingPointPosition, this.handleEntities)) {
              this.rebuildHandles();
            }
          }
          return;
        }
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      /**
       * 处理鼠标左键释放事件
       * 用于停止拖动操作
       */
      this.handler.setInputAction(() => {
        const target = this.editingTarget;
        const shouldEmit = !!this.dragging && !!target && (this.dragChanged || this.isGeometryChangedSinceSnapshot(this.dragSnapshot));

        this.dragging = null;
        this.dragSnapshot = null;
        this.dragChanged = false;
        this.moveStartCenter = null;
        this.moveStartPositions = null;
        this.transformStartCenter = null;
        this.transformStartPositions = null;
        this.rotateStartAngle = 0;
        this.scaleStartDistance = 1;
        this.restoreCameraController();

        if (shouldEmit && target && this.onChange) {
          this.emitChange(target);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_UP);
    } catch {
      // ignore
    }
  }

  private beginDrag(dragging: OverlayEditDragging): void {
    this.dragSnapshot = this.captureDragSnapshot();
    this.dragChanged = false;
    this.dragging = dragging;
    this.lockCameraController();
  }

  private beginMoveDrag(): void {
    this.beginDrag({ type: "move" });
    this.moveStartPositions = this.editingPositions.slice();
    this.moveStartCenter = this.computePolygonCenterCartographic(this.editingPositions);
  }

  private computeMovedPositions(
    startCenter: Cesium.Cartographic,
    startPositions: Cesium.Cartesian3[],
    pickPosition: Cesium.Cartesian3
  ): Cesium.Cartesian3[] {
    const nowCenter = Cesium.Cartographic.fromCartesian(pickPosition);
    if (!nowCenter) return startPositions.slice();
    const dLon = nowCenter.longitude - startCenter.longitude;
    const dLat = nowCenter.latitude - startCenter.latitude;
    const clampToGround = this.getEditingClampToGround();

    const moved: Cesium.Cartesian3[] = [];
    for (const p0 of startPositions) {
      const c0 = Cesium.Cartographic.fromCartesian(p0);
      const lon = c0.longitude + dLon;
      const lat = c0.latitude + dLat;
      const h = clampToGround ? 0 : (Number.isFinite(c0.height) ? c0.height : 0);
      moved.push(Cesium.Cartesian3.fromRadians(lon, lat, h));
    }

    return moved;
  }

  private emitChange(target: DrawEntity & OverlayEntity): void {
    try {
      this.prepareOnChangeTarget(target);
      this.onChange?.(target);
    } catch {
      // ignore
    }
  }

  private prepareOnChangeTarget(target: DrawEntity & OverlayEntity): void {
    const overlayType = this.resolveOverlayTypeFromId(target);
    if (!overlayType) return;

    (target as any).overlayType = overlayType;

    if (overlayType === "marker") {
      this.attachMarkerLngLat(target);
      return;
    }

    if (overlayType === "polyline") {
      this.attachPolylineLngLat(target);
      return;
    }

    if (overlayType === "circle") {
      this.attachCircleLngLat(target);
      return;
    }

    if (overlayType === "polygon") {
      this.attachPolygonLngLat(target);
      return;
    }

    if (overlayType === "rectangle") {
      this.attachRectangleLngLat(target);
    }
  }

  private resolveOverlayTypeFromId(target: DrawEntity & OverlayEntity): string | null {
    const id = (target as any).id;
    if (typeof id !== "string" || id.length === 0) return null;
    return id.split("_")[0] ?? null;
  }

  private attachMarkerLngLat(target: DrawEntity & OverlayEntity): void {
    const pos = this.getPropertyValue<Cesium.Cartesian3 | null>((target as any).position, null);
    if (!pos) return;
    const posLngLat = this.convertPositionToLngLat(pos);
    if (posLngLat) (target as any).__vmapPrimitiveLngLatPosition = posLngLat;
  }

  private attachPolylineLngLat(target: DrawEntity & OverlayEntity): void {
    const polyline = (target as any)?.polyline as Cesium.Cartesian3[] | undefined;
    const positions = this.getPropertyValue<any>((polyline as any)?.positions, null) as Cesium.Cartesian3[] | null;
    if (!Array.isArray(positions) || positions.length === 0) return;
    const lngLatPositions = this.convertOutlineToLngLat(positions);
    (target as any).__vmapPrimitivePolylineLngLatPositions = lngLatPositions;
  }

  private attachCircleLngLat(target: DrawEntity & OverlayEntity): void {
    const pos = (target as any)._centerCartographic as Cesium.Cartographic | undefined;
    let posLngLat = pos ? this.convertCartoToLngLat(pos) : null;

    if (!posLngLat) {
      const position = this.getPropertyValue<Cesium.Cartesian3 | null>((target as any).position, null);
      if (position) posLngLat = this.convertPositionToLngLat(position);
    }

    if (posLngLat) (target as any).__vmapPrimitiveCircleLngLatPosition = posLngLat;
  }

  private attachPolygonLngLat(target: DrawEntity & OverlayEntity): void {
    const outline = (target as any)?._primitiveOutlinePositions as Cesium.Cartesian3[] | undefined;
    if (!Array.isArray(outline) || outline.length === 0) return;
    const lngLatPositions = this.convertOutlineToLngLat(outline);
    (target as any).__vmapPrimitiveOutlineLngLatPositions = lngLatPositions;
  }

  private attachRectangleLngLat(target: DrawEntity & OverlayEntity): void {
    const rect = this.getEditableRectangle(target);
    if (!rect) return;
    const height = this.getRectangleEditHeight(target);
    const lngLatPositions = this.rectangleToLngLatPositions(rect, height);
    (target as any).__vmapPrimitiveRectangleLngLatPositions = lngLatPositions;

    const centerCarto = Cesium.Rectangle.center(rect, new Cesium.Cartographic());
    centerCarto.height = height;
    (target as any).__vmapPrimitiveRectangleCenterLngLat = this.convertCartoToLngLat(centerCarto);
  }

  private captureDragSnapshot(): OverlayEditDragSnapshot {
    if (!this.editingKind) return null;

    if (this.editingKind === "polygon" || this.editingKind === "rectangle" || this.editingKind === "polyline") {
      return { kind: this.editingKind, positions: this.editingPositions.slice() };
    }

    if (this.editingKind === "circle") {
      if (!this.editingCircleCenter) return null;
      return {
        kind: "circle",
        center: Cesium.Cartesian3.clone(this.editingCircleCenter, new Cesium.Cartesian3()),
        radiusMeters: this.editingCircleRadiusMeters,
      };
    }

    if (this.editingKind === "point") {
      if (!this.editingPointPosition) return null;
      return {
        kind: "point",
        center: Cesium.Cartesian3.clone(this.editingPointPosition, new Cesium.Cartesian3()),
      };
    }

    return null;
  }

  private isGeometryChangedSinceSnapshot(snapshot: OverlayEditDragSnapshot): boolean {
    if (!snapshot || !this.editingKind) return false;

    if (snapshot.kind === "circle") {
      if (this.editingKind !== "circle") return true;
      if (!this.editingCircleCenter) return true;
      if (!Cesium.Cartesian3.equals(snapshot.center, this.editingCircleCenter)) return true;
      if (Math.abs(snapshot.radiusMeters - this.editingCircleRadiusMeters) > 1e-6) return true;
      return false;
    }

    if (snapshot.kind === "point") {
      if (this.editingKind !== "point") return true;
      if (!this.editingPointPosition) return true;
      if (!Cesium.Cartesian3.equals(snapshot.center, this.editingPointPosition)) return true;
      return false;
    }

    // polygon / rectangle
    if (this.editingKind !== snapshot.kind) return true;
    const a = snapshot.positions;
    const b = this.editingPositions;
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) {
      if (!Cesium.Cartesian3.equals(a[i], b[i])) return true;
    }
    return false;
  }

  private destroyHandler(): void {
    if (!this.handler) return;

    try {
      this.handler.destroy();
    } catch {
      // ignore
    }

    this.handler = null;

    // 防御：若异常退出 handler，确保相机控制恢复
    this.restoreCameraController();
  }

  // =====================
  // Camera controller lock
  // =====================

  private lockCameraController(): void {
    const viewer = this.host.getViewer();
    const ctrl: any = (viewer && viewer.scene) ? (viewer.scene as any).screenSpaceCameraController : null;
    if (!ctrl) return;
    if (this.cameraBackup) return;

    this.cameraBackup = {
      enableInputs: typeof ctrl.enableInputs === "boolean" ? ctrl.enableInputs : undefined,
      enableRotate: typeof ctrl.enableRotate === "boolean" ? ctrl.enableRotate : undefined,
      enableTranslate: typeof ctrl.enableTranslate === "boolean" ? ctrl.enableTranslate : undefined,
      enableZoom: typeof ctrl.enableZoom === "boolean" ? ctrl.enableZoom : undefined,
      enableTilt: typeof ctrl.enableTilt === "boolean" ? ctrl.enableTilt : undefined,
      enableLook: typeof ctrl.enableLook === "boolean" ? ctrl.enableLook : undefined,
    };

    try { ctrl.enableInputs = false; } catch { /* ignore */ }
    try { ctrl.enableRotate = false; } catch { /* ignore */ }
    try { ctrl.enableTranslate = false; } catch { /* ignore */ }
    try { ctrl.enableZoom = false; } catch { /* ignore */ }
    try { ctrl.enableTilt = false; } catch { /* ignore */ }
    try { ctrl.enableLook = false; } catch { /* ignore */ }
  }

  private restoreCameraController(): void {
    const viewer = this.host.getViewer();
    const ctrl: any = (viewer && viewer.scene) ? (viewer.scene as any).screenSpaceCameraController : null;
    if (!ctrl) {
      this.cameraBackup = null;
      return;
    }

    const b = this.cameraBackup;
    if (!b) return;

    try { if (typeof b.enableInputs === "boolean") ctrl.enableInputs = b.enableInputs; else ctrl.enableInputs = true; } catch { /* ignore */ }
    try { if (typeof b.enableRotate === "boolean") ctrl.enableRotate = b.enableRotate; } catch { /* ignore */ }
    try { if (typeof b.enableTranslate === "boolean") ctrl.enableTranslate = b.enableTranslate; } catch { /* ignore */ }
    try { if (typeof b.enableZoom === "boolean") ctrl.enableZoom = b.enableZoom; } catch { /* ignore */ }
    try { if (typeof b.enableTilt === "boolean") ctrl.enableTilt = b.enableTilt; } catch { /* ignore */ }
    try { if (typeof b.enableLook === "boolean") ctrl.enableLook = b.enableLook; } catch { /* ignore */ }

    this.cameraBackup = null;
  }

  // =====================
  // Handles management
  // =====================

  private clearHandles(): void {
    if (this.handleEntities.length > 0) {
      const entities = this.host.getEntities();
      for (const e of this.handleEntities) {
        try {
          entities.remove(e);
        } catch {
          // ignore
        }
      }
    }
    this.handleEntities = [];
  }

  private rebuildHandles(): void {
    if (!this.editingKind) return;
    this.clearHandles();

    const helpers = this.getHandleHelpers();

    if (this.editingKind === "polygon") {
      this.handleEntities = buildPolygonHandles(this.editingPositions, helpers);
      return;
    }
    if (this.editingKind === "rectangle") {
      this.handleEntities = buildRectangleHandles(this.editingPositions, helpers);
      return;
    }
    if (this.editingKind === "circle") {
      this.handleEntities = buildCircleHandles(this.editingCircleCenter, this.editingCircleRadiusMeters, helpers);
      return;
    }
    if (this.editingKind === "polyline") {
      this.handleEntities = buildPolylineHandles(this.editingPositions, helpers);
      return;
    }
    if (this.editingKind === "point") {
      this.handleEntities = buildPointHandles(this.editingPointPosition, helpers);
      return;
    }
  }

  private getHandleHelpers(): HandleHelpers {
    return {
      createHandle: this.createHandle.bind(this),
      computePolygonCenterCartesian: this.computePolygonCenterCartesian.bind(this),
      computePolylineHandleRadius: this.computePolylineHandleRadius.bind(this),
      offsetByMeters: this.offsetByMeters.bind(this),
      circleRadiusHandlePosition: this.circleRadiusHandlePosition.bind(this),
    };
  }

  private createHandle(position: Cesium.Cartesian3, style: { color: Cesium.Color; outlineColor: Cesium.Color; pixelSize: number }, meta: any): Cesium.Entity {
    const entities = this.host.getEntities();
    const ent = entities.add({
      position: new Cesium.ConstantPositionProperty(position),
      point: {
        pixelSize: style.pixelSize,
        color: style.color,
        outlineColor: style.outlineColor,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    (ent as any).__vmapOverlayEditHandle = true;
    (ent as any).__vmapOverlayEditHandleMeta = meta;
    return ent;
  }


  // =====================
  // Apply edited geometry
  // =====================

  private applyEditedPolygon(): void {
    if (!this.editingTarget) return;
    this.host.applyPolygonPositions(this.editingTarget, this.editingPositions);
  }

  private applyEditedRectangle(): void {
    if (!this.editingTarget) return;
    const rect = this.positionsToRectangle(this.editingPositions);
    if (!rect) return;
    this.host.applyRectangleCoordinates(this.editingTarget, rect);
  }

  private applyEditedCircle(): void {
    if (!this.editingTarget) return;
    if (!this.editingCircleCenter) return;
    this.host.applyCircle(this.editingTarget, this.editingCircleCenter, this.editingCircleRadiusMeters);
  }

  private applyEditedPolyline(): void {
    if (!this.editingTarget) return;
    this.host.applyPolylinePositions(this.editingTarget, this.editingPositions);
  }

  private applyEditedPoint(): void {
    if (!this.editingTarget || !this.editingPointPosition) return;
    this.host.applyPointPosition(this.editingTarget, this.editingPointPosition);
  }

  // =====================
  // Geometry helpers
  // =====================

  private getEditingClampToGround(): boolean {
    const target: any = this.editingTarget as any;
    if (target && typeof target._clampToGround === "boolean") return target._clampToGround;
    if (target?.polyline && (target.polyline as any).clampToGround !== undefined) {
      const v = this.getPropertyValue<any>((target.polyline as any).clampToGround, null);
      if (typeof v === "boolean") return v;
    }
    if (target?.point && (target.point as any).heightReference !== undefined) {
      const v = this.getPropertyValue<any>((target.point as any).heightReference, null);
      if (typeof v === "number") return v === Cesium.HeightReference.CLAMP_TO_GROUND;
    }
    if (target?.billboard && (target.billboard as any).heightReference !== undefined) {
      const v = this.getPropertyValue<any>((target.billboard as any).heightReference, null);
      if (typeof v === "number") return v === Cesium.HeightReference.CLAMP_TO_GROUND;
    }
    return true;
  }

  private getCartesianHeight(pos: Cesium.Cartesian3): number {
    try {
      const c = Cesium.Cartographic.fromCartesian(pos);
      return Number.isFinite(c.height) ? c.height : 0;
    } catch {
      return 0;
    }
  }

  private convertOutlineToLngLat(positions: Cesium.Cartesian3[]): Array<[number, number, number]> {
    const out: Array<[number, number, number]> = [];
    for (const p of positions) {
      try {
        if (!p) continue;
        const temp = this.convertPositionToLngLat(p);
        if (temp) out.push(temp);
      } catch {
        // ignore
      }
    }
    return out;
  }

  private convertPositionToLngLat(position: Cesium.Cartesian3): [number, number, number] | null {
    try {
      if (!position) return null;
      const carto = Cesium.Cartographic.fromCartesian(position);
      if (!carto || !Number.isFinite(carto.longitude) || !Number.isFinite(carto.latitude)) return null;
      return this.convertCartoToLngLat(carto);
    } catch {
      return null;
    }
  }

  private convertCartoToLngLat(carto: Cesium.Cartographic): [number, number, number] | null {
    try {
      if (!carto || !Number.isFinite(carto.longitude) || !Number.isFinite(carto.latitude)) return null;
      const lon = Cesium.Math.toDegrees(carto.longitude);
      const lat = Cesium.Math.toDegrees(carto.latitude);
      const h = Number.isFinite(carto.height) ? carto.height : 0;
      return [lon, lat, h];
    } catch {
      return null;
    }
  }

  private pickCartesianOnGlobe(windowPosition: Cesium.Cartesian2, heightOverride?: number): Cesium.Cartesian3 | null {
    const carto = this.host.pickCartographic(windowPosition);
    if (!carto) return null;
    const clampToGround = this.getEditingClampToGround();
    const h = clampToGround
      ? 0
      : (Number.isFinite(heightOverride) ? (heightOverride as number) : (Number.isFinite(carto.height) ? carto.height : 0));
    return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, h);
  }

  private computeSurfaceDistanceMeters(a: Cesium.Cartesian3, b: Cesium.Cartesian3): number {
    try {
      const ca = Cesium.Cartographic.fromCartesian(a);
      const cb = Cesium.Cartographic.fromCartesian(b);
      const g = new Cesium.EllipsoidGeodesic(ca, cb);
      const d = g.surfaceDistance;
      return Number.isFinite(d) ? d : Cesium.Cartesian3.distance(a, b);
    } catch {
      return Cesium.Cartesian3.distance(a, b);
    }
  }

  private circleRadiusHandlePosition(center: Cesium.Cartesian3, radiusMeters: number): Cesium.Cartesian3 {
    try {
      const carto = Cesium.Cartographic.fromCartesian(center);
      const R = 6378137.0;
      const dLon = Math.max(0, radiusMeters) / (R * Math.cos(carto.latitude));
      const lon2 = carto.longitude + dLon;
      return Cesium.Cartesian3.fromRadians(lon2, carto.latitude, 0);
    } catch {
      return center;
    }
  }

  private rectangleToPositions(rect: Cesium.Rectangle, heightMeters: number): Cesium.Cartesian3[] {
    const w = rect.west;
    const s = rect.south;
    const e = rect.east;
    const n = rect.north;
    return [
      Cesium.Cartesian3.fromRadians(w, s, heightMeters),
      Cesium.Cartesian3.fromRadians(e, s, heightMeters),
      Cesium.Cartesian3.fromRadians(e, n, heightMeters),
      Cesium.Cartesian3.fromRadians(w, n, heightMeters),
    ];
  }

  private rectangleToLngLatPositions(rect: Cesium.Rectangle, heightMeters: number): Array<[number, number, number]> {
    const w = rect.west;
    const s = rect.south;
    const e = rect.east;
    const n = rect.north;
    return [
      [Cesium.Math.toDegrees(w), Cesium.Math.toDegrees(s), heightMeters],
      [Cesium.Math.toDegrees(e), Cesium.Math.toDegrees(s), heightMeters],
      [Cesium.Math.toDegrees(e), Cesium.Math.toDegrees(n), heightMeters],
      [Cesium.Math.toDegrees(w), Cesium.Math.toDegrees(n), heightMeters],
    ];
  }

  private positionsToRectangle(positions: Cesium.Cartesian3[]): Cesium.Rectangle | null {
    if (!positions || positions.length < 2) return null;
    try {
      const cartos = positions.map((p) => Cesium.Cartographic.fromCartesian(p));
      const lons = cartos.map((c) => c.longitude).filter((v) => Number.isFinite(v));
      const lats = cartos.map((c) => c.latitude).filter((v) => Number.isFinite(v));
      if (lons.length === 0 || lats.length === 0) return null;
      const west = Math.min(...lons);
      const east = Math.max(...lons);
      const south = Math.min(...lats);
      const north = Math.max(...lats);
      return new Cesium.Rectangle(west, south, east, north);
    } catch {
      return null;
    }
  }

  private getRectangleEditHeight(entity: (DrawEntity & OverlayEntity)): number {
    const clampToGround = this.getEditingClampToGround();
    if (clampToGround) return 0;

    const anyEntity: any = entity as any;
    if (typeof anyEntity._baseHeight === "number" && Number.isFinite(anyEntity._baseHeight)) {
      return anyEntity._baseHeight as number;
    }

    if (entity.rectangle && (entity.rectangle as any).height !== undefined) {
      const h = this.getNumberProperty((entity.rectangle as any).height, 0);
      if (Number.isFinite(h)) return h;
    }

    if (entity._innerEntity && (entity._innerEntity as any).rectangle && (entity._innerEntity as any).rectangle.height !== undefined) {
      const h = this.getNumberProperty(((entity._innerEntity as any).rectangle as any).height, 0);
      if (Number.isFinite(h)) return h;
    }

    return 0;
  }

  private computePolygonCenterCartesian(positions: Cesium.Cartesian3[]): Cesium.Cartesian3 {
    try {
      const centerCarto = this.computePolygonCenterCartographic(positions);
      return Cesium.Cartesian3.fromRadians(centerCarto.longitude, centerCarto.latitude, 0);
    } catch {
      const sum = new Cesium.Cartesian3(0, 0, 0);
      for (const p of positions) {
        Cesium.Cartesian3.add(sum, p, sum);
      }
      const avg = Cesium.Cartesian3.multiplyByScalar(sum, 1 / Math.max(1, positions.length), new Cesium.Cartesian3());
      const carto = Cesium.Cartographic.fromCartesian(avg);
      return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0);
    }
  }

  private computePolygonCenterCartographic(positions: Cesium.Cartesian3[]): Cesium.Cartographic {
    let lonSum = 0;
    let latSum = 0;
    let count = 0;
    for (const p of positions) {
      const c = Cesium.Cartographic.fromCartesian(p);
      if (!c) continue;
      if (!Number.isFinite(c.longitude) || !Number.isFinite(c.latitude)) continue;
      lonSum += c.longitude;
      latSum += c.latitude;
      count += 1;
    }
    const n = Math.max(1, count);
    return new Cesium.Cartographic(lonSum / n, latSum / n, 0);
  }

  private computePolylineHandleRadius(positions: Cesium.Cartesian3[], center: Cesium.Cartesian3): number {
    let maxD = 0;
    for (const p of positions) {
      const d = this.computeSurfaceDistanceMeters(center, p);
      if (Number.isFinite(d) && d > maxD) maxD = d;
    }
    return Math.max(20, Math.min(1000, maxD * 0.4));
  }

  private offsetByMeters(center: Cesium.Cartesian3, meters: number, bearingDeg: number): Cesium.Cartesian3 {
    try {
      const carto = Cesium.Cartographic.fromCartesian(center);
      const R = 6378137.0;
      const bearing = Cesium.Math.toRadians(bearingDeg);
      const dLat = (meters * Math.cos(bearing)) / R;
      const dLon = (meters * Math.sin(bearing)) / (R * Math.cos(carto.latitude));
      const lon2 = carto.longitude + dLon;
      const lat2 = carto.latitude + dLat;
      const h = Number.isFinite(carto.height) ? carto.height : 0;
      return Cesium.Cartesian3.fromRadians(lon2, lat2, h);
    } catch {
      return center;
    }
  }

  private getLocalAngleAndDistance(center: Cesium.Cartesian3, world: Cesium.Cartesian3): { angle: number; distance: number } {
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(center);
    const inv = Cesium.Matrix4.inverse(enu, new Cesium.Matrix4());
    const local = Cesium.Matrix4.multiplyByPoint(inv, world, new Cesium.Cartesian3());
    const angle = Math.atan2(local.y, local.x);
    const distance = Math.sqrt(local.x * local.x + local.y * local.y);
    return { angle, distance };
  }

  private applyRotateScaleToPositions(
    positions: Cesium.Cartesian3[],
    center: Cesium.Cartesian3,
    angleDelta: number,
    scale: number
  ): Cesium.Cartesian3[] {
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(center);
    const inv = Cesium.Matrix4.inverse(enu, new Cesium.Matrix4());
    const cosA = Math.cos(angleDelta);
    const sinA = Math.sin(angleDelta);
    const out: Cesium.Cartesian3[] = [];

    for (const p of positions) {
      const local = Cesium.Matrix4.multiplyByPoint(inv, p, new Cesium.Cartesian3());
      const x = local.x * scale;
      const y = local.y * scale;
      const xr = x * cosA - y * sinA;
      const yr = x * sinA + y * cosA;
      const world = Cesium.Matrix4.multiplyByPoint(enu, new Cesium.Cartesian3(xr, yr, local.z), new Cesium.Cartesian3());
      out.push(world);
    }

    return out;
  }
}
