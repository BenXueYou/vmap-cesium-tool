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

  it('keeps the first distinct radius point when circle clicks repeat the center or add extra points', () => {
    installCanvasStub();

    const { entities, globePick, viewer } = createViewerStub();
    const service = new DrawService(viewer);
    let result: unknown = undefined;
    service.onDrawEnd((drawResult) => {
      result = drawResult;
    });
    service.startDrawingCircle();

    const center = Cesium.Cartesian3.fromDegrees(120, 30);
    const radiusPoint = Cesium.Cartesian3.fromDegrees(120.01, 30.01);
    const ignoredPoint = Cesium.Cartesian3.fromDegrees(120.02, 30.02);
    globePick
      .mockReturnValueOnce(center)
      .mockReturnValueOnce(center)
      .mockReturnValueOnce(radiusPoint)
      .mockReturnValueOnce(ignoredPoint)
      .mockReturnValueOnce(ignoredPoint);

    const handler = FakeScreenSpaceEventHandler.instances.at(-1)!;
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 10, y: 10 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 10, y: 10 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 20, y: 20 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 30, y: 30 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK, { position: { x: 30, y: 30 } });

    expect(result).toMatchObject({ type: 'circle' });
    const circleResult = result as { positions: Cesium.Cartesian3[] };
    expect(circleResult.positions).toHaveLength(2);
    expect(Cesium.Cartesian3.equals(circleResult.positions[0], center)).toBe(true);
    expect(Cesium.Cartesian3.equals(circleResult.positions[1], radiusPoint)).toBe(true);
    expect(entities.some((entity) => !!entity.ellipse)).toBe(true);
  });

  it('keeps a circle session active when double-click occurs before an effective radius is set', () => {
    installCanvasStub();

    const { entities, globePick, viewer } = createViewerStub();
    const service = new DrawService(viewer);
    const onDrawEnd = vi.fn();
    service.onDrawEnd(onDrawEnd);
    service.startDrawingCircle();

    const center = Cesium.Cartesian3.fromDegrees(120, 30);
    globePick.mockReturnValueOnce(center).mockReturnValueOnce(center);

    const handler = FakeScreenSpaceEventHandler.instances.at(-1)!;
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 10, y: 10 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK, { position: { x: 20, y: 20 } });

    expect(service.isDrawingMode()).toBe(true);
    expect(service.getCurrentDrawMode()).toBe('circle');
    expect(onDrawEnd).not.toHaveBeenCalled();
    expect(entities.some((entity) => !!entity.ellipse)).toBe(false);
  });

  it('keeps a circle preview visible after an effective radius is confirmed and before completion', () => {
    installCanvasStub();

    const { entities, globePick, viewer } = createViewerStub();
    const service = new DrawService(viewer);
    service.startDrawingCircle();

    const center = Cesium.Cartesian3.fromDegrees(120, 30);
    const radiusPoint = Cesium.Cartesian3.fromDegrees(120.01, 30.01);
    globePick.mockReturnValueOnce(center).mockReturnValueOnce(radiusPoint);

    const handler = FakeScreenSpaceEventHandler.instances.at(-1)!;
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 10, y: 10 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 20, y: 20 } });

    expect(service.isDrawingMode()).toBe(true);
    expect(entities.some((entity) => !!entity.ellipse)).toBe(true);
  });

  it('keeps the first distinct rectangle endpoint when clicks repeat the start or add extra points', () => {
    installCanvasStub();

    const { entities, globePick, viewer } = createViewerStub();
    const service = new DrawService(viewer);
    let result: unknown = undefined;
    service.onDrawEnd((drawResult) => {
      result = drawResult;
    });
    service.startDrawingRectangle();

    const start = Cesium.Cartesian3.fromDegrees(120, 30);
    const end = Cesium.Cartesian3.fromDegrees(120.01, 30.01);
    const ignoredPoint = Cesium.Cartesian3.fromDegrees(120.02, 30.02);
    globePick
      .mockReturnValueOnce(start)
      .mockReturnValueOnce(start)
      .mockReturnValueOnce(end)
      .mockReturnValueOnce(ignoredPoint)
      .mockReturnValueOnce(ignoredPoint);

    const handler = FakeScreenSpaceEventHandler.instances.at(-1)!;
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 10, y: 10 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 10, y: 10 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 20, y: 20 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 30, y: 30 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK, { position: { x: 30, y: 30 } });

    expect(result).toMatchObject({ type: 'rectangle' });
    const rectangleResult = result as { positions: Cesium.Cartesian3[]; area?: number };
    expect(rectangleResult.positions).toHaveLength(4);
    const rectangleEnd = Cesium.Cartographic.fromCartesian(rectangleResult.positions[2]);
    expect(Cesium.Math.toDegrees(rectangleEnd.longitude)).toBeCloseTo(120.01, 8);
    expect(Cesium.Math.toDegrees(rectangleEnd.latitude)).toBeCloseTo(30.01, 8);
    expect(rectangleResult.area).toBeGreaterThan(0);
    expect(entities.some((entity) => !!entity.rectangle)).toBe(true);
  });

  it('keeps a rectangle session active when double-click occurs before an effective endpoint is set', () => {
    installCanvasStub();

    const { entities, globePick, viewer } = createViewerStub();
    const service = new DrawService(viewer);
    const onDrawEnd = vi.fn();
    service.onDrawEnd(onDrawEnd);
    service.startDrawingRectangle();

    const start = Cesium.Cartesian3.fromDegrees(120, 30);
    globePick.mockReturnValueOnce(start).mockReturnValueOnce(start);

    const handler = FakeScreenSpaceEventHandler.instances.at(-1)!;
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 10, y: 10 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK, { position: { x: 20, y: 20 } });

    expect(service.isDrawingMode()).toBe(true);
    expect(service.getCurrentDrawMode()).toBe('rectangle');
    expect(onDrawEnd).not.toHaveBeenCalled();
    expect(entities.some((entity) => !!entity.rectangle)).toBe(false);
  });

  it('keeps a rectangle preview visible after an effective endpoint is confirmed and before completion', () => {
    installCanvasStub();

    const { entities, globePick, viewer } = createViewerStub();
    const service = new DrawService(viewer);
    service.startDrawingRectangle();

    const start = Cesium.Cartesian3.fromDegrees(120, 30);
    const end = Cesium.Cartesian3.fromDegrees(120.01, 30.01);
    globePick.mockReturnValueOnce(start).mockReturnValueOnce(end);

    const handler = FakeScreenSpaceEventHandler.instances.at(-1)!;
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 10, y: 10 } });
    handler.trigger(Cesium.ScreenSpaceEventType.LEFT_CLICK, { position: { x: 20, y: 20 } });

    expect(service.isDrawingMode()).toBe(true);
    expect(entities.some((entity) => !!entity.rectangle)).toBe(true);
  });
});
