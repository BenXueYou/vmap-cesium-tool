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
const { OverlayService } = await import('../src/core/services/overlay/OverlayService');

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
        canvas: { style: { cursor: '' } },
        pick: scenePick,
        globe: {
          ellipsoid: Cesium.Ellipsoid.WGS84,
          pick: globePick,
        },
        requestRender: vi.fn(),
        screenSpaceCameraController: {
          enableInputs: true,
          enableTranslate: true,
          enableRotate: true,
          enableTilt: true,
          enableLook: true,
        },
      },
      camera: {
        getPickRay: vi.fn(() => ({})),
        pickEllipsoid: vi.fn(() => null),
      },
    } as unknown as Cesium.Viewer,
  };
}

function createService(viewer: Cesium.Viewer) {
  const onOverlayEditChange = vi.fn();
  const onOverlayEditEnd = vi.fn();
  const service = Object.create(OverlayService.prototype) as OverlayService & Record<string, any>;
  service.viewer = viewer;
  service.overlays = new Map();
  service.entityOverlayMap = new Map();
  service.creationOrderById = new Map();
  service.clickHighlightTargets = [];
  service.hoverHighlightTargets = [];
  service.selectionListeners = new Set();
  service.highlightCache = new WeakMap();
  service.overlayEditEnabled = false;
  service.overlayEditOptions = {};
  service.overlayEditState = null;
  service.selectedOverlayId = null;
  service.pendingHoverRaf = null;
  service.pendingHoverPosition = null;
  service.lastHoverPosition = null;
  service.hoverEnabled = true;
  service.selectionEnabled = true;
  service.drawInteractionActive = false;
  service.cameraHoverSuspended = false;
  service.options = {
    enableHoverHandler: true,
    clickPickMinIntervalMs: 250,
    picking: {},
    onOverlayEditChange,
    onOverlayEditEnd,
  };
  service.activateSelectionForOverlayEdit = vi.fn();
  return {
    service: service as OverlayService & Record<string, any>,
    onOverlayEditChange,
    onOverlayEditEnd,
  };
}

function readHierarchy(entity: Cesium.Entity): Cesium.Cartesian3[] {
  const hierarchy = entity.polygon?.hierarchy?.getValue(Cesium.JulianDate.now());
  const positions = Array.isArray(hierarchy) ? hierarchy : hierarchy?.positions;
  return Array.isArray(positions) ? positions : [];
}

