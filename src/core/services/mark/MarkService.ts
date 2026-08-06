import * as Cesium from 'cesium';
import { DrawService } from '../draw/DrawService';
import { DrawInteractionController } from '../draw/DrawInteractionController';
import { calculateDistance } from '../draw/geometry/drawGeometry';
import { toCartographic } from '../draw/geometry/drawPosition';
import { OverlayService, type OverlayEditOptions } from '../overlay/OverlayService';
import { cartesianToLngLat } from '../../mapProviders/coordinates/cesium';
import { DEFAULT_MARK_COLORS } from './markDefaults';
import { buildMarkDrawResult, exportMarkEntity } from './markResult';
import { MarkToolbar } from './MarkToolbar';
import type {
  MarkDrawOptions,
  MarkDrawResult,
  MarkDrawType,
  MarkEditOptions,
  MarkEntityMetadata,
  MarkExportItem,
  MarkServiceOptions,
  MarkWorkAreaKind,
  MarkWorkAreaType,
} from './markTypes';

interface ActiveDrawContext {
  type: MarkDrawType;
  options: MarkDrawOptions;
}

interface EditState {
  entity: Cesium.Entity;
  handleEntities?: Cesium.Entity[];
  handler?: Cesium.ScreenSpaceEventHandler;
  activeHandleIndex?: number | null;
  options?: MarkEditOptions;
  delegated?: boolean;
}

type MarkEditHandleRole = 'vertex' | 'mid';

interface MarkEditHandleMeta {
  role: MarkEditHandleRole;
  index: number;
}

const MARK_EDIT_HANDLE_META_KEY = '__vmapMarkEditHandleMeta';

export class MarkService {
  private readonly drawService: DrawService;
  private readonly overlayService: OverlayService;
  private readonly pointController: DrawInteractionController;
  private readonly entities = new Map<string, Cesium.Entity>();
  private readonly colors = { ...DEFAULT_MARK_COLORS };
  private readonly toolbar: MarkToolbar | null;
  private readonly callbacks;
  private activeDrawContext: ActiveDrawContext | null = null;
  private editEnabled = false;
  private editState: EditState | null = null;
  private readonly continuous: boolean;
  private drawSuspendedOverlayHover: boolean | null = null;
  private drawSuspendedOverlaySelection: boolean | null = null;

  constructor(
    private readonly viewer: Cesium.Viewer,
    options: MarkServiceOptions = {},
    drawService?: DrawService,
    overlayService?: OverlayService,
  ) {
    this.callbacks = options.callbacks;
    this.drawService = drawService ?? new DrawService(viewer);
    this.overlayService = overlayService ?? new OverlayService(viewer);
    this.pointController = new DrawInteractionController(viewer);
    this.continuous = options.continuous ?? false;
    if (options.defaultColor) {
      this.colors.point = options.defaultColor;
      this.colors.polyline = options.defaultColor;
      this.colors.polygon = options.defaultColor;
      this.colors.rectangle = options.defaultColor;
      this.colors.circle = options.defaultColor;
    }
    if (options.colors) {
      Object.assign(this.colors, options.colors);
    }
    this.toolbar = new MarkToolbar(viewer.container as HTMLElement, options, (type) => this.startDrawing(type));
    this.toolbar.mount();

    this.drawService.onDrawEnd((result) => {
      if (!this.activeDrawContext) {
        return;
      }

      const context = this.activeDrawContext;
      this.activeDrawContext = null;
      this.resumeOverlayInteractionsAfterDraw();
      if (!result) {
        options.callbacks?.onDrawEnd?.(null);
        context.options.onComplete?.(null);
        return;
      }

      this.stripAuxiliary(result.entity);
      this.attachMetadata(result.entity, {
        type: context.type,
        controlPoints: result.positions,
        color: context.options.color || this.colors[context.type],
        kind: context.options.workAreaKind,
      });
      this.applyStyle(result.entity, context.type, context.options.color || this.colors[context.type]);
      this.entities.set(String(result.entity.id), result.entity);
      const drawResult = buildMarkDrawResult(result.entity, context.options.outputCoordSystem || 'WGS84');
      if (context.options.workAreaKind) {
        options.callbacks?.onWorkAreaDrawEnd?.(drawResult);
      }
      options.callbacks?.onDrawEnd?.(drawResult);
      context.options.onComplete?.(drawResult);

      if (this.continuous && context.type !== 'point') {
        window.setTimeout(() => {
          this.startDrawing(context.type, context.options);
        }, 0);
      }
    });
  }

