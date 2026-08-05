import { describe, expect, it, vi } from 'vitest';
import * as Cesium from 'cesium';
import { MarkService } from '../src/core/services/mark/MarkService';

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
  return {
    viewer: {
      scene: {
        requestRender: vi.fn(),
      },
    } as unknown as Cesium.Viewer,
  };
}

function createService(viewer: Cesium.Viewer) {
  const overlayService = {
    setOverlayEditMode: vi.fn(),
    startOverlayEdit: vi.fn(() => true),
    stopOverlayEdit: vi.fn(),
  };

  const service = Object.create(MarkService.prototype) as MarkService & Record<string, any>;
  service.viewer = viewer;
  service.entities = new Map();
  service.callbacks = {
    onEditChange: vi.fn(),
    onEditEnd: vi.fn(),
  };
  service.editState = null;
  service.editEnabled = false;
  service.overlayService = overlayService;
  return { service, overlayService };
}

describe('MarkService rectangle edit', () => {
  it('routes rectangle editing through OverlayService and keeps mark metadata/results in sync', () => {
    const { viewer } = createViewerStub();
    const { service, overlayService } = createService(viewer);
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

    expect(service.startEdit(rectangle, { outputCoordSystem: 'WGS84' })).toBe(true);
    expect(overlayService.startOverlayEdit).toHaveBeenCalledTimes(1);

    rectangle.rectangle!.coordinates = new Cesium.ConstantProperty(Cesium.Rectangle.fromDegrees(0, 0, 1, 1));
    const sessionOptions = overlayService.startOverlayEdit.mock.calls[0][1];
    sessionOptions.onChange(rectangle);

    const changeResult = service.callbacks.onEditChange.mock.calls[0][0];
    expectDegrees(
      (changeResult?.positions ?? []).map((point: any) => ({ longitude: point.longitude, latitude: point.latitude })),
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

    sessionOptions.onEnd(rectangle);
    const endResult = service.callbacks.onEditEnd.mock.calls[0][0];
    expectDegrees(
      (endResult?.positions ?? []).map((point: any) => ({ longitude: point.longitude, latitude: point.latitude })),
      [
        { longitude: 0, latitude: 0 },
        { longitude: 1, latitude: 0 },
        { longitude: 1, latitude: 1 },
        { longitude: 0, latitude: 1 },
      ],
    );
    expect(service.editState).toBeNull();
    expect(service.editEnabled).toBe(false);
  });
});
