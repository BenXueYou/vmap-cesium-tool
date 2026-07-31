import { afterEach, describe, expect, it, vi } from 'vitest';

class FakeScreenSpaceEventHandler {
  private readonly actions = new Map<number, (payload: any) => void>();

  constructor(_canvas: unknown) {}

  setInputAction(callback: (payload: any) => void, type: number): void {
    this.actions.set(type, callback);
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

  return {
    store,
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
        globe: {
          ellipsoid: Cesium.Ellipsoid.WGS84,
          pick: vi.fn(() => null),
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
        getPickRay: vi.fn(() => null),
        pickEllipsoid: vi.fn(() => null),
      },
    } as unknown as Cesium.Viewer,
  };
}

function createService(viewer: Cesium.Viewer) {
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
    onOverlayEditChange: vi.fn(),
    onOverlayEditEnd: vi.fn(),
  };
  service.activateSelectionForOverlayEdit = vi.fn();
  return service as OverlayService & Record<string, any>;
}

describe('OverlayService circle edit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts editing a primitive circle by deriving the center from primitive metadata', () => {
    const { viewer, store } = createViewerStub();
    const service = createService(viewer);
    const circle = new Cesium.Entity({ id: 'circle-1' });
    const center = Cesium.Cartographic.fromDegrees(116.397, 39.907, 0);

    (circle as Cesium.Entity & Record<string, unknown>)._overlayType = 'circle-primitive';
    (circle as Cesium.Entity & Record<string, unknown>)._outerRadius = 900;
    (circle as Cesium.Entity & Record<string, unknown>)._centerCartographic = center;

    service.overlays.set('circle-1', {
      getEntity: () => circle,
      remove: vi.fn(),
    });
    service.creationOrderById.set('circle-1', 1);

    expect(service.startOverlayEdit('circle-1')).toBe(true);

    const state = service.overlayEditState as Record<string, any>;
    expect(state).toBeTruthy();
    expect(state.kind).toBe('circle');
    expect(state.handles).toHaveLength(2);
    expect(store).toHaveLength(2);
  });
});