  startDrawing(type: MarkDrawType, options: MarkDrawOptions = {}): void {
    this.stopDraw();
    if (type === 'point') {
      this.drawPoint(options);
      return;
    }

    this.suspendOverlayInteractionsForDraw();
    this.activeDrawContext = { type, options };
    const drawOptions = {
      lineColor: options.color || this.colors[type],
      fillColor: options.color || this.colors[type],
      clampToGround: options.clampToGround ?? true,
      outputCoordSystem: options.outputCoordSystem,
    };
    this.callbacks?.onColorChange?.(options.color || this.colors[type], type);
    if (type === 'polyline') {
      this.drawService.startDrawingLine(drawOptions);
    } else if (type === 'polygon') {
      this.drawService.startDrawingPolygon(drawOptions);
    } else if (type === 'rectangle') {
      this.drawService.startDrawingRectangle(drawOptions);
    } else if (type === 'circle') {
      this.drawService.startDrawingCircle(drawOptions);
    }
  }

  drawPoint(options: MarkDrawOptions = {}): void {
    this.stopDraw();
    this.suspendOverlayInteractionsForDraw();
    this.activeDrawContext = { type: 'point', options };
    this.callbacks?.onDrawStart?.('point');
    this.pointController.activate({
      onLeftClick: (position) => {
        this.pointController.deactivate();
        const point = cartesianToLngLat(position, options.coordSystem || 'WGS84');
        const marker = this.overlayService.addMarker({
          position: [point.longitude, point.latitude, point.height ?? 0],
          coordSystem: options.coordSystem,
          color: options.color || this.colors.point,
          pixelSize: 10,
        });
        const entity = marker.getEntity();
        this.attachMetadata(entity, {
          type: 'point',
          controlPoints: [position],
          color: options.color || this.colors.point,
          kind: options.workAreaKind,
        });
        this.entities.set(String(entity.id), entity);
        const result = buildMarkDrawResult(entity, options.outputCoordSystem || 'WGS84');
        this.activeDrawContext = null;
        this.resumeOverlayInteractionsAfterDraw();
        this.callbacks?.onDrawEnd?.(result);
        options.onComplete?.(result);
      },
      onRightClick: () => undefined,
      onMouseMove: () => undefined,
      onDoubleClick: () => undefined,
    });
  }

  drawPolyline(options?: MarkDrawOptions): void { this.startDrawing('polyline', options); }
  drawPolygon(options?: MarkDrawOptions): void { this.startDrawing('polygon', options); }
  drawRectangle(options?: MarkDrawOptions): void { this.startDrawing('rectangle', options); }
  drawCircle(options?: MarkDrawOptions): void { this.startDrawing('circle', options); }

  startWorkAreaDraw(type: MarkWorkAreaType, kind: MarkWorkAreaKind = 'work', options?: MarkDrawOptions): void {
    this.startDrawing(type, { ...options, workAreaKind: kind });
  }

  stopDraw(): void {
    this.pointController.deactivate();
    this.drawService.cancelDrawing();
    this.activeDrawContext = null;
    this.resumeOverlayInteractionsAfterDraw();
  }

  cancelDrawing(): void {
    this.stopDraw();
  }

  clearAll(): void {
    this.stopEdit();
    Array.from(this.entities.keys()).forEach((id) => this.deleteEntity(id));
    this.callbacks?.onClear?.();
  }

  deleteEntity(entityOrId: Cesium.Entity | string): void {
    const entity = typeof entityOrId === 'string' ? this.entities.get(entityOrId) : entityOrId;
    if (!entity) {
      return;
    }
    this.overlayService.removeOverlay(String(entity.id));
    this.viewer.entities.remove(entity);
    this.entities.delete(String(entity.id));
    this.callbacks?.onDelete?.(entity);
  }

  enableEdit(options?: MarkEditOptions): void {
    this.editEnabled = true;
    this.overlayService.setOverlayEditMode(true, options);
  }

