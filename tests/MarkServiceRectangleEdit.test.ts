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
const { buildMarkDrawResult } = await import('../src/core/services/mark/markResult');

function toDegrees(point: Cesium.Cartesian3) {
  const cartographic = Cesium.Cartographic.fromCartesian(point);
  return {
    longitude: Cesium.Math.toDegrees(cartographic.longitude),
    latitude: Cesium.Math.toDegrees(cartographic.latitude),
  };
}

function expectDegrees(actual: Array<{ longitude: number; latitude: number }>, expected: Array<{ longitude: number; latitude: number }>) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((point, index) => {
    expect(point.longitude).toBeCloseTo(expected[index].longitude, 6);
    expect(point.latitude).toBeCloseTo(expected[index].latitude, 6);
  });
}

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
  const service = Object.create(MarkService.prototype) as MarkService & Record<string, any>;
  service.viewer = viewer;
  service.entities = new Map();
  service.callbacks = {};
  service.editState = null;
  service.editEnabled = false;
  service.overlayService = {
    setOverlayEditMode: vi.fn(),
  };
  return service;
}

describe('MarkService rectangle edit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    FakeScreenSpaceEventHandler.instances.length = 0;
  });

  it('keeps rectangle geometry and exported control points in sync while dragging a corner handle inward', () => {
    const { viewer, scenePick, globePick } = createViewerStub();
    const service = createService(viewer);
    const rectangle = new Cesium.Entity({
      id: 'rect-1',
      rectangle: {
        coordinates: new Cesium.ConstantProperty(Cesium.Rectangle.fromDegrees(0, 0, 2, 2)),
      },
    });

    const southWest = Cesium.Cartesian3.fromDegrees(0, 0, 0);
    const southEast = Cesium.Cartesian3.fromDegrees(2, 0, 0);
    const northEast = Cesium.Cartesian3.fromDegrees(2, 2, 0);
    const northWest = Cesium.Cartesian3.fromDegrees(0, 2, 0);
    (rectangle as Cesium.Entity & { _markMeta?: Record<string, unknown> })._markMeta = {
      type: 'rectangle',
      controlPoints: [southWest, southEast, northEast, northWest],
      color: '#00A3FF',
    };

    service.entities.set(String(rectangle.id), rectangle);

    expect(service.startEdit(rectangle)).toBe(true);

    const editState = service.editState as Record<string, any>;
    const draggedHandle = editState.handleEntities[2] as Cesium.Entity;
    const movedNorthEast = Cesium.Cartesian3.fromDegrees(1, 1, 0);
    scenePick.mockReturnValue({ id: draggedHandle });
    globePick.mockReturnValue(movedNorthEast);

    const handler = FakeScreenSpaceEventHandler.instances[0];
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_DOWN, { position: { x: 10, y: 10 } });
    handler.trigger(Cesium.ScreenSpaceEventType.MOUSE_MOVE, { endPosition: { x: 20, y: 20 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_UP, {});

    const editedRect = rectangle.rectangle?.coordinates?.getValue(Cesium.JulianDate.now());
    expect(editedRect).toBeTruthy();
    expect(Cesium.Math.toDegrees(editedRect!.west)).toBeCloseTo(0, 6);
    expect(Cesium.Math.toDegrees(editedRect!.south)).toBeCloseTo(0, 6);
    expect(Cesium.Math.toDegrees(editedRect!.east)).toBeCloseTo(1, 6);
    expect(Cesium.Math.toDegrees(editedRect!.north)).toBeCloseTo(1, 6);

    const result = buildMarkDrawResult(rectangle, 'WGS84');
    expectDegrees(
      (result?.positions ?? []).map((point) => ({ longitude: point.longitude, latitude: point.latitude })),
      [
        { longitude: 0, latitude: 0 },
        { longitude: 1, latitude: 0 },
        { longitude: 1, latitude: 1 },
        { longitude: 0, latitude: 1 },
      ],
    );

    const metadata = (rectangle as Cesium.Entity & { _markMeta?: { controlPoints: Cesium.Cartesian3[] } })._markMeta;
    expectDegrees(metadata?.controlPoints.map(toDegrees) ?? [], [
      { longitude: 0, latitude: 0 },
      { longitude: 1, latitude: 0 },
      { longitude: 1, latitude: 1 },
      { longitude: 0, latitude: 1 },
    ]);
  });
});