describe('OverlayService point and polygon edit regression', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    FakeScreenSpaceEventHandler.instances.length = 0;
  });

  it('keeps point editing on the unified engine with realtime change and final end callbacks', () => {
    const { viewer, scenePick, globePick } = createViewerStub();
    const { service, onOverlayEditChange, onOverlayEditEnd } = createService(viewer);
    const point = new Cesium.Entity({
      id: 'point-1',
      position: new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(116.397, 39.907, 0)),
      point: {
        pixelSize: 12,
        color: Cesium.Color.YELLOW,
      },
    });

    service.overlays.set('point-1', {
      getEntity: () => point,
      remove: vi.fn(),
    });
    service.creationOrderById.set('point-1', 1);

    expect(service.startOverlayEdit('point-1')).toBe(true);

    const state = service.overlayEditState as Record<string, any>;
    expect(state.kind).toBe('point');
    expect(state.handles).toHaveLength(1);

    const handle = state.handles[0] as Cesium.Entity;
    scenePick.mockReturnValue({ id: handle });

    const moved = Cesium.Cartesian3.fromDegrees(116.3985, 39.9085, 0);
    globePick.mockReturnValue(moved);

    const handler = FakeScreenSpaceEventHandler.instances[0];
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_DOWN, { position: { x: 20, y: 24 } });
    handler.trigger(Cesium.ScreenSpaceEventType.MOUSE_MOVE, { endPosition: { x: 30, y: 34 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_UP, {});

    const updated = point.position?.getValue(Cesium.JulianDate.now());
    expect(updated).toBeTruthy();
    expect(Cesium.Cartesian3.equalsEpsilon(updated!, moved, 1e-8)).toBe(true);
    expect(onOverlayEditChange).toHaveBeenCalledTimes(1);

    expect(service.stopOverlayEdit()).toBe(point);
    expect(onOverlayEditEnd).toHaveBeenCalledTimes(1);
    expect(onOverlayEditEnd).toHaveBeenCalledWith(point);
    expect(service.overlayEditState).toBeNull();
  });

  it('keeps polygon vertex dragging on the unified engine and emits the final polygon state on stop', () => {
    const { viewer, scenePick, globePick } = createViewerStub();
    const { service, onOverlayEditChange, onOverlayEditEnd } = createService(viewer);
    const polygon = new Cesium.Entity({
      id: 'polygon-1',
      polygon: {
        hierarchy: new Cesium.ConstantProperty(new Cesium.PolygonHierarchy([
          Cesium.Cartesian3.fromDegrees(0, 0, 0),
          Cesium.Cartesian3.fromDegrees(2, 0, 0),
          Cesium.Cartesian3.fromDegrees(1, 2, 0),
        ])),
      },
    });

    service.overlays.set('polygon-1', {
      getEntity: () => polygon,
      remove: vi.fn(),
    });
    service.creationOrderById.set('polygon-1', 1);

    expect(service.startOverlayEdit('polygon-1')).toBe(true);

    const state = service.overlayEditState as Record<string, any>;
    expect(state.kind).toBe('polygon');
    expect(state.handles).toHaveLength(6);

    const draggedHandle = state.handles[1] as Cesium.Entity;
    const moved = Cesium.Cartesian3.fromDegrees(2.5, 0.5, 0);
    scenePick.mockReturnValue({ id: draggedHandle });
    globePick.mockReturnValue(moved);

    const handler = FakeScreenSpaceEventHandler.instances[0];
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_DOWN, { position: { x: 18, y: 22 } });
    handler.trigger(Cesium.ScreenSpaceEventType.MOUSE_MOVE, { endPosition: { x: 40, y: 44 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_UP, {});

    const positions = readHierarchy(polygon);
    expect(positions).toHaveLength(3);
    expect(Cesium.Cartesian3.equalsEpsilon(positions[1], moved, 1e-8)).toBe(true);
    expect(onOverlayEditChange).toHaveBeenCalledTimes(1);

    expect(service.stopOverlayEdit()).toBe(polygon);
    expect(onOverlayEditEnd).toHaveBeenCalledTimes(1);
    expect(onOverlayEditEnd).toHaveBeenCalledWith(polygon);
    expect(service.overlayEditState).toBeNull();
  });

  it('restores polygon midpoint insertion on closed edges and keeps right-click deletion above the triangle floor', () => {
    const { viewer, scenePick, globePick } = createViewerStub();
    const { service, onOverlayEditChange } = createService(viewer);
    const polygon = new Cesium.Entity({
      id: 'polygon-2',
      polygon: {
        hierarchy: new Cesium.ConstantProperty(new Cesium.PolygonHierarchy([
          Cesium.Cartesian3.fromDegrees(0, 0, 0),
          Cesium.Cartesian3.fromDegrees(2, 0, 0),
          Cesium.Cartesian3.fromDegrees(1, 2, 0),
        ])),
      },
    });

    service.overlays.set('polygon-2', {
      getEntity: () => polygon,
      remove: vi.fn(),
    });
    service.creationOrderById.set('polygon-2', 1);

    expect(service.startOverlayEdit('polygon-2')).toBe(true);

    let state = service.overlayEditState as Record<string, any>;
    expect(state.kind).toBe('polygon');
    expect(state.handles).toHaveLength(6);

    const midpointHandle = state.handles[4] as Cesium.Entity;
    const inserted = Cesium.Cartesian3.fromDegrees(1.5, 1, 0);
    scenePick.mockReturnValue({ id: midpointHandle });
    globePick.mockReturnValue(inserted);

    const handler = FakeScreenSpaceEventHandler.instances[0];
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_DOWN, { position: { x: 16, y: 18 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_UP, {});

    state = service.overlayEditState as Record<string, any>;
    expect(state.handles).toHaveLength(8);

    let positions = readHierarchy(polygon);
    expect(positions).toHaveLength(4);
    expect(Cesium.Cartesian3.equalsEpsilon(positions[2], inserted, 1e-8)).toBe(true);

    const insertedVertexHandle = state.handles[2] as Cesium.Entity;
    scenePick.mockReturnValue({ id: insertedVertexHandle });
    handler.trigger(Cesium.ScreenSpaceEventType.RIGHT_CLICK, { position: { x: 22, y: 28 } });

    positions = readHierarchy(polygon);
    expect(positions).toHaveLength(3);
    expect(onOverlayEditChange).toHaveBeenCalledTimes(2);

    const firstVertexHandle = (service.overlayEditState as Record<string, any>).handles[0] as Cesium.Entity;
    scenePick.mockReturnValue({ id: firstVertexHandle });
    handler.trigger(Cesium.ScreenSpaceEventType.RIGHT_CLICK, { position: { x: 24, y: 30 } });

    positions = readHierarchy(polygon);
    expect(positions).toHaveLength(3);
    expect(onOverlayEditChange).toHaveBeenCalledTimes(2);
  });
});