  disableEdit(): MarkDrawResult | null {
    const result = this.stopEdit();
    this.editEnabled = false;
    this.overlayService.setOverlayEditMode(false);
    return result;
  }

  startEdit(entityOrId: Cesium.Entity | string, options?: MarkEditOptions): boolean {
    const entity = typeof entityOrId === 'string' ? this.entities.get(entityOrId) : entityOrId;
    if (!entity) {
      return false;
    }

    this.stopEdit();
    const metadata = this.getMetadata(entity);
    if (!metadata) {
      this.editEnabled = false;
      this.overlayService.setOverlayEditMode(false);
      return false;
    }

    this.editEnabled = true;
    return this.startUnifiedOverlayEdit(entity, metadata, options);
  }

  stopEdit(): MarkDrawResult | null {
    if (!this.editState) {
      return null;
    }
    const { entity, options } = this.editState;
    const result = buildMarkDrawResult(entity, options?.outputCoordSystem || 'WGS84');
    this.overlayService.stopOverlayEdit();
    if (this.editState?.entity === entity) {
      this.editState = null;
    }
    return result;
  }

  setColor(type: MarkDrawType, color: string): void {
    this.colors[type] = color;
    this.callbacks?.onColorChange?.(color, type);
  }

  getColor(type: MarkDrawType): string {
    return this.colors[type];
  }

  getEntities(): Cesium.Entity[] {
    return Array.from(this.entities.values());
  }

  exportData(outputCoordSystem: 'WGS84' | 'GCJ02' | 'BD09' = 'WGS84'): MarkExportItem[] {
    return Array.from(this.entities.values())
      .map((entity) => exportMarkEntity(entity, outputCoordSystem))
      .filter((item): item is MarkExportItem => !!item);
  }

  destroy(): void {
    this.stopDraw();
    this.stopEdit();
    this.toolbar?.destroy();
  }

  private suspendOverlayInteractionsForDraw(): void {
    if (this.drawSuspendedOverlayHover !== null) {
      return;
    }

    this.drawSuspendedOverlayHover = this.overlayService.isHoverEnabled();
    this.drawSuspendedOverlaySelection = this.overlayService.isSelectionEnabled();
    this.overlayService.setDrawInteractionActive(true);
  }

  private resumeOverlayInteractionsAfterDraw(): void {
    if (this.drawSuspendedOverlayHover === null || this.drawSuspendedOverlaySelection === null) {
      return;
    }

    this.overlayService.setDrawInteractionActive(false);
    if (!this.drawSuspendedOverlayHover) {
      this.overlayService.setHoverEnabled(false);
    }
    if (!this.drawSuspendedOverlaySelection) {
      this.overlayService.setSelectionEnabled(false);
    }
    this.drawSuspendedOverlayHover = null;
    this.drawSuspendedOverlaySelection = null;
  }

  private stripAuxiliary(entity: Cesium.Entity): void {
    const aux = (entity as Cesium.Entity & { _drawAuxiliaryEntities?: Cesium.Entity[] })._drawAuxiliaryEntities || [];
    aux.forEach((item) => this.viewer.entities.remove(item));
    (entity as Cesium.Entity & { _drawAuxiliaryEntities?: Cesium.Entity[] })._drawAuxiliaryEntities = [];
  }

  private attachMetadata(entity: Cesium.Entity, metadata: MarkEntityMetadata): void {
    (entity as Cesium.Entity & { _markMeta?: MarkEntityMetadata })._markMeta = {
      ...metadata,
      controlPoints: metadata.controlPoints.map((point) => point.clone()),
    };
  }

  private getMetadata(entity: Cesium.Entity): MarkEntityMetadata | null {
    return (entity as Cesium.Entity & { _markMeta?: MarkEntityMetadata })._markMeta || null;
  }

