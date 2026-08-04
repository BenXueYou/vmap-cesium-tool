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
const { DrawService } = await import('../src/core/services/draw/DrawService');

function installCanvasStub(): void {
  const context = {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    lineTo: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
  };
  vi.stubGlobal('document', {
    createElement: vi.fn(() => ({
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    })),
  });
}

function createViewerStub() {
  const entities: InstanceType<typeof Cesium.Entity>[] = [];
  const globePick = vi.fn();
  const event = { addEventListener: vi.fn(() => () => undefined) };
  const scene = {
    canvas: {},
    ellipsoid: Cesium.Ellipsoid.WGS84,
    frameState: { context: { depthTexture: true } },
    getHeight: vi.fn(() => undefined),
    globe: {
      ellipsoid: Cesium.Ellipsoid.WGS84,
      pick: globePick,
    },
    morphComplete: event,
    terrainProviderChanged: event,
    updateHeight: vi.fn(() => () => undefined),
  };
  const viewer = {
    camera: {
      getPickRay: vi.fn(() => ({})),
      pickEllipsoid: vi.fn(() => null),
    },
    entities: {
      add(options: InstanceType<typeof Cesium.Entity> | Cesium.Entity.ConstructorOptions) {
        const entity = options instanceof Cesium.Entity ? options : new Cesium.Entity(options);
        if (entity.polygon) {
          new Cesium.PolygonGeometryUpdater(entity, scene as unknown as Cesium.Scene);
        }
        entities.push(entity);
        return entity;
      },
      remove(entity: InstanceType<typeof Cesium.Entity>) {
        const index = entities.indexOf(entity);
        if (index < 0) {
          return false;
        }
        entities.splice(index, 1);
        return true;
      },
    },
    scene,
  } as unknown as Cesium.Viewer;

  return { entities, globePick, viewer };
}

function triggerTwoClicksAndPreview(
  globePick: ReturnType<typeof vi.fn>,
  previewPoint: InstanceType<typeof Cesium.Cartesian3>,
): void {
  const firstPoint = Cesium.Cartesian3.fromDegrees(120, 30);
  const secondPoint = Cesium.Cartesian3.fromDegrees(120.01, 30.01);
  globePick
    .mockReturnValueOnce(firstPoint)
    .mockReturnValueOnce(secondPoint)
    .mockReturnValueOnce(previewPoint);

  const handler = FakeScreenSpaceEventHandler.instances[0];
  handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 10, y: 10 } });
  handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 20, y: 20 } });
  handler.trigger(Cesium.ScreenSpaceEventType.MOUSE_MOVE, { endPosition: { x: 20, y: 20 } });
}

describe('DrawService polygon preview', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeScreenSpaceEventHandler.instances.length = 0;
  });

  it('keeps rendering when the preview point overlaps the last committed point', () => {
    installCanvasStub();
    const { globePick, viewer } = createViewerStub();
    const service = new DrawService(viewer);
    service.startDrawingPolygon();
    const overlappingPreview = Cesium.Cartesian3.fromDegrees(120.01, 30.01);

    expect(() => triggerTwoClicksAndPreview(globePick, overlappingPreview)).not.toThrow();
  });

  it('renders a polygon when the preview candidate has three distinct non-collinear points', () => {
    installCanvasStub();
    const { entities, globePick, viewer } = createViewerStub();
    const service = new DrawService(viewer);
    service.startDrawingPolygon();
    const validPreview = Cesium.Cartesian3.fromDegrees(120.02, 30);

    triggerTwoClicksAndPreview(globePick, validPreview);

    expect(entities.some((entity) => !!entity.polygon)).toBe(true);
  });

  it('keeps only the line preview when three distinct points are collinear', () => {
    installCanvasStub();
    const { entities, globePick, viewer } = createViewerStub();
    const service = new DrawService(viewer);
    service.startDrawingPolygon();
    const firstPoint = Cesium.Cartesian3.fromDegrees(120, 30);
    const secondPoint = Cesium.Cartesian3.fromDegrees(120.01, 30.01);
    const collinearPreview = Cesium.Cartesian3.lerp(firstPoint, secondPoint, 2, new Cesium.Cartesian3());

    triggerTwoClicksAndPreview(globePick, collinearPreview);

    expect(entities.some((entity) => !!entity.polygon)).toBe(false);
  });

  it('still completes a valid polygon after preview validation', () => {
    installCanvasStub();
    const { globePick, viewer } = createViewerStub();
    const service = new DrawService(viewer);
    const onDrawEnd = vi.fn();
    service.onDrawEnd(onDrawEnd);
    service.startDrawingPolygon();
    const firstPoint = Cesium.Cartesian3.fromDegrees(120, 30);
    const secondPoint = Cesium.Cartesian3.fromDegrees(120.01, 30.01);
    const thirdPoint = Cesium.Cartesian3.fromDegrees(120.02, 30);
    globePick
      .mockReturnValueOnce(firstPoint)
      .mockReturnValueOnce(secondPoint)
      .mockReturnValueOnce(thirdPoint)
      .mockReturnValueOnce(thirdPoint);

    const handler = FakeScreenSpaceEventHandler.instances[0];
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 10, y: 10 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 20, y: 20 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 30, y: 10 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK, { position: { x: 30, y: 10 } });

    expect(onDrawEnd).toHaveBeenCalledWith(expect.objectContaining({ type: 'polygon' }));
  });
});
