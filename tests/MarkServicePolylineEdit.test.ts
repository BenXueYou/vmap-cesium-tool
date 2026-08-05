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
  const service = Object.create(MarkService.prototype) as MarkService & Record<string, any>;
  service.viewer = viewer;
  service.entities = new Map();
  service.callbacks = {
    onEditChange: vi.fn(),
  };
  service.editState = null;
  service.editEnabled = false;
  service.overlayService = {
    setOverlayEditMode: vi.fn(),
  };
  return service;
}

function readHandleColor(entity: Cesium.Entity) {
  return entity.point?.color?.getValue(Cesium.JulianDate.now());
}

describe('MarkService polyline edit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    FakeScreenSpaceEventHandler.instances.length = 0;
  });

  it('restores midpoint insertion and right-click vertex deletion for polylines', () => {
    const { viewer, scenePick, globePick } = createViewerStub();
    const service = createService(viewer);
    const polyline = new Cesium.Entity({
      id: 'mark-line-1',
      polyline: {
        positions: new Cesium.ConstantProperty([
          Cesium.Cartesian3.fromDegrees(0, 0, 0),
          Cesium.Cartesian3.fromDegrees(1, 0, 0),
          Cesium.Cartesian3.fromDegrees(2, 0, 0),
        ]),
      },
    });

    (polyline as Cesium.Entity & { _markMeta?: Record<string, unknown> })._markMeta = {
      type: 'polyline',
      controlPoints: [
        Cesium.Cartesian3.fromDegrees(0, 0, 0),
        Cesium.Cartesian3.fromDegrees(1, 0, 0),
        Cesium.Cartesian3.fromDegrees(2, 0, 0),
      ],
      color: '#00A3FF',
    };

    service.entities.set(String(polyline.id), polyline);

    expect(service.startEdit(polyline)).toBe(true);

    let editState = service.editState as Record<string, any>;
    expect(editState.handleEntities).toHaveLength(5);
    expect(readHandleColor(editState.handleEntities[0])).toEqual(Cesium.Color.fromCssColorString('#1e88e5'));
    expect(readHandleColor(editState.handleEntities[3])).toEqual(Cesium.Color.fromCssColorString('#ec407a'));

    const inserted = Cesium.Cartesian3.fromDegrees(0.5, 0.3, 0);
    scenePick.mockReturnValue({ id: editState.handleEntities[3] });
    globePick.mockReturnValue(inserted);

    const handler = FakeScreenSpaceEventHandler.instances[0];
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_DOWN, { position: { x: 14, y: 14 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_UP, {});

    editState = service.editState as Record<string, any>;
    let metadata = (polyline as Cesium.Entity & { _markMeta?: { controlPoints: Cesium.Cartesian3[] } })._markMeta;
    expect(editState.handleEntities).toHaveLength(7);
    expect(metadata?.controlPoints).toHaveLength(4);
    expect(Cesium.Cartesian3.equalsEpsilon(metadata!.controlPoints[1], inserted, 1e-8)).toBe(true);

    scenePick.mockReturnValue({ id: editState.handleEntities[1] });
    handler.trigger(Cesium.ScreenSpaceEventType.RIGHT_CLICK, { position: { x: 18, y: 18 } });

    metadata = (polyline as Cesium.Entity & { _markMeta?: { controlPoints: Cesium.Cartesian3[] } })._markMeta;
    expect(metadata?.controlPoints).toHaveLength(3);
    expect(service.callbacks.onEditChange).toHaveBeenCalledTimes(2);
  });
});