  private startUnifiedOverlayEdit(
    entity: Cesium.Entity,
    metadata: MarkEntityMetadata,
    options?: MarkEditOptions,
  ): boolean {
    const outputCoordSystem = options?.outputCoordSystem || 'WGS84';
    const sessionOptions: OverlayEditOptions = {
      ...options,
      onChange: (changedEntity) => {
        if (changedEntity !== entity) {
          options?.onChange?.(changedEntity);
          options?.onOverlayEditChange?.(changedEntity);
          return;
        }
        this.syncMetadataFromEntity(entity, metadata);
        this.callbacks?.onEditChange?.(buildMarkDrawResult(entity, outputCoordSystem));
        options?.onOverlayEditChange?.(changedEntity);
        options?.onChange?.(changedEntity);
      },
      onEnd: (endedEntity) => {
        if (endedEntity && endedEntity !== entity) {
          options?.onEnd?.(endedEntity);
          options?.onOverlayEditEnd?.(endedEntity);
          return;
        }
        if (endedEntity) {
          this.syncMetadataFromEntity(entity, metadata);
        }
        this.editState = null;
        this.editEnabled = false;
        const result = endedEntity ? buildMarkDrawResult(entity, outputCoordSystem) : null;
        this.callbacks?.onEditEnd?.(result);
        options?.onOverlayEditEnd?.(endedEntity);
        options?.onEnd?.(endedEntity);
      },
    };

    this.overlayService.setOverlayEditMode(true, options);
    this.editState = {
      entity,
      delegated: true,
      options,
    };

    const started = this.overlayService.startOverlayEdit(entity, sessionOptions);
    if (!started) {
      this.editState = null;
      this.editEnabled = false;
      this.overlayService.setOverlayEditMode(false);
    }
    return started;
  }

  private applyStyle(entity: Cesium.Entity, type: MarkDrawType, color: string): void {
    const resolvedColor = Cesium.Color.fromCssColorString(color);
    if (type === 'polyline' && entity.polyline) {
      entity.polyline.material = new Cesium.ColorMaterialProperty(resolvedColor);
    } else if ((type === 'polygon' || type === 'rectangle') && entity.polygon) {
      entity.polygon.material = new Cesium.ColorMaterialProperty(resolvedColor);
      entity.polygon.outline = new Cesium.ConstantProperty(true);
      entity.polygon.outlineColor = new Cesium.ConstantProperty(resolvedColor);
    } else if (type === 'circle' && entity.ellipse) {
      entity.ellipse.material = new Cesium.ColorMaterialProperty(resolvedColor);
      entity.ellipse.outline = new Cesium.ConstantProperty(true);
      entity.ellipse.outlineColor = new Cesium.ConstantProperty(resolvedColor);
    } else if (type === 'point' && entity.point) {
      entity.point.color = new Cesium.ConstantProperty(resolvedColor);
    }
  }

  private updateEntityGeometry(entity: Cesium.Entity, metadata: MarkEntityMetadata): void {
    if (metadata.type === 'point' && entity.position) {
      entity.position = new Cesium.ConstantPositionProperty(metadata.controlPoints[0].clone());
      return;
    }

    if (metadata.type === 'polyline' && entity.polyline) {
      entity.polyline.positions = new Cesium.ConstantProperty(metadata.controlPoints.map((point) => point.clone()));
      return;
    }

    if (metadata.type === 'rectangle') {
      const rectanglePositions = this.getRectanglePositions(metadata.controlPoints);
      if (entity.rectangle && rectanglePositions.length >= 4) {
        const rect = this.positionsToRectangle(rectanglePositions);
        if (rect) {
          entity.rectangle.coordinates = new Cesium.ConstantProperty(rect);
        }
      } else if (entity.polygon && rectanglePositions.length >= 4) {
        entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(rectanglePositions));
      }
      return;
    }

