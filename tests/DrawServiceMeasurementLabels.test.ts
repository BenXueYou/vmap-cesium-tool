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

function finishLineDrawing(
  options?: Parameters<InstanceType<typeof DrawService>['startDrawingLine']>[0],
): InstanceType<typeof Cesium.Entity>[] {
  const { entities, globePick, viewer } = createViewerStub();
  const service = new DrawService(viewer);
  service.startDrawingLine(options);

  const firstPoint = Cesium.Cartesian3.fromDegrees(120, 30);
  const secondPoint = Cesium.Cartesian3.fromDegrees(120.01, 30.01);
  globePick
    .mockReturnValueOnce(firstPoint)
    .mockReturnValueOnce(secondPoint)
    .mockReturnValueOnce(secondPoint);

  const handler = FakeScreenSpaceEventHandler.instances.at(-1)!;
  handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 10, y: 10 } });
  handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 20, y: 20 } });
  handler.trigger(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK, { position: { x: 20, y: 20 } });

  return entities;
}

function finishLineDrawingWithResult(
  options?: Parameters<InstanceType<typeof DrawService>['startDrawingLine']>[0],
  secondPoint = Cesium.Cartesian3.fromDegrees(120, 30),
): { entities: InstanceType<typeof Cesium.Entity>[]; result: unknown } {
  const { entities, globePick, viewer } = createViewerStub();
  const service = new DrawService(viewer);
  let result: unknown = undefined;
  service.onDrawEnd((drawResult) => {
    result = drawResult;
  });
  service.startDrawingLine(options);

  const firstPoint = Cesium.Cartesian3.fromDegrees(120, 30);
  globePick
    .mockReturnValueOnce(firstPoint)
    .mockReturnValueOnce(secondPoint)
    .mockReturnValueOnce(secondPoint);

  const handler = FakeScreenSpaceEventHandler.instances.at(-1)!;
  handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 10, y: 10 } });
  handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 20, y: 20 } });
  handler.trigger(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK, { position: { x: 20, y: 20 } });

  return { entities, result };
}

function finishPolygonDrawing(
  options?: Parameters<InstanceType<typeof DrawService>['startDrawingPolygon']>[0],
): InstanceType<typeof Cesium.Entity>[] {
  const { entities, globePick, viewer } = createViewerStub();
  const service = new DrawService(viewer);
  service.startDrawingPolygon(options);

  const firstPoint = Cesium.Cartesian3.fromDegrees(120, 30);
  const secondPoint = Cesium.Cartesian3.fromDegrees(120.01, 30.01);
  const thirdPoint = Cesium.Cartesian3.fromDegrees(120.02, 30);
  globePick
    .mockReturnValueOnce(firstPoint)
    .mockReturnValueOnce(secondPoint)
    .mockReturnValueOnce(thirdPoint)
    .mockReturnValueOnce(thirdPoint);

  const handler = FakeScreenSpaceEventHandler.instances.at(-1)!;
  handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 10, y: 10 } });
  handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 20, y: 20 } });
  handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 30, y: 10 } });
  handler.trigger(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK, { position: { x: 30, y: 10 } });

  return entities;
}

describe('DrawService measurement labels', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeScreenSpaceEventHandler.instances.length = 0;
  });

  it('does not add line distance labels during normal drawing by default', () => {
    installCanvasStub();

    const entities = finishLineDrawing();

    expect(entities.some((entity) => !!entity.billboard)).toBe(false);
  });

  it('rejects a zero-length polyline when double-click finishes on the same point', () => {
    installCanvasStub();

    const { entities, result } = finishLineDrawingWithResult();

    expect(result).toBeNull();
    expect(entities.some((entity) => !!entity.polyline)).toBe(false);
  });

  it('rejects a polyline at or below minPolylineLength', () => {
    installCanvasStub();

    const { result } = finishLineDrawingWithResult(
      { minPolylineLength: 2_000 },
      Cesium.Cartesian3.fromDegrees(120.01, 30.01),
    );

    expect(result).toBeNull();
  });

  it('adds line distance labels when explicitly enabled', () => {
    installCanvasStub();

    const entities = finishLineDrawing({ showDistanceLabel: true });

    expect(entities.some((entity) => !!entity.billboard)).toBe(true);
  });

  it('does not add polygon area labels during normal drawing by default', () => {
    installCanvasStub();

    const entities = finishPolygonDrawing();

    expect(entities.some((entity) => !!entity.billboard)).toBe(false);
  });

  it('adds polygon area labels when explicitly enabled', () => {
    installCanvasStub();

    const entities = finishPolygonDrawing({ showAreaLabel: true });

    expect(entities.some((entity) => !!entity.billboard)).toBe(true);
  });
});
