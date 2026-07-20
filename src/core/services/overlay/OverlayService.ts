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
  /** 覆盖物编辑变化回调 */
  onOverlayEditChange?: (entity: Entity) => void;
  /** 覆盖物编辑结束回调 */
  onOverlayEditEnd?: (entity: Entity | null) => void;
}

type OverlayEditKind = 'point' | 'polyline' | 'polygon' | 'rectangle' | 'circle';

interface OverlayEditHandleStyle {
  color: Cesium.Color;
  outlineColor: Cesium.Color;
  pixelSize: number;
}

interface OverlayEditCameraState {
  enableInputs: boolean;
  enableTranslate: boolean;
  enableRotate: boolean;
  enableTilt: boolean;
  enableLook: boolean;
}

interface OverlayEditState {
  entity: OverlayEntity;
  kind: OverlayEditKind;
  handles: Entity[];
  handler: Cesium.ScreenSpaceEventHandler;
  activeHandleIndex: number | null;
  controlPoints: Cesium.Cartesian3[];
  radiusMeters?: number;
  isDragging: boolean;
  cameraState: OverlayEditCameraState | null;
  previousCursor: string;
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
  private hoverEnabled: boolean;
  private nextId = 1;
  private clickHandler: Cesium.ScreenSpaceEventHandler | null = null;
  private hoverHandler: Cesium.ScreenSpaceEventHandler | null = null;
  private clickHighlightTargets: Entity[] = [];
  private hoverHighlightTargets: Entity[] = [];
  private lastClickPickAt = 0;
  private pendingHoverRaf: number | null = null;
  private pendingHoverPosition: Cesium.Cartesian2 | null = null;
  private readonly highlightCache = new WeakMap<Entity, OverlayGraphicsSnapshot>();
  private overlayEditEnabled = false;
  private overlayEditOptions: Record<string, any> = {};
  private overlayEditState: OverlayEditState | null = null;

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
      onOverlayEditChange: options.onOverlayEditChange ?? (() => undefined),
      onOverlayEditEnd: options.onOverlayEditEnd ?? (() => undefined),
    };
    this.hoverEnabled = this.options.enableHoverHandler;

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
    if (this.hoverEnabled) {
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
   * 动态开启/关闭 hover 高亮处理器。
   * 兼容旧版 overlayService 的运行时切换行为。
   */
  setHoverEnabled(enabled: boolean): void {
    const next = !!enabled;
    this.hoverEnabled = next;

    if (!next) {
      this.setHighlightTargets(this.hoverHighlightTargets, 'hover', false);
      this.hoverHighlightTargets = [];
      return;
    }

    if (this.hoverHandler === null) {
      this.setupHoverHandler();
    }
  }

  /**
   * 获取当前 hover 高亮开关状态。
   */
  isHoverEnabled(): boolean {
    return this.hoverEnabled;
  }

  setOverlayEditMode(enabled: boolean, overlayEditOptions?: Record<string, any>): void {
    this.overlayEditEnabled = !!enabled;
    if (overlayEditOptions) {
      this.overlayEditOptions = {
        ...this.overlayEditOptions,
        ...overlayEditOptions,
      };
    }

    if (!this.overlayEditEnabled) {
      this.stopOverlayEdit();
    }
  }

  getOverlayEditModeEnabled(): boolean {
    return this.overlayEditEnabled;
  }

  startOverlayEdit(entityOrId: OverlayEntity | Entity | string | number, overlayEditOptions?: Record<string, any>): boolean {
    const target = this.resolveEditableOverlay(entityOrId);
    if (!target) {
      return false;
    }

    const kind = this.detectEditableKind(target);
    if (!kind) {
      return false;
    }

    this.stopOverlayEdit();
    this.overlayEditEnabled = true;
    if (overlayEditOptions) {
      this.overlayEditOptions = {
        ...this.overlayEditOptions,
        ...overlayEditOptions,
      };
    }

    const controlPoints = this.resolveEditableControlPoints(target, kind);
    if (controlPoints.length === 0) {
      this.overlayEditEnabled = false;
      return false;
    }

    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    const state: OverlayEditState = {
      entity: target,
      kind,
      handles: [],
      handler,
      activeHandleIndex: null,
      controlPoints: controlPoints.map((point) => point.clone()),
      radiusMeters: kind === 'circle' ? this.resolveCircleRadius(target, controlPoints) : undefined,
      isDragging: false,
      cameraState: null,
      previousCursor: this.viewer.scene.canvas.style.cursor || '',
    };

    state.handles = this.createEditHandles(state);
    this.overlayEditState = state;

    handler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = this.viewer.scene.pick(click.position);
      const pickedEntity = this.resolvePickedEditHandle(picked);
      if (!pickedEntity) {
        return;
      }

      const index = state.handles.findIndex((handle) => handle === pickedEntity);
      if (index >= 0) {
        state.activeHandleIndex = index;
        state.isDragging = true;
        state.cameraState = this.suspendCameraControls();
        this.viewer.scene.canvas.style.cursor = 'grabbing';
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      if (state.activeHandleIndex === null) {
        return;
      }

      const position = this.pickEditPosition(movement.endPosition);
      if (!position) {
        return;
      }

      this.applyDragForHandle(state, state.activeHandleIndex, position);
      this.syncEditHandles(state);
      this.emitOverlayEditChange(state.entity);
      this.viewer.scene.requestRender();
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction(() => {
      this.releaseEditDrag(state);
      state.activeHandleIndex = null;
    }, Cesium.ScreenSpaceEventType.LEFT_UP);

    handler.setInputAction(() => {
      this.stopOverlayEdit();
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    return true;
  }

  stopOverlayEdit(): Entity | null {
    const state = this.overlayEditState;
    if (!state) {
      return null;
    }

    const entity = state.entity;
    this.releaseEditDrag(state);
    state.handles.forEach((handle) => {
      this.viewer.entities.remove(handle);
    });
    state.handler.destroy();
    this.overlayEditState = null;
    this.overlayEditEnabled = false;
    this.emitOverlayEditEnd(entity);
    this.viewer.scene.requestRender();
    return entity;
  }

  private suspendCameraControls(): OverlayEditCameraState {
    const controller = this.viewer.scene.screenSpaceCameraController;
    const snapshot: OverlayEditCameraState = {
      enableInputs: controller.enableInputs,
      enableTranslate: controller.enableTranslate,
      enableRotate: controller.enableRotate,
      enableTilt: controller.enableTilt,
      enableLook: controller.enableLook,
    };

    controller.enableInputs = false;
    controller.enableTranslate = false;
    controller.enableRotate = false;
    controller.enableTilt = false;
    controller.enableLook = false;

    return snapshot;
  }

  private restoreCameraControls(snapshot: OverlayEditCameraState | null): void {
    if (!snapshot) {
      return;
    }

    const controller = this.viewer.scene.screenSpaceCameraController;
    controller.enableInputs = snapshot.enableInputs;
    controller.enableTranslate = snapshot.enableTranslate;
    controller.enableRotate = snapshot.enableRotate;
    controller.enableTilt = snapshot.enableTilt;
    controller.enableLook = snapshot.enableLook;
  }

  private releaseEditDrag(state: OverlayEditState): void {
    if (!state.isDragging && !state.cameraState) {
      return;
    }

    this.restoreCameraControls(state.cameraState);
    state.cameraState = null;
    state.isDragging = false;
    this.viewer.scene.canvas.style.cursor = state.previousCursor;
  }

  private resolveEditableOverlay(entityOrId: OverlayEntity | Entity | string | number): OverlayEntity | null {
    if (typeof entityOrId === 'string' || typeof entityOrId === 'number') {
      const overlay = this.overlays.get(String(entityOrId));
      return overlay?.getEntity() as OverlayEntity | null;
    }

    if (this.entityOverlayMap.has(entityOrId as Entity)) {
      return this.entityOverlayMap.get(entityOrId as Entity)?.getEntity() as OverlayEntity | null;
    }

    return entityOrId as OverlayEntity;
  }

  private detectEditableKind(entity: OverlayEntity): OverlayEditKind | null {
    const overlayType = String((entity as any)._overlayType ?? '');
    if (
      overlayType === 'circle-primitive' ||
      overlayType === 'circle' ||
      entity.ellipse ||
      (entity as any)._outerRadius !== undefined ||
      (entity as any)._centerCartographic !== undefined
    ) return 'circle';
    if (overlayType === 'polygon-primitive' || entity.polygon) return 'polygon';
    if (
      overlayType === 'rectangle-primitive' ||
      overlayType === 'rectangle' ||
      entity.rectangle ||
      (entity as any)._outerRectangle !== undefined
    ) return 'rectangle';
    if (entity.point) return 'point';
    if (entity.polyline) return 'polyline';
    return null;
  }

  private resolveEditableControlPoints(entity: OverlayEntity, kind: OverlayEditKind): Cesium.Cartesian3[] {
    if (kind === 'point') {
      const pos = this.getEntityPosition(entity);
      return pos ? [pos] : [];
    }

    if (kind === 'polyline') {
      return this.getPolylinePositions(entity);
    }

    if (kind === 'polygon') {
      return this.getPolygonPositions(entity);
    }

    if (kind === 'rectangle') {
      const rect = this.getRectangleCoordinates(entity);
      return rect ? this.rectangleToPositions(rect, this.getRectangleHeight(entity)) : [];
    }

    if (kind === 'circle') {
      const info = this.getCircleInfo(entity);
      return info ? [info.center, info.radiusHandle] : [];
    }

    return [];
  }

  private createEditHandles(state: OverlayEditState): Entity[] {
    const handles: Entity[] = [];
    const style = this.resolveHandleStyle();

    state.controlPoints.forEach((position, index) => {
      handles.push(this.viewer.entities.add({
        id: `${String(state.entity.id)}__edit_handle_${index}`,
        position: new Cesium.ConstantPositionProperty(position.clone()),
        point: {
          pixelSize: style.pixelSize,
          color: style.color,
          outlineColor: style.outlineColor,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      }));
    });

    return handles;
  }

  private resolveHandleStyle(): OverlayEditHandleStyle {
    const options = this.overlayEditOptions || {};
    const vertex = options.vertex && typeof options.vertex === 'object' ? options.vertex : {};
    return {
      color: this.resolveHandleColor(vertex.color ?? '#1e88e5', Cesium.Color.fromCssColorString('#1e88e5')),
      outlineColor: this.resolveHandleColor(vertex.outlineColor ?? '#ffffff', Cesium.Color.WHITE),
      pixelSize: typeof vertex.pixelSize === 'number' ? vertex.pixelSize : 10,
    };
  }

  private resolveHandleColor(color: Cesium.Color | string | undefined, fallback: Cesium.Color): Cesium.Color {
    if (color instanceof Cesium.Color) {
      return color;
    }

    if (typeof color === 'string') {
      try {
        return Cesium.Color.fromCssColorString(color);
      } catch {
        return fallback;
      }
    }

    return fallback;
  }

  private resolvePickedEditHandle(pickedObject: any): Entity | null {
    const candidate = pickedObject?.id instanceof Cesium.Entity
      ? pickedObject.id
      : pickedObject?.primitive instanceof Cesium.Entity
        ? pickedObject.primitive
        : null;

    if (!candidate) {
      return null;
    }

    return this.overlayEditState?.handles.includes(candidate) ? candidate : null;
  }

  private pickEditPosition(position: Cesium.Cartesian2): Cesium.Cartesian3 | null {
    const ray = this.viewer.camera.getPickRay(position);
    if (ray) {
      const picked = this.viewer.scene.globe.pick(ray, this.viewer.scene);
      if (picked) {
        return picked;
      }
    }

    return this.viewer.camera.pickEllipsoid(position, this.viewer.scene.globe.ellipsoid) ?? null;
  }

  private applyDragForHandle(state: OverlayEditState, handleIndex: number, position: Cesium.Cartesian3): void {
    const kind = state.kind;
    if (kind === 'point') {
      state.controlPoints[0] = position.clone();
      this.applyPointPosition(state.entity, position);
      return;
    }

    if (kind === 'polyline') {
      state.controlPoints[handleIndex] = position.clone();
      this.applyPolylinePositions(state.entity, state.controlPoints);
      return;
    }

    if (kind === 'polygon') {
      state.controlPoints[handleIndex] = position.clone();
      this.applyPolygonPositions(state.entity, state.controlPoints);
      return;
    }

    if (kind === 'rectangle') {
      state.controlPoints[handleIndex] = position.clone();
      const rect = this.positionsToRectangle(state.controlPoints);
      if (rect) {
        this.applyRectangleCoordinates(state.entity, rect);
      }
      return;
    }

    if (kind === 'circle') {
      if (handleIndex === 0) {
        const radius = state.radiusMeters ?? this.resolveCircleRadius(state.entity, state.controlPoints);
        state.controlPoints[0] = position.clone();
        const nextRadius = Number.isFinite(radius) ? radius : this.calculateCircleRadiusMeters(position, state.controlPoints[1] ?? position);
        this.applyCircle(state.entity, position, nextRadius);
        state.radiusMeters = nextRadius;
        state.controlPoints[1] = this.circleRadiusHandlePosition(position, nextRadius);
        return;
      }

      const center = state.controlPoints[0];
      const radius = this.calculateCircleRadiusMeters(center, position);
      state.controlPoints[1] = position.clone();
      state.radiusMeters = radius;
      this.applyCircle(state.entity, center, radius);
      return;
    }
  }

  private syncEditHandles(state: OverlayEditState): void {
    const style = this.resolveHandleStyle();

    if (state.kind === 'point') {
      if (state.handles[0]) {
        state.handles[0].position = new Cesium.ConstantPositionProperty(state.controlPoints[0].clone());
      }
      return;
    }

    if (state.kind === 'rectangle') {
      const rect = this.positionsToRectangle(state.controlPoints);
      if (!rect) {
        return;
      }
      const corners = this.rectangleToPositions(rect, this.getRectangleHeight(state.entity));
      corners.forEach((corner, index) => {
        if (state.handles[index]) {
          state.handles[index].position = new Cesium.ConstantPositionProperty(corner);
        }
      });
      return;
    }

    if (state.kind === 'circle') {
      const center = state.controlPoints[0];
      const radius = state.radiusMeters ?? this.resolveCircleRadius(state.entity, state.controlPoints);
      if (state.handles[0]) {
        state.handles[0].position = new Cesium.ConstantPositionProperty(center.clone());
      }
      if (state.handles[1] && Number.isFinite(radius)) {
        state.handles[1].position = new Cesium.ConstantPositionProperty(this.circleRadiusHandlePosition(center, radius));
      }
      return;
    }

    state.controlPoints.forEach((point, index) => {
      if (state.handles[index]) {
        state.handles[index].position = new Cesium.ConstantPositionProperty(point.clone());
      }
    });
  }

  private emitOverlayEditChange(entity: OverlayEntity): void {
    this.options.onOverlayEditChange?.(entity);
  }

  private emitOverlayEditEnd(entity: OverlayEntity | null): void {
    this.options.onOverlayEditEnd?.(entity);
  }

  private applyPointPosition(entity: OverlayEntity, position: Cesium.Cartesian3): void {
    const overlay = this.entityOverlayMap.get(entity as Entity);
    if (overlay && typeof (overlay as any).setPosition === 'function') {
      (overlay as any).setPosition(position);
      return;
    }

    entity.position = new Cesium.ConstantPositionProperty(position.clone());
  }

  private applyPolylinePositions(entity: OverlayEntity, positions: Cesium.Cartesian3[]): void {
    const overlay = this.entityOverlayMap.get(entity as Entity);
    if (overlay && typeof (overlay as any).setPositions === 'function') {
      (overlay as any).setPositions(positions.map((point) => point.clone()));
      return;
    }

    if (entity.polyline) {
      entity.polyline.positions = new Cesium.ConstantProperty(positions.map((point) => point.clone()));
    }
  }

  private applyPolygonPositions(entity: OverlayEntity, positions: Cesium.Cartesian3[]): void {
    const overlay = this.entityOverlayMap.get(entity as Entity);
    if (overlay && typeof (overlay as any).setPositions === 'function') {
      (overlay as any).setPositions(positions.map((point) => point.clone()));
      return;
    }

    if (entity.polygon) {
      entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(positions.map((point) => point.clone())));
    }
  }

  private applyRectangleCoordinates(entity: OverlayEntity, rect: Cesium.Rectangle): void {
    const overlay = this.entityOverlayMap.get(entity as Entity);
    if (overlay && typeof (overlay as any).setCoordinates === 'function') {
      (overlay as any).setCoordinates(Cesium.Rectangle.clone(rect));
      return;
    }

    if (entity.rectangle) {
      entity.rectangle.coordinates = new Cesium.ConstantProperty(Cesium.Rectangle.clone(rect));
      return;
    }

    if (entity.polygon) {
      const positions = this.rectangleToPositions(rect, this.getRectangleHeight(entity));
      entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(positions));
    }
  }

  private applyCircle(entity: OverlayEntity, center: Cesium.Cartesian3, radiusMeters: number): void {
    const overlay = this.entityOverlayMap.get(entity as Entity);
    if (overlay) {
      if (typeof (overlay as any).setPosition === 'function') {
        (overlay as any).setPosition(center.clone());
      } else {
        entity.position = new Cesium.ConstantPositionProperty(center.clone());
      }

      if (typeof (overlay as any).setRadius === 'function') {
        (overlay as any).setRadius(radiusMeters);
        return;
      }
    }

    const centerCarto = Cesium.Cartographic.fromCartesian(center);
    if (!centerCarto) {
      return;
    }

    if (entity.ellipse) {
      entity.position = new Cesium.ConstantPositionProperty(center.clone());
      entity.ellipse.semiMajorAxis = new Cesium.ConstantProperty(radiusMeters);
      entity.ellipse.semiMinorAxis = new Cesium.ConstantProperty(radiusMeters);
      return;
    }

    if ((entity as any)._outerRadius !== undefined) {
      (entity as any)._outerRadius = radiusMeters;
      (entity as any)._centerCartographic = new Cesium.Cartographic(centerCarto.longitude, centerCarto.latitude, centerCarto.height ?? 0);
    }
  }

  private getEntityPosition(entity: OverlayEntity): Cesium.Cartesian3 | null {
    if (entity.position) {
      const value = entity.position.getValue(Cesium.JulianDate.now());
      if (value) {
        return value.clone();
      }
    }

    return null;
  }

  private getPolylinePositions(entity: OverlayEntity): Cesium.Cartesian3[] {
    if (entity.polyline?.positions) {
      const value = entity.polyline.positions.getValue(Cesium.JulianDate.now());
      if (Array.isArray(value)) {
        return value.map((point) => point.clone());
      }
    }

    return [];
  }

  private getPolygonPositions(entity: OverlayEntity): Cesium.Cartesian3[] {
    if ((entity as any)._overlayType === 'polygon-primitive') {
      const outline = (entity as any)._primitiveOutlinePositions as Cesium.Cartesian3[] | undefined;
      if (Array.isArray(outline) && outline.length > 0) {
        const points = outline.length > 1 && Cesium.Cartesian3.equals(outline[0], outline[outline.length - 1])
          ? outline.slice(0, -1)
          : outline.slice();
        return points.map((point) => point.clone());
      }
    }

    if (entity.polygon?.hierarchy) {
      const value = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now());
      const positions = Array.isArray(value) ? value : value?.positions;
      if (Array.isArray(positions)) {
        return positions.map((point) => point.clone());
      }
    }

    return [];
  }

  private getRectangleCoordinates(entity: OverlayEntity): Cesium.Rectangle | null {
    if (entity.rectangle?.coordinates) {
      const rect = entity.rectangle.coordinates.getValue(Cesium.JulianDate.now());
      if (rect) {
        return Cesium.Rectangle.clone(rect);
      }
    }

    if ((entity as any)._outerRectangle) {
      return Cesium.Rectangle.clone((entity as any)._outerRectangle);
    }

    return null;
  }

  private getRectangleHeight(entity: OverlayEntity): number {
    if (entity.rectangle && (entity.rectangle as any).height !== undefined) {
      const height = (entity.rectangle as any).height.getValue?.(Cesium.JulianDate.now());
      return Number.isFinite(height) ? Number(height) : 0;
    }

    return 0;
  }

  private resolveCircleRadius(entity: OverlayEntity, controlPoints: Cesium.Cartesian3[]): number {
    if (controlPoints.length >= 2) {
      return this.calculateCircleRadiusMeters(controlPoints[0], controlPoints[1]);
    }

    if (entity.ellipse?.semiMajorAxis) {
      const radius = entity.ellipse.semiMajorAxis.getValue(Cesium.JulianDate.now());
      if (Number.isFinite(radius)) {
        return Number(radius);
      }
    }

    const root: any = entity as any;
    if (Number.isFinite(root._outerRadius)) {
      return Number(root._outerRadius);
    }

    return 0;
  }

  private getCircleInfo(entity: OverlayEntity): { center: Cesium.Cartesian3; radiusHandle: Cesium.Cartesian3 } | null {
    const center = this.getEntityPosition(entity);
    if (!center) {
      return null;
    }

    const radius = this.resolveCircleRadius(entity, [center]);
    if (!(radius > 0)) {
      return null;
    }

    return {
      center,
      radiusHandle: this.circleRadiusHandlePosition(center, radius),
    };
  }

  private calculateCircleRadiusMeters(center: Cesium.Cartesian3, edge: Cesium.Cartesian3): number {
    const centerCarto = Cesium.Cartographic.fromCartesian(center);
    const edgeCarto = Cesium.Cartographic.fromCartesian(edge);
    if (!centerCarto || !edgeCarto) {
      return 0;
    }

    const earthRadius = 6378137.0;
    const deltaLatitude = edgeCarto.latitude - centerCarto.latitude;
    const deltaLongitude = edgeCarto.longitude - centerCarto.longitude;
    const a = Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2)
      + Math.cos(centerCarto.latitude) * Math.cos(edgeCarto.latitude)
      * Math.sin(deltaLongitude / 2) * Math.sin(deltaLongitude / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadius * c;
  }

  private circleRadiusHandlePosition(center: Cesium.Cartesian3, radiusMeters: number): Cesium.Cartesian3 {
    const carto = Cesium.Cartographic.fromCartesian(center);
    if (!carto) {
      return center.clone();
    }

    const R = 6378137.0;
    const dLon = Math.max(0, radiusMeters) / (R * Math.max(Math.cos(carto.latitude), 1e-6));
    return Cesium.Cartesian3.fromRadians(carto.longitude + dLon, carto.latitude, carto.height ?? 0);
  }

  private rectangleToPositions(rect: Cesium.Rectangle, heightMeters: number): Cesium.Cartesian3[] {
    return [
      Cesium.Cartesian3.fromRadians(rect.west, rect.south, heightMeters),
      Cesium.Cartesian3.fromRadians(rect.east, rect.south, heightMeters),
      Cesium.Cartesian3.fromRadians(rect.east, rect.north, heightMeters),
      Cesium.Cartesian3.fromRadians(rect.west, rect.north, heightMeters),
    ];
  }

  private positionsToRectangle(positions: Cesium.Cartesian3[]): Cesium.Rectangle | null {
    if (positions.length < 2) {
      return null;
    }

    const cartographics = positions
      .map((position) => Cesium.Cartographic.fromCartesian(position))
      .filter((item): item is Cesium.Cartographic => !!item);

    if (cartographics.length < 2) {
      return null;
    }

    const west = Math.min(...cartographics.map((item) => item.longitude));
    const east = Math.max(...cartographics.map((item) => item.longitude));
    const south = Math.min(...cartographics.map((item) => item.latitude));
    const north = Math.max(...cartographics.map((item) => item.latitude));
    return new Cesium.Rectangle(west, south, east, north);
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
      if (!this.hoverEnabled) {
        clearHover();
        return;
      }

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

    if (candidate) {
      const overlay = this.entityOverlayMap.get(candidate);
      if (!overlay) {
        return null;
      }

      return overlay.getEntity() as OverlayEntity;
    }

    const pickId = pickedObject?.id;
    if (typeof pickId === 'string' || typeof pickId === 'number') {
      const normalized = this.resolveOverlayByPickId(pickId);
      return normalized;
    }

    const primitiveId = pickedObject?.primitive?.id;
    if (typeof primitiveId === 'string' || typeof primitiveId === 'number') {
      return this.resolveOverlayByPickId(primitiveId);
    }

    return null;
  }

  private resolveOverlayByPickId(raw: string | number): OverlayEntity | null {
    const id = String(raw);
    const direct = this.overlays.get(id);
    if (direct) {
      return direct.getEntity() as OverlayEntity;
    }

    const rootId = id.replace(/__(fill|border|outer)$/, '');
    if (rootId !== id) {
      const root = this.overlays.get(rootId);
      if (root) {
        return root.getEntity() as OverlayEntity;
      }
    }

    return null;
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
    if ((entity as any)._overlayType === 'circle-primitive' || (entity as any)._overlayType === 'polygon-primitive') {
      const hlColor = this.resolveHighlightColor(options.color);
      try {
        const overlay = this.entityOverlayMap.get(entity);
        if (overlay && typeof (overlay as any).applyPrimitiveHighlight === 'function') {
          (overlay as any).applyPrimitiveHighlight(entity as Entity, hlColor, options.fillAlpha);
        }
      } catch {
        // ignore
      }
      return;
    }

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
    if ((entity as any)._overlayType === 'circle-primitive' || (entity as any)._overlayType === 'polygon-primitive') {
      try {
        const overlay = this.entityOverlayMap.get(entity);
        if (overlay && typeof (overlay as any).restorePrimitiveHighlight === 'function') {
          (overlay as any).restorePrimitiveHighlight(entity as Entity);
        }
      } catch {
        // ignore
      }
      return;
    }

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
    try {
      if (typeof this.viewer?.isDestroyed === 'function' && this.viewer.isDestroyed()) {
        this.overlays.clear();
        return;
      }
    } catch {
      this.overlays.clear();
      return;
    }
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
    this.viewer.entities.add(infoWindow.getEntity());
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
    if ((polygon.getEntity() as any)._overlayType !== 'polygon-primitive') {
      this.viewer.entities.add(polygon.getEntity());
    }
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
    if ((circle.getEntity() as any)._overlayType !== 'circle-primitive') {
      this.viewer.entities.add(circle.getEntity());
    }
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