    if (metadata.type === 'polygon' && entity.polygon) {
      const polygonPositions = metadata.controlPoints.map((point) => point.clone());
      entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(polygonPositions));
      return;
    }

    if (metadata.type === 'circle' && entity.ellipse && entity.position) {
      const center = metadata.controlPoints[0];
      const edge = metadata.controlPoints[1];
      const centerCarto = toCartographic(center);
      const edgeCarto = toCartographic(edge);
      if (!centerCarto || !edgeCarto) {
        return;
      }
      const radius = metadata.radius ?? calculateDistance(centerCarto, edgeCarto);
      metadata.radius = radius;
      entity.position = new Cesium.ConstantPositionProperty(center.clone());
      entity.ellipse.semiMajorAxis = new Cesium.ConstantProperty(radius);
      entity.ellipse.semiMinorAxis = new Cesium.ConstantProperty(radius);
    }
  }

  private createEditHandleEntities(entity: Cesium.Entity, metadata: MarkEntityMetadata): Cesium.Entity[] {
    const handles = metadata.controlPoints.map((point, index) => (
      this.createHandleEntity(entity, point, {
        role: 'vertex',
        index,
      }, {
        color: '#1e88e5',
        outlineColor: '#ffffff',
        pixelSize: 10,
      })
    ));

    if (metadata.type === 'polyline') {
      for (let index = 0; index < metadata.controlPoints.length - 1; index++) {
        const midpoint = Cesium.Cartesian3.midpoint(
          metadata.controlPoints[index],
          metadata.controlPoints[index + 1],
          new Cesium.Cartesian3(),
        );
        handles.push(this.createHandleEntity(entity, midpoint, {
          role: 'mid',
          index,
        }, {
          color: '#ec407a',
          outlineColor: '#ffffff',
          pixelSize: 8,
        }));
      }
    }

    return handles;
  }

  private createHandleEntity(
    entity: Cesium.Entity,
    position: Cesium.Cartesian3,
    meta: MarkEditHandleMeta,
    style: { color: string; outlineColor: string; pixelSize: number },
  ): Cesium.Entity {
    const handle = this.viewer.entities.add({
      id: `${entity.id}__handle_${meta.role}_${meta.index}`,
      position: position.clone(),
      point: {
        pixelSize: style.pixelSize,
        color: Cesium.Color.fromCssColorString(style.color),
        outlineColor: Cesium.Color.fromCssColorString(style.outlineColor),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });

    (handle as Cesium.Entity & Record<string, unknown>)[MARK_EDIT_HANDLE_META_KEY] = meta;
    return handle;
  }

  private rebuildEditHandleEntities(
    entity: Cesium.Entity,
    metadata: MarkEntityMetadata,
    currentHandles: Cesium.Entity[],
  ): Cesium.Entity[] {
    currentHandles.forEach((handle) => this.viewer.entities.remove(handle));
    return this.createEditHandleEntities(entity, metadata);
  }

  private getEditHandleMeta(handle: Cesium.Entity | null): MarkEditHandleMeta | null {
    return (handle as Cesium.Entity & Record<string, unknown> | null)?.[MARK_EDIT_HANDLE_META_KEY] as MarkEditHandleMeta | null;
  }

  private resolveEditHandlePosition(
    metadata: MarkEntityMetadata,
    handle: Cesium.Entity,
    screenPosition?: Cesium.Cartesian2,
  ): Cesium.Cartesian3 | null {
    if (screenPosition) {
      const picked = this.pickPosition(screenPosition);
      if (picked) {
        return picked;
      }
    }

    const value = handle.position?.getValue(Cesium.JulianDate.now());
    if (value) {
      return value.clone();
    }

    const meta = this.getEditHandleMeta(handle);
    if (meta?.role === 'mid') {
      const start = metadata.controlPoints[meta.index];
      const end = metadata.controlPoints[meta.index + 1];
      if (start && end) {
        return Cesium.Cartesian3.midpoint(start, end, new Cesium.Cartesian3());
      }
    }

    return null;
  }

  private syncEditHandlePositions(metadata: MarkEntityMetadata, handleEntities: Cesium.Entity[]): void {
    if (metadata.type === 'rectangle' && metadata.controlPoints.length >= 2) {
      const corners = this.getRectanglePositions(metadata.controlPoints);
      corners.forEach((corner, index) => {
        if (handleEntities[index]) {
          handleEntities[index].position = new Cesium.ConstantPositionProperty(corner.clone());
        }
      });
      return;
    }

    if (metadata.type === 'circle' && metadata.controlPoints.length >= 2 && handleEntities.length >= 2) {
      const center = metadata.controlPoints[0];
      const edge = this.circleRadiusHandlePosition(center, metadata.radius ?? this.calculateCircleRadius(center, metadata.controlPoints[1]));
      handleEntities[0].position = new Cesium.ConstantPositionProperty(center.clone());
      handleEntities[1].position = new Cesium.ConstantPositionProperty(edge.clone());
      return;
    }

    handleEntities.forEach((handle) => {
      const meta = this.getEditHandleMeta(handle);
      if (!meta) {
        return;
      }

      if (meta.role === 'vertex') {
        const point = metadata.controlPoints[meta.index];
        if (point) {
          handle.position = new Cesium.ConstantPositionProperty(point.clone());
        }
        return;
      }

      if (meta.role === 'mid') {
        const start = metadata.controlPoints[meta.index];
        const end = metadata.controlPoints[meta.index + 1];
        if (start && end) {
          handle.position = new Cesium.ConstantPositionProperty(
            Cesium.Cartesian3.midpoint(start, end, new Cesium.Cartesian3()),
          );
        }
      }
    });
  }

  private pickPosition(position: Cesium.Cartesian2): Cesium.Cartesian3 | null {
    const ray = this.viewer.camera.getPickRay(position);
    if (ray) {
      const picked = this.viewer.scene.globe.pick(ray, this.viewer.scene);
      if (picked) {
        return picked;
      }
    }
    return this.viewer.camera.pickEllipsoid(position, this.viewer.scene.globe.ellipsoid) ?? null;
  }

  private calculateCircleRadius(center: Cesium.Cartesian3, edge: Cesium.Cartesian3): number {
    const centerCarto = toCartographic(center);
    const edgeCarto = toCartographic(edge);
    if (!centerCarto || !edgeCarto) {
      return 0;
    }
    return calculateDistance(centerCarto, edgeCarto);
  }

  private circleRadiusHandlePosition(center: Cesium.Cartesian3, radiusMeters: number): Cesium.Cartesian3 {
    const carto = Cesium.Cartographic.fromCartesian(center);
    const R = 6378137.0;
    const dLon = Math.max(0, radiusMeters) / (R * Math.max(Math.cos(carto.latitude), 1e-6));
    return Cesium.Cartesian3.fromRadians(carto.longitude + dLon, carto.latitude, carto.height ?? 0);
  }

  private syncMetadataFromEntity(entity: Cesium.Entity, metadata: MarkEntityMetadata): void {
    if (metadata.type === 'rectangle') {
      const rect = this.resolveRectangleCoordinates(entity);
      if (!rect) {
        return;
      }
      metadata.controlPoints = this.rectangleToCornerPoints(rect, this.resolveRectangleHeight(entity));
      metadata.radius = undefined;
      return;
    }

    if (metadata.type === 'circle') {
      const center = this.resolveCircleCenter(entity);
      const radius = this.resolveCircleRadius(entity);
      if (!center || !(radius > 0)) {
        return;
      }
      metadata.controlPoints = [center, this.circleRadiusHandlePosition(center, radius)];
      metadata.radius = radius;
      return;
    }

    if (metadata.type === 'point' && entity.position) {
      const position = entity.position.getValue(Cesium.JulianDate.now());
      if (position) {
        metadata.controlPoints = [position.clone()];
      }
      return;
    }

    if (metadata.type === 'polyline' && entity.polyline?.positions) {
      const positions = entity.polyline.positions.getValue(Cesium.JulianDate.now());
      if (Array.isArray(positions)) {
        metadata.controlPoints = positions.map((point) => point.clone());
      }
      return;
    }

    if (metadata.type === 'polygon' && entity.polygon?.hierarchy) {
      const hierarchy = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now());
      const positions = Array.isArray(hierarchy) ? hierarchy : hierarchy?.positions;
      if (Array.isArray(positions)) {
        metadata.controlPoints = positions.map((point) => point.clone());
      }
    }
  }

  private resolveRectangleCoordinates(entity: Cesium.Entity): Cesium.Rectangle | null {
    if (entity.rectangle?.coordinates) {
      const rect = entity.rectangle.coordinates.getValue(Cesium.JulianDate.now());
      if (rect) {
        return Cesium.Rectangle.clone(rect);
      }
    }

    const ringRect = (entity as Cesium.Entity & { _outerRectangle?: Cesium.Rectangle })._outerRectangle;
    return ringRect ? Cesium.Rectangle.clone(ringRect) : null;
  }

  private rectangleToCornerPoints(rect: Cesium.Rectangle, height = 0): Cesium.Cartesian3[] {
    return [
      Cesium.Cartesian3.fromRadians(rect.west, rect.south, height),
      Cesium.Cartesian3.fromRadians(rect.east, rect.south, height),
      Cesium.Cartesian3.fromRadians(rect.east, rect.north, height),
      Cesium.Cartesian3.fromRadians(rect.west, rect.north, height),
    ];
  }

  private resolveRectangleHeight(entity: Cesium.Entity): number {
    const heightValue = entity.rectangle && 'height' in entity.rectangle
      ? (entity.rectangle as Cesium.RectangleGraphics & { height?: Cesium.Property }).height?.getValue?.(Cesium.JulianDate.now())
      : undefined;
    return Number.isFinite(heightValue) ? Number(heightValue) : 0;
  }

  private resolveCircleCenter(entity: Cesium.Entity): Cesium.Cartesian3 | null {
    const entityPosition = entity.position?.getValue(Cesium.JulianDate.now());
    if (entityPosition) {
      return entityPosition.clone();
    }

    const centerCartographic = (entity as Cesium.Entity & { _centerCartographic?: Cesium.Cartographic })._centerCartographic;
    if (centerCartographic) {
      return Cesium.Cartesian3.fromRadians(
        centerCartographic.longitude,
        centerCartographic.latitude,
        centerCartographic.height ?? 0,
      );
    }

    return null;
  }

  private resolveCircleRadius(entity: Cesium.Entity): number {
    if (entity.ellipse?.semiMajorAxis) {
      const radius = entity.ellipse.semiMajorAxis.getValue(Cesium.JulianDate.now());
      if (Number.isFinite(radius)) {
        return Number(radius);
      }
    }

    const primitiveRadius = (entity as Cesium.Entity & { _outerRadius?: number })._outerRadius;
    return Number.isFinite(primitiveRadius) ? Number(primitiveRadius) : 0;
  }

  private updateRectangleControlPoints(
    controlPoints: Cesium.Cartesian3[],
    handleIndex: number,
    position: Cesium.Cartesian3,
  ): Cesium.Cartesian3[] {
    if (controlPoints.length < 4) {
      return controlPoints.map((point, index) => (index === handleIndex ? position.clone() : point.clone()));
    }

    const oppositeIndex = (handleIndex + 2) % 4;
    const opposite = controlPoints[oppositeIndex];
    const draggedCarto = Cesium.Cartographic.fromCartesian(position);
    const oppositeCarto = Cesium.Cartographic.fromCartesian(opposite);
    if (!draggedCarto || !oppositeCarto) {
      return controlPoints.map((point, index) => (index === handleIndex ? position.clone() : point.clone()));
    }

    const west = Math.min(oppositeCarto.longitude, draggedCarto.longitude);
    const east = Math.max(oppositeCarto.longitude, draggedCarto.longitude);
    const south = Math.min(oppositeCarto.latitude, draggedCarto.latitude);
    const north = Math.max(oppositeCarto.latitude, draggedCarto.latitude);
    const height = draggedCarto.height ?? oppositeCarto.height ?? 0;

    return [
      Cesium.Cartesian3.fromRadians(west, south, height),
      Cesium.Cartesian3.fromRadians(east, south, height),
      Cesium.Cartesian3.fromRadians(east, north, height),
      Cesium.Cartesian3.fromRadians(west, north, height),
    ];
  }

  private getRectanglePositions(controlPoints: Cesium.Cartesian3[]): Cesium.Cartesian3[] {
    if (controlPoints.length < 2) {
      return [];
    }

    const cartographics = controlPoints
      .map((point) => Cesium.Cartographic.fromCartesian(point))
      .filter((item): item is Cesium.Cartographic => !!item);
    if (cartographics.length < 2) {
      return [];
    }

    const west = Math.min(...cartographics.map((item) => item.longitude));
    const east = Math.max(...cartographics.map((item) => item.longitude));
    const south = Math.min(...cartographics.map((item) => item.latitude));
    const north = Math.max(...cartographics.map((item) => item.latitude));
    return [
      Cesium.Cartesian3.fromRadians(west, south, 0),
      Cesium.Cartesian3.fromRadians(east, south, 0),
      Cesium.Cartesian3.fromRadians(east, north, 0),
      Cesium.Cartesian3.fromRadians(west, north, 0),
    ];
  }

  private positionsToRectangle(positions: Cesium.Cartesian3[]): Cesium.Rectangle | null {
    if (positions.length < 2) {
      return null;
    }

    const cartographics = positions
      .map((point) => Cesium.Cartographic.fromCartesian(point))
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
}
