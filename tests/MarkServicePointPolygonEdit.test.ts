import { afterEach, describe, expect, it, vi } from 'vitest';

class FakeScreenSpaceEventHandler {
  static instances: FakeScreenSpaceEventHandler[] = [];

  private readonly actions = new Map<number, (payload: any) => void>();

  constructor(_canvas: unknown) {
    FakeScreenSpaceEventHandler.instances.push(this);
  }

  setInputAction(callback: (payload: any) => void, type: number): void {
    this.actions.set(type, callback);
  }

  trigger(type: number, payload: any): void {
    this.actions.get(type)?.(payload);
  }

  destroy(): void {
    this.actions.clear();
  }
}

vi.mock('cesium', async (importOriginal) => {
  const actual = await importOriginal<typeof import('cesium')>();
  return {
    ...actual,
    ScreenSpaceEventHandler: FakeScreenSpaceEventHandler,
  };
});

const Cesium = await import('cesium');
const { MarkService } = await import('../src/core/services/mark/MarkService');

function createViewerStub() {
  const store: Cesium.Entity[] = [];
  const scenePick = vi.fn();
  const globePick = vi.fn();

  return {
    store,
    scenePick,
    globePick,
    viewer: {
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
        canvas: {},
        pick: scenePick,
        globe: {
          ellipsoid: Cesium.Ellipsoid.WGS84,
          pick: globePick,
        },
        requestRender: vi.fn(),
      },
      camera: {
        getPickRay: vi.fn(() => ({})),
        pickEllipsoid: vi.fn(() => null),
      },
    } as unknown as Cesium.Viewer,
  };
}

function createService(viewer: Cesium.Viewer) {
  const callbacks = {
    onEditChange: vi.fn(),
    onEditEnd: vi.fn(),
  };

  const service = Object.create(MarkService.prototype) as MarkService & Record<string, any>;
  service.viewer = viewer;
  service.entities = new Map();
  service.callbacks = callbacks;
  service.editState = null;
  service.editEnabled = false;
  service.overlayService = {
    setOverlayEditMode: vi.fn(),
    startOverlayEdit: vi.fn(() => true),
    stopOverlayEdit: vi.fn(),
  };

  return { service, callbacks };
}

function toDegrees(point: Cesium.Cartesian3) {
  const cartographic = Cesium.Cartographic.fromCartesian(point);
  return {
    longitude: Cesium.Math.toDegrees(cartographic.longitude),
    latitude: Cesium.Math.toDegrees(cartographic.latitude),
  };
}

describe('MarkService point and polygon edit regression', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    FakeScreenSpaceEventHandler.instances.length = 0;
  });

  it('keeps point edit change/end snapshots stable for mark callbacks', () => {
    const { viewer, scenePick, globePick } = createViewerStub();
    const { service, callbacks } = createService(viewer);
    const point = new Cesium.Entity({
      id: 'mark-point-1',
      position: new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(116.397, 39.907, 0)),
      point: {
        pixelSize: 12,
        color: Cesium.Color.YELLOW,
      },
    });

    (point as Cesium.Entity & { _markMeta?: Record<string, unknown> })._markMeta = {
      type: 'point',
      controlPoints: [Cesium.Cartesian3.fromDegrees(116.397, 39.907, 0)],
      color: '#00A3FF',
    };

    service.entities.set(String(point.id), point);

    expect(service.startEdit(point, { outputCoordSystem: 'WGS84' })).toBe(true);

    const editState = service.editState as Record<string, any>;
    const handle = editState.handleEntities[0] as Cesium.Entity;
    scenePick.mockReturnValue({ id: handle });

    const moved = Cesium.Cartesian3.fromDegrees(116.3985, 39.9085, 0);
    globePick.mockReturnValue(moved);

    const handler = FakeScreenSpaceEventHandler.instances[0];
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_DOWN, { position: { x: 14, y: 18 } });
    handler.trigger(Cesium.ScreenSpaceEventType.MOUSE_MOVE, { endPosition: { x: 22, y: 26 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_UP, {});

    const changeResult = callbacks.onEditChange.mock.calls[0][0];
    expect(changeResult.position.longitude).toBeCloseTo(116.3985, 6);
    expect(changeResult.position.latitude).toBeCloseTo(39.9085, 6);

    const endResult = service.stopEdit();
    expect(endResult?.position?.longitude).toBeCloseTo(116.3985, 6);
    expect(endResult?.position?.latitude).toBeCloseTo(39.9085, 6);
    expect(callbacks.onEditEnd).toHaveBeenCalledTimes(1);
  });

  it('keeps polygon edit change/end snapshots stable for mark callbacks', () => {
    const { viewer, scenePick, globePick } = createViewerStub();
    const { service, callbacks } = createService(viewer);
    const polygon = new Cesium.Entity({
      id: 'mark-polygon-1',
      polygon: {
        hierarchy: new Cesium.ConstantProperty(new Cesium.PolygonHierarchy([
          Cesium.Cartesian3.fromDegrees(0, 0, 0),
          Cesium.Cartesian3.fromDegrees(2, 0, 0),
          Cesium.Cartesian3.fromDegrees(1, 2, 0),
        ])),
      },
    });

    (polygon as Cesium.Entity & { _markMeta?: Record<string, unknown> })._markMeta = {
      type: 'polygon',
      controlPoints: [
        Cesium.Cartesian3.fromDegrees(0, 0, 0),
        Cesium.Cartesian3.fromDegrees(2, 0, 0),
        Cesium.Cartesian3.fromDegrees(1, 2, 0),
      ],
      color: '#00A3FF',
    };

    service.entities.set(String(polygon.id), polygon);

    expect(service.startEdit(polygon, { outputCoordSystem: 'WGS84' })).toBe(true);

    const editState = service.editState as Record<string, any>;
    const handle = editState.handleEntities[1] as Cesium.Entity;
    scenePick.mockReturnValue({ id: handle });

    const moved = Cesium.Cartesian3.fromDegrees(2.5, 0.5, 0);
    globePick.mockReturnValue(moved);

    const handler = FakeScreenSpaceEventHandler.instances[0];
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_DOWN, { position: { x: 18, y: 18 } });
    handler.trigger(Cesium.ScreenSpaceEventType.MOUSE_MOVE, { endPosition: { x: 32, y: 34 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_UP, {});

    const changeResult = callbacks.onEditChange.mock.calls[0][0];
    expect(changeResult.positions).toHaveLength(3);
    expect(changeResult.positions[1].longitude).toBeCloseTo(2.5, 6);
    expect(changeResult.positions[1].latitude).toBeCloseTo(0.5, 6);

    const endResult = service.stopEdit();
    const finalPositions = endResult?.cartesian3Positions.map(toDegrees) ?? [];
    expect(finalPositions[1].longitude).toBeCloseTo(2.5, 6);
    expect(finalPositions[1].latitude).toBeCloseTo(0.5, 6);
    expect(callbacks.onEditEnd).toHaveBeenCalledTimes(1);
  });
});
