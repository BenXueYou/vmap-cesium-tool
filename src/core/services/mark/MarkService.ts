import * as Cesium from 'cesium';
import { DrawService } from '../draw/DrawService';
import { DrawInteractionController } from '../draw/DrawInteractionController';
import { calculateDistance } from '../draw/geometry/drawGeometry';
import { toCartographic } from '../draw/geometry/drawPosition';
import { OverlayService } from '../overlay/OverlayService';
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
  handleEntities: Cesium.Entity[];
  handler: Cesium.ScreenSpaceEventHandler;
  activeHandleIndex: number | null;
  options?: MarkEditOptions;
}

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
    this.editEnabled = false;
    this.overlayService.setOverlayEditMode(false);
    return this.stopEdit();
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
    this.overlayService.setOverlayEditMode(true, options);

    const handleEntities = metadata.controlPoints.map((point, index) => {
      const handle = this.viewer.entities.add({
        id: `${entity.id}__handle_${index}`,
        position: point.clone(),
        point: {
          pixelSize: 10,
          color: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      return handle;
    });

    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    let activeHandleIndex: number | null = null;
    handler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = this.viewer.scene.pick(click.position);
      const pickedId = picked?.id instanceof Cesium.Entity ? String(picked.id.id) : '';
      activeHandleIndex = handleEntities.findIndex((item) => String(item.id) === pickedId);
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      if (activeHandleIndex === null) {
        return;
      }
      const position = this.pickPosition(movement.endPosition);
      if (!position) {
        return;
      }

      if (metadata.type === 'circle') {
        if (activeHandleIndex === 0) {
          const radius = metadata.radius ?? this.calculateCircleRadius(metadata.controlPoints[0], metadata.controlPoints[1]);
          metadata.controlPoints[0] = position.clone();
          metadata.radius = radius;
          metadata.controlPoints[1] = this.circleRadiusHandlePosition(position, radius);
        } else {
          metadata.controlPoints[1] = position.clone();
          metadata.radius = this.calculateCircleRadius(metadata.controlPoints[0], position);
        }
      } else {
        metadata.controlPoints[activeHandleIndex] = position.clone();
        handleEntities[activeHandleIndex].position = new Cesium.ConstantPositionProperty(position.clone());
      }

      this.updateEntityGeometry(entity, metadata);
      this.syncEditHandlePositions(metadata, handleEntities);
      this.callbacks?.onEditChange?.(buildMarkDrawResult(entity, options?.outputCoordSystem || 'WGS84'));
      this.viewer.scene.requestRender();
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction(() => {
      activeHandleIndex = null;
    }, Cesium.ScreenSpaceEventType.LEFT_UP);

    this.editState = { entity, handleEntities, handler, activeHandleIndex, options };
    return true;
  }

  stopEdit(): MarkDrawResult | null {
    if (!this.editState) {
      return null;
    }
    const { entity, handleEntities, handler, options } = this.editState;
    handleEntities.forEach((item) => this.viewer.entities.remove(item));
    handler.destroy();
    this.editState = null;
    this.overlayService.setOverlayEditMode(false);
    const result = buildMarkDrawResult(entity, options?.outputCoordSystem || 'WGS84');
    this.callbacks?.onEditEnd?.(result);
    this.viewer.scene.requestRender();
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

    metadata.controlPoints.forEach((point, index) => {
      if (handleEntities[index]) {
        handleEntities[index].position = new Cesium.ConstantPositionProperty(point.clone());
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
