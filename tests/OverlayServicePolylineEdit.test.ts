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
  service.drawInteractionActive = false;
  service.cameraHoverSuspended = false;
  service.options = {
    enableHoverHandler: true,
    clickPickMinIntervalMs: 250,
    picking: {},
    onOverlayEditChange,
    onOverlayEditEnd: vi.fn(),
  };
  service.activateSelectionForOverlayEdit = vi.fn();
  return { service: service as OverlayService & Record<string, any>, onOverlayEditChange };
}

function readHandleColor(entity: Cesium.Entity) {
  return entity.point?.color?.getValue(Cesium.JulianDate.now());
}

function readHandleMeta(entity: Cesium.Entity): Record<string, unknown> | null {
  return (entity as Cesium.Entity & { __vmapOverlayEditHandleMeta?: Record<string, unknown> }).__vmapOverlayEditHandleMeta || null;
}

describe('OverlayService polyline edit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    FakeScreenSpaceEventHandler.instances.length = 0;
  });

  it('shows blue vertex handles and pink midpoint handles, and inserts a new landed point on midpoint press even without drag', () => {
    const { viewer, scenePick, globePick, store } = createViewerStub();
    const { service, onOverlayEditChange } = createService(viewer);
    const polyline = new Cesium.Entity({
      id: 'line-1',
      polyline: {
        positions: new Cesium.ConstantProperty([
          Cesium.Cartesian3.fromDegrees(0, 0, 0),
          Cesium.Cartesian3.fromDegrees(1, 0, 0),
          Cesium.Cartesian3.fromDegrees(2, 0, 0),
        ]),
      },
    });

    service.overlays.set('line-1', {
      getEntity: () => polyline,
      remove: vi.fn(),
    });
    service.creationOrderById.set('line-1', 1);

    expect(service.startOverlayEdit('line-1')).toBe(true);

    let state = service.overlayEditState as Record<string, any>;
    expect(state.handles).toHaveLength(5);
    expect(store).toHaveLength(5);
    expect(readHandleColor(state.handles[0])).toEqual(Cesium.Color.fromCssColorString('#1e88e5'));
    expect(readHandleColor(state.handles[3])).toEqual(Cesium.Color.fromCssColorString('#ec407a'));
    expect(state.handles.every((handle: Cesium.Entity) => {
      const role = readHandleMeta(handle)?.role;
      return role === 'vertex' || role === 'mid';
    })).toBe(true);

    const midpointHandle = state.handles[3] as Cesium.Entity;
    const inserted = Cesium.Cartesian3.fromDegrees(0.5, 0.25, 0);
    scenePick.mockReturnValue({ id: midpointHandle });
    globePick.mockReturnValue(inserted);

    const handler = FakeScreenSpaceEventHandler.instances[0];
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_DOWN, { position: { x: 12, y: 16 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_UP, {});

    state = service.overlayEditState as Record<string, any>;
    expect(state.handles).toHaveLength(7);
    expect(onOverlayEditChange).toHaveBeenCalledTimes(1);

    const positions = polyline.polyline?.positions?.getValue(Cesium.JulianDate.now()) as Cesium.Cartesian3[];
    expect(positions).toHaveLength(4);
    expect(Cesium.Cartesian3.equalsEpsilon(positions[1], inserted, 1e-8)).toBe(true);
  });

  it('creates rotate and scale handles only when explicitly enabled and applies the transform without breaking the line', () => {
    const { viewer, scenePick, globePick } = createViewerStub();
    const { service, onOverlayEditChange } = createService(viewer);
    const polyline = new Cesium.Entity({
      id: 'line-rotate-1',
      polyline: {
        positions: new Cesium.ConstantProperty([
          Cesium.Cartesian3.fromDegrees(0, 0, 0),
          Cesium.Cartesian3.fromDegrees(1, 1, 0),
          Cesium.Cartesian3.fromDegrees(2, 0, 0),
        ]),
      },
    });

    service.overlays.set('line-rotate-1', {
      getEntity: () => polyline,
      remove: vi.fn(),
    });
    service.creationOrderById.set('line-rotate-1', 1);

    expect(service.startOverlayEdit('line-rotate-1', { rotate: true, scale: true })).toBe(true);

    let state = service.overlayEditState as Record<string, any>;
    expect(state.handles).toHaveLength(7);
    expect(readHandleMeta(state.handles[5])?.role).toBe('rotate');
    expect(readHandleMeta(state.handles[6])?.role).toBe('scale');

    const scaleHandle = state.handles[6] as Cesium.Entity;
    const anchor = Cesium.Cartesian3.fromDegrees(1.3, 0.6, 0);
    const moved = Cesium.Cartesian3.fromDegrees(1.6, 0.9, 0);
    scenePick.mockReturnValue({ id: scaleHandle });
    globePick.mockReturnValueOnce(anchor).mockReturnValueOnce(moved);

    const handler = FakeScreenSpaceEventHandler.instances[0];
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_DOWN, { position: { x: 20, y: 24 } });

    state = service.overlayEditState as Record<string, any>;
    const startPositions = state.transformStartPositions as Cesium.Cartesian3[];
    const startCenter = state.transformStartCenter as Cesium.Cartesian3;
    const startAngle = state.transformStartAngle as number;
    const startDistance = state.transformStartDistance as number;
    const info = service.getLocalAngleAndDistance(startCenter, moved);
    const expected = service.applyRotateScaleToPositions(
      startPositions,
      startCenter,
      info.angle - startAngle,
      Math.max(0.2, Math.min(5, info.distance / startDistance)),
    );

    handler.trigger(Cesium.ScreenSpaceEventType.MOUSE_MOVE, { endPosition: { x: 32, y: 36 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_UP, {});

    const positions = polyline.polyline?.positions?.getValue(Cesium.JulianDate.now()) as Cesium.Cartesian3[];
    expect(positions).toHaveLength(3);
    expect(Cesium.Cartesian3.equalsEpsilon(positions[0], expected[0], 1e-8)).toBe(true);
    expect(Cesium.Cartesian3.equalsEpsilon(positions[1], expected[1], 1e-8)).toBe(true);
    expect(Cesium.Cartesian3.equalsEpsilon(positions[2], expected[2], 1e-8)).toBe(true);
    expect(onOverlayEditChange).toHaveBeenCalledTimes(1);
  });

  it('removes only vertex handles down to the two-point floor and keeps backtracking edits legal', () => {
    const { viewer, scenePick, globePick } = createViewerStub();
    const { service, onOverlayEditChange } = createService(viewer);
    const polyline = new Cesium.Entity({
      id: 'line-2',
      polyline: {
        positions: new Cesium.ConstantProperty([
          Cesium.Cartesian3.fromDegrees(0, 0, 0),
          Cesium.Cartesian3.fromDegrees(1, 1, 0),
          Cesium.Cartesian3.fromDegrees(2, 0, 0),
        ]),
      },
    });

    service.overlays.set('line-2', {
      getEntity: () => polyline,
      remove: vi.fn(),
    });
    service.creationOrderById.set('line-2', 1);

    expect(service.startOverlayEdit('line-2', { rotate: true, scale: true })).toBe(true);

    const state = service.overlayEditState as Record<string, any>;
    const backtrackTarget = Cesium.Cartesian3.fromDegrees(0, 0, 0);
    service.applyDragForHandle(state, 1, backtrackTarget);

    let positions = polyline.polyline?.positions?.getValue(Cesium.JulianDate.now()) as Cesium.Cartesian3[];
    expect(Cesium.Cartesian3.equalsEpsilon(positions[1], backtrackTarget, 1e-8)).toBe(true);

    const secondVertexHandle = state.handles[1] as Cesium.Entity;
    scenePick.mockReturnValue({ id: secondVertexHandle });

    const handler = FakeScreenSpaceEventHandler.instances[0];
    handler.trigger(Cesium.ScreenSpaceEventType.RIGHT_CLICK, { position: { x: 24, y: 18 } });

    positions = polyline.polyline?.positions?.getValue(Cesium.JulianDate.now()) as Cesium.Cartesian3[];
    expect(positions).toHaveLength(2);
    expect(onOverlayEditChange).toHaveBeenCalledTimes(1);

    const firstVertexHandle = (service.overlayEditState as Record<string, any>).handles[0] as Cesium.Entity;
    scenePick.mockReturnValue({ id: firstVertexHandle });
    handler.trigger(Cesium.ScreenSpaceEventType.RIGHT_CLICK, { position: { x: 30, y: 20 } });

    positions = polyline.polyline?.positions?.getValue(Cesium.JulianDate.now()) as Cesium.Cartesian3[];
    expect(positions).toHaveLength(2);
    expect(onOverlayEditChange).toHaveBeenCalledTimes(1);
    expect((service.overlayEditState as Record<string, any>).handles.some((handle: Cesium.Entity) => readHandleMeta(handle)?.role === 'rotate')).toBe(true);
    expect((service.overlayEditState as Record<string, any>).handles.some((handle: Cesium.Entity) => readHandleMeta(handle)?.role === 'scale')).toBe(true);
  });
});
