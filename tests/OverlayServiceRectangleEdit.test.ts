import { describe, expect, it } from 'vitest';
import * as Cesium from 'cesium';
import { Rectangle } from '../src/core/entities/Rectangle';
import { OverlayService } from '../src/core/services/overlay/OverlayService';

function createViewerStub() {
  const store: Cesium.Entity[] = [];
  return {
    entities: {
      add(entityLike: Cesium.Entity | Cesium.Entity.ConstructorOptions) {
        const entity = entityLike instanceof Cesium.Entity ? entityLike : new Cesium.Entity(entityLike);
        store.push(entity);
        return entity;
      },
      remove(entity: Cesium.Entity) {
        const index = store.indexOf(entity);
        if (index >= 0) {
          store.splice(index, 1);
          return true;
        }
        return false;
      },
    },
    scene: {
      canvas: { style: { cursor: '' } },
    },
    isDestroyed() {
      return false;
    },
  } as unknown as Cesium.Viewer;
}

function createService(root: Cesium.Entity, overlay: Rectangle) {
  const service = Object.create(OverlayService.prototype) as OverlayService & Record<string, any>;
  service.viewer = createViewerStub();
  service.entityOverlayMap = new Map([[root, overlay]]);
  return service as OverlayService & Record<string, any>;
}

function readHandleMeta(entity: Cesium.Entity): Record<string, unknown> | null {
  return (entity as Cesium.Entity & { __vmapOverlayEditHandleMeta?: Record<string, unknown> }).__vmapOverlayEditHandleMeta || null;
}

describe('OverlayService rectangle edit', () => {
  it('uses the 0.x rectangle handle layout by default', () => {
    const viewer = createViewerStub();
    const overlay = new Rectangle(viewer, {
      id: 'rect-style',
      coordinates: Cesium.Rectangle.fromDegrees(0, 0, 2, 2),
    });

    const root = overlay.getEntity() as Cesium.Entity;
    const service = createService(root, overlay);
    const kind = service.detectEditableKind(root);
    const controlPoints = service.resolveEditableControlPoints(root, kind);
    const handles = service.createEditHandles({
      kind,
      entity: root,
      controlPoints,
      handles: [],
      handler: {} as Cesium.ScreenSpaceEventHandler,
      activeHandleIndex: null,
      radiusMeters: undefined,
      isDragging: false,
      cameraState: null,
      previousCursor: '',
      options: {},
    });

    const now = Cesium.JulianDate.now();
    const firstHandle = handles[0];
    const moveHandle = handles[4];
    expect(handles).toHaveLength(5);
    expect(firstHandle.point?.pixelSize?.getValue(now)).toBe(10);
    expect(firstHandle.point?.outlineWidth?.getValue(now)).toBe(2);
    expect(firstHandle.point?.color?.getValue(now)).toEqual(Cesium.Color.fromCssColorString('#1e88e5'));
    expect(firstHandle.point?.outlineColor?.getValue(now)).toEqual(Cesium.Color.WHITE);
    expect(moveHandle.point?.pixelSize?.getValue(now)).toBe(11);
    expect(moveHandle.point?.color?.getValue(now)).toEqual(Cesium.Color.fromCssColorString('#43a047'));
    expect(readHandleMeta(moveHandle)?.role).toBe('move');
  });

  it('treats thick rectangle overlays as rectangles and updates the whole shape when a corner is dragged', () => {
    const viewer = createViewerStub();
    const overlay = new Rectangle(viewer, {
      id: 'rect-ring',
      coordinates: Cesium.Rectangle.fromDegrees(0, 0, 2, 2),
      material: Cesium.Color.CYAN.withAlpha(0.35),
      outline: true,
      outlineColor: Cesium.Color.CYAN,
      outlineWidth: 20,
    });

    const root = overlay.getEntity() as Cesium.Entity;
    const service = createService(root, overlay);

    const kind = service.detectEditableKind(root);
    expect(kind).toBe('rectangle');

    const controlPoints = service.resolveEditableControlPoints(root, kind);
    const state = {
      kind,
      entity: root,
      controlPoints,
      handles: Array.from({ length: 5 }, (_, index) => (index === 4
        ? ({ __vmapOverlayEditHandleMeta: { role: 'move' } } as unknown as Cesium.Entity)
        : ({} as Cesium.Entity))),
    };

    service.applyDragForHandle(state, 4, Cesium.Cartesian3.fromDegrees(2, 2, 0));

    const rect = overlay.getCoordinates();
    expect(rect).toBeTruthy();
    expect(Cesium.Math.toDegrees(rect!.west)).toBeCloseTo(1, 6);
    expect(Cesium.Math.toDegrees(rect!.south)).toBeCloseTo(1, 6);
    expect(Cesium.Math.toDegrees(rect!.east)).toBeCloseTo(3, 6);
    expect(Cesium.Math.toDegrees(rect!.north)).toBeCloseTo(3, 6);
  });
});
