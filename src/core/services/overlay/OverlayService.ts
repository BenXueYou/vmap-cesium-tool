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
import { resolveOverlayPickCandidates } from './OverlayPickResolver';
import { PickGovernor, type PickGovernorOptions } from '../../../utils/PickGovernor';

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

export type OverlaySelectionChangeReason =
  | 'pointer-select'
  | 'pointer-toggle-off'
  | 'empty-click'
  | 'api-select'
  | 'api-clear'
  | 'disabled';

export interface OverlaySelectionChangeEvent {
  current: OverlayEntity | null;
  previous: OverlayEntity | null;
  currentId: string | null;
  previousId: string | null;
  reason: OverlaySelectionChangeReason;
}

type OverlaySelectionChangeListener = (event: OverlaySelectionChangeEvent) => void;

interface ResolvedOverlayPickingOptions {
  enabled: boolean;
  hover: boolean;
  selection: boolean;
  pickWidth: number;
  pickHeight: number;
  drillLimit: number;
  clickDebounceMs: number;
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
  private readonly picking: ResolvedOverlayPickingOptions;
  private readonly pickGovernor: PickGovernor;
  private hoverEnabled: boolean;
  private selectionEnabled: boolean;
  private readonly creationOrderById = new Map<string, number>();
  private nextCreationOrder = 1;
  private nextId = 1;
  private clickHandler: Cesium.ScreenSpaceEventHandler | null = null;
  private hoverHandler: Cesium.ScreenSpaceEventHandler | null = null;
  private clickHighlightTargets: Entity[] = [];
  private hoverHighlightTargets: Entity[] = [];
  private selectedOverlayId: string | null = null;
  private readonly selectionListeners = new Set<OverlaySelectionChangeListener>();
  private lastClickPickAt = 0;
  private pendingHoverRaf: number | null = null;
  private pendingHoverPosition: Cesium.Cartesian2 | null = null;
  private lastHoverPosition: Cesium.Cartesian2 | null = null;
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
      clickPickMinIntervalMs: options.clickPickMinIntervalMs ?? 250,
      picking: options.picking ?? {},
      onOverlayEditChange: options.onOverlayEditChange ?? (() => undefined),
      onOverlayEditEnd: options.onOverlayEditEnd ?? (() => undefined),
    };
    const grouped = options.picking ?? {};
    this.picking = {
      enabled: grouped.enabled ?? true,
      hover: grouped.hover ?? options.enableHoverHandler ?? true,
      selection: grouped.selection ?? true,
      pickWidth: this.normalizePositiveInteger(grouped.pickWidth, 3),
      pickHeight: this.normalizePositiveInteger(grouped.pickHeight, 3),
      drillLimit: this.normalizePositiveInteger(grouped.drillLimit, 16),
      clickDebounceMs: this.normalizeNonNegativeNumber(
        grouped.clickDebounceMs,
        options.clickPickMinIntervalMs ?? 250,
      ),
    };
    this.pickGovernor = new PickGovernor({ profiles: grouped.governorProfiles });
    this.hoverEnabled = this.picking.enabled && this.picking.hover;
    this.selectionEnabled = true;

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
    if (!this.creationOrderById.has(id)) {
      this.creationOrderById.set(id, this.nextCreationOrder++);
    }
    const rootEntity = overlay.getEntity() as OverlayEntity;
    if (!Number.isFinite(rootEntity._pickPriority)) {
      rootEntity._pickPriority = 0;
    }
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
    this.creationOrderById.delete(id);
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
   * 获取当前选中的覆盖物根实体。
   */
  getSelectedOverlay(): OverlayEntity | null {
    if (!this.selectedOverlayId) {
      return null;
    }

    return this.getOverlay(this.selectedOverlayId)?.getEntity() as OverlayEntity | null;
  }

  /**
   * 获取当前选中的覆盖物 ID。
   */
  getSelectedOverlayId(): string | null {
    return this.selectedOverlayId;
  }

  /**
   * 订阅选中态变化。
   */
  onSelectionChange(listener: OverlaySelectionChangeListener): () => void {
    this.selectionListeners.add(listener);
    return () => {
      this.selectionListeners.delete(listener);
    };
  }

  /**
   * 通过实体或 ID 选中覆盖物。
   */
  selectOverlay(entityOrId: OverlayEntity | Entity | string): boolean {
    const entity = this.resolveSelectionEntity(entityOrId);
    if (!entity) {
      return false;
    }

    if (this.selectedOverlayId === String(entity.id)) {
      return true;
    }

    this.commitSelection(entity, 'api-select');
    return true;
  }

  /**
   * 清空当前选中态。
   */
  clearSelection(): boolean {
    if (!this.selectedOverlayId) {
      return false;
    }

    this.commitSelection(null, 'api-clear');
    return true;
  }

  /**
   * 设置覆盖物是否允许参与 pointer / API 选中。
   */
  setOverlaySelectable(entityOrId: OverlayEntity | Entity | string, selectable: boolean): boolean {
    const entity = this.resolveOverlayEntity(entityOrId);
    if (!entity || typeof entity.id !== 'string') {
      return false;
    }

    const overlay = this.overlays.get(String(entity.id));
    if (!overlay) {
      return false;
    }

    const root = overlay.getEntity() as OverlayEntity;
    root._selectable = !!selectable;

    if (!selectable && this.selectedOverlayId === String(root.id) && !this.isSelectionOwnedByEditTarget(root)) {
      this.commitSelection(null, 'disabled');
    }

    return true;
  }

  /**
   * 动态开启/关闭 pointer selection。
   */
  setSelectionEnabled(enabled: boolean): void {
    this.selectionEnabled = !!enabled;
  }

  /**
   * 运行时更新覆盖物的拾取优先级。
   */
  setOverlayPickPriority(entityOrId: OverlayEntity | Entity | string, pickPriority: number): boolean {
    if (!Number.isFinite(pickPriority)) {
      return false;
    }

    const entity = this.resolveOverlayEntity(entityOrId);
    if (!entity || typeof entity.id !== 'string') {
      return false;
    }

    const overlay = this.overlays.get(String(entity.id));
    if (!overlay) {
      return false;
    }

    const root = overlay.getEntity() as OverlayEntity;
    if (root._pickPriority === pickPriority) {
      return true;
    }

    root._pickPriority = pickPriority;
    if (this.hoverEnabled) {
      this.refreshHover();
    }

    return true;
  }

  /**
   * 基于最近一次有效鼠标位置立即重算 hover。
   */
  refreshHover(): boolean {
    if (!this.hoverEnabled) {
      return false;
    }

    const pickPosition = this.getLatestHoverPosition();
    if (!pickPosition) {
      return false;
    }

    this.cancelPendingHoverFrame();
    this.pendingHoverPosition = null;
    return this.updateHoverAtPosition(pickPosition, false);
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

    this.clearSelectionForOverlay(id);
    this.clearOverlayHighlightState(overlay);
    this.unbindOverlayEntities(overlay);
    overlay.remove();
    this.overlays.delete(id);
    this.creationOrderById.delete(id);
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
      this.clearSelectionForOverlay(id);
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
    this.hoverEnabled = this.picking.enabled && this.picking.hover && next;

    if (!next) {
      this.setHighlightTargets(this.hoverHighlightTargets, 'hover', false);
      this.hoverHighlightTargets = [];
      return;
    }

    if (this.hoverEnabled && this.hoverHandler === null) {
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

  private resolveSelectionEntity(entityOrId: OverlayEntity | Entity | string): OverlayEntity | null {
    const entity = this.resolveOverlayEntity(entityOrId);
    if (!entity || entity.show === false || typeof entity.id !== 'string') {
      return null;
    }

    const overlay = this.overlays.get(entity.id);
    if (!overlay) {
      return null;
    }

    const root = overlay.getEntity() as OverlayEntity;
    if (!this.isOverlaySelectable(root)) {
      return null;
    }

    return root;
  }

  private commitSelection(next: OverlayEntity | null, reason: OverlaySelectionChangeReason): void {
    const previous = this.getSelectedOverlay();
    const previousId = previous?.id ? String(previous.id) : null;
    const currentId = next?.id ? String(next.id) : null;

    if (previousId === currentId) {
      return;
    }

    if (this.clickHighlightTargets.length > 0) {
      this.setHighlightTargets(this.clickHighlightTargets, 'click', false);
    }
    this.clickHighlightTargets = [];
    this.selectedOverlayId = currentId;

    if (next) {
      const targets = this.getHighlightTargets(next, 'click');
      this.clickHighlightTargets = targets;
      if (targets.length > 0) {
        this.setHighlightTargets(targets, 'click', true);
      }
    }

    this.emitSelectionChange({
      current: next,
      previous,
      currentId,
      previousId,
      reason,
    });
  }

  private clearSelectionForOverlay(id: string): void {
    if (this.selectedOverlayId !== id) {
      return;
    }

    if (this.clickHighlightTargets.length > 0) {
      this.setHighlightTargets(this.clickHighlightTargets, 'click', false);
    }
    this.clickHighlightTargets = [];
    this.selectedOverlayId = null;
  }

  private emitSelectionChange(event: OverlaySelectionChangeEvent): void {
    this.selectionListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.warn('[OverlayService] selection listener failed:', error);
      }
    });
  }

  private invokeOverlayClickCallback(entity: OverlayEntity): void {
    if (!entity._onClick) {
      return;
    }

    try {
      entity._onClick(entity);
    } catch (error) {
      console.warn('[OverlayService] overlay click callback failed:', error);
    }
  }

  private handlePointerSelectionClick(overlayEntity: OverlayEntity | null): void {
    if (overlayEntity && !this.isOverlaySelectable(overlayEntity)) {
      overlayEntity = null;
    }

    if (!overlayEntity) {
      if (this.selectedOverlayId) {
        this.commitSelection(null, 'empty-click');
      } else if (this.clickHighlightTargets.length > 0) {
        this.setHighlightTargets(this.clickHighlightTargets, 'click', false);
        this.clickHighlightTargets = [];
      }
      return;
    }

    const overlayId = String(overlayEntity.id);
    if (this.selectedOverlayId === overlayId) {
      this.commitSelection(null, 'pointer-toggle-off');
      this.invokeOverlayClickCallback(overlayEntity);
      return;
    }

    this.commitSelection(overlayEntity, 'pointer-select');
    this.invokeOverlayClickCallback(overlayEntity);
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

  private normalizePositiveInteger(value: number | undefined, fallback: number): number {
    return Number.isFinite(value) && value! > 0 ? Math.max(1, Math.floor(value!)) : fallback;
  }

  private normalizeNonNegativeNumber(value: number | undefined, fallback: number): number {
    return Number.isFinite(value) && value! >= 0 ? value! : fallback;
  }

  /**
   * 安装 Hover 处理器
   */
  private setupHoverHandler(): void {
    this.hoverHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    this.hoverHandler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      if (!this.hoverEnabled) {
        this.clearHoverTargets();
        return;
      }

      if (!movement.endPosition) {
        this.clearHoverTargets(true);
        return;
      }

      this.pendingHoverPosition = this.cloneWindowPosition(movement.endPosition);
      if (this.pendingHoverRaf !== null) {
        return;
      }

      this.pendingHoverRaf = globalThis.requestAnimationFrame(() => {
        this.pendingHoverRaf = null;

        const pickPosition = this.pendingHoverPosition;
        this.pendingHoverPosition = null;
        if (!this.hoverEnabled) {
          this.clearHoverTargets();
          return;
        }
        if (!pickPosition) {
          this.clearHoverTargets();
          return;
        }
        this.updateHoverAtPosition(pickPosition, true);
      });
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    this.viewer.scene.canvas.addEventListener('mouseleave', () => {
      this.cancelPendingHoverFrame();
      this.clearHoverTargets(true);
    });
  }

  /**
   * 安装点击处理器
   */
  private setupClickHandler(): void {
    this.clickHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    this.clickHandler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (!this.picking.enabled || !this.picking.selection || !this.selectionEnabled) {
        return;
      }

      const now = Date.now();
      if (now - this.lastClickPickAt < this.picking.clickDebounceMs) {
        return;
      }

      this.lastClickPickAt = now;
      const overlayEntity = this.pickOverlayEntity(click.position, 'click');
      this.handlePointerSelectionClick(overlayEntity);
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
    const candidates = resolveOverlayPickCandidates(pickedObjects, {
      reason,
      resolveRoot: (pickedObject) => this.resolvePickedOverlayRoot(pickedObject),
      isEligible: ({ root }, pickReason) => {
        if (root.show === false) {
          return false;
        }

        if (pickReason === 'hover') {
          return !!root._hoverHighlight;
        }

        return this.isOverlaySelectable(root);
      },
    });

    return candidates[0]?.root ?? null;
  }

  private safeDrillPick(windowPosition: Cesium.Cartesian2): any[] {
    try {
      const picks = this.viewer.scene.drillPick(
        windowPosition,
        this.picking.drillLimit,
        this.picking.pickWidth,
        this.picking.pickHeight,
      );
      return Array.isArray(picks) ? picks : [];
    } catch {
      return [];
    }
  }

  private resolvePickedOverlayRoot(pickedObject: any): {
    overlayId: string;
    root: OverlayEntity;
    pickPriority: number;
    creationOrder: number;
  } | null {
    const root = this.resolvePickedOverlayEntity(pickedObject);
    if (!root || typeof root.id !== 'string') {
      return null;
    }

    const overlayId = String(root.id);
    const creationOrder = this.creationOrderById.get(overlayId);
    if (creationOrder === undefined) {
      return null;
    }

    return {
      overlayId,
      root,
      pickPriority: Number.isFinite(root._pickPriority) ? root._pickPriority! : 0,
      creationOrder,
    };
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

    const mappedOverlay = this.entityOverlayMap.get(entityOrId as Entity);
    if (mappedOverlay) {
      return mappedOverlay.getEntity() as OverlayEntity;
    }

    const overlayId = (entityOrId as OverlayEntity)._overlayId;
    if (typeof overlayId === 'string') {
      const rootOverlay = this.overlays.get(overlayId);
      if (rootOverlay) {
        return rootOverlay.getEntity() as OverlayEntity;
      }
    }

    if (typeof entityOrId.id === 'string') {
      const rootOverlay = this.overlays.get(String(entityOrId.id));
      if (rootOverlay) {
        return rootOverlay.getEntity() as OverlayEntity;
      }
    }

    return entityOrId as OverlayEntity;
  }

  private isOverlaySelectable(entity: OverlayEntity): boolean {
    if (entity._selectable !== undefined) {
      return entity._selectable;
    }

    return !!entity._selectableInferred;
  }

  private isSelectionOwnedByEditTarget(entity: OverlayEntity): boolean {
    return !!this.overlayEditState && String(this.overlayEditState.entity.id) === String(entity.id);
  }

  private cancelPendingHoverFrame(): void {
    if (this.pendingHoverRaf !== null) {
      globalThis.cancelAnimationFrame?.(this.pendingHoverRaf);
      this.pendingHoverRaf = null;
    }
  }

  private cloneWindowPosition(position: Cesium.Cartesian2): Cesium.Cartesian2 {
    return {
      x: position.x,
      y: position.y,
    } as Cesium.Cartesian2;
  }

  private getLatestHoverPosition(): Cesium.Cartesian2 | null {
    if (this.pendingHoverPosition) {
      return this.cloneWindowPosition(this.pendingHoverPosition);
    }

    if (this.lastHoverPosition) {
      return this.cloneWindowPosition(this.lastHoverPosition);
    }

    return null;
  }

  private clearHoverTargets(forgetPosition: boolean = false): void {
    this.setHighlightTargets(this.hoverHighlightTargets, 'hover', false);
    this.hoverHighlightTargets = [];

    if (forgetPosition) {
      this.pendingHoverPosition = null;
      this.lastHoverPosition = null;
    }
  }

  private updateHoverAtPosition(
    pickPosition: Cesium.Cartesian2,
    respectGovernor: boolean,
  ): boolean {
    this.lastHoverPosition = this.cloneWindowPosition(pickPosition);

    if (respectGovernor && !this.pickGovernor.shouldPick('hover', pickPosition)) {
      return false;
    }

    const overlayEntity = this.pickOverlayEntity(pickPosition, 'hover');
    if (!overlayEntity) {
      this.clearHoverTargets();
      return true;
    }

    const targets = this.getHighlightTargets(overlayEntity, 'hover');
    const isSameTarget =
      targets.length === this.hoverHighlightTargets.length &&
      targets.every((target, index) => target === this.hoverHighlightTargets[index]);

    if (isSameTarget) {
      return true;
    }

    this.clearHoverTargets();
    this.hoverHighlightTargets = targets;
    this.setHighlightTargets(targets, 'hover', true);
    return true;
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
    const state = entity._highlightState || {};
    state[reason] = enabled;
    entity._highlightState = state;

    const activeReason = state.click ? 'click' : state.hover ? 'hover' : null;
    if (!activeReason) {
      this.restoreEntityStyle(entity);
      entity._isHighlighted = false;
      return;
    }

    const highlightConfig = activeReason === 'click'
      ? entity._selectionHighlight ?? entity._clickHighlight ?? true
      : entity._hoverHighlight || true;
    this.applyEntityHighlight(entity, this.normalizeHighlightOptions(highlightConfig, activeReason));
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
    const defaultColor = Cesium.Color.YELLOW;

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
    this.selectedOverlayId = null;
    this.selectionListeners.clear();

    if (this.pendingHoverRaf !== null) {
      globalThis.cancelAnimationFrame?.(this.pendingHoverRaf);
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
