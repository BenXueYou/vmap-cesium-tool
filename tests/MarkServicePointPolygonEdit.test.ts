import { describe, expect, it, vi } from 'vitest';
import * as Cesium from 'cesium';
import { MarkService } from '../src/core/services/mark/MarkService';

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
  const callbacks = {
    onEditChange: vi.fn(),
    onEditEnd: vi.fn(),
  };
  const overlayService = {
    setOverlayEditMode: vi.fn(),
    startOverlayEdit: vi.fn(() => true),
    stopOverlayEdit: vi.fn(),
  };

  const service = Object.create(MarkService.prototype) as MarkService & Record<string, any>;
  service.viewer = viewer;
  service.entities = new Map();
  service.callbacks = callbacks;
  service.editState = null;
  service.editEnabled = false;
  service.overlayService = overlayService;

  return { service, callbacks, overlayService };
}

function toDegrees(point: Cesium.Cartesian3) {
  const cartographic = Cesium.Cartographic.fromCartesian(point);
  return {
    longitude: Cesium.Math.toDegrees(cartographic.longitude),
    latitude: Cesium.Math.toDegrees(cartographic.latitude),
  };
}

function expectDegrees(
  actual: Array<{ longitude: number; latitude: number }>,
  expected: Array<{ longitude: number; latitude: number }>,
) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((point, index) => {
    expect(point.longitude).toBeCloseTo(expected[index].longitude, 6);
    expect(point.latitude).toBeCloseTo(expected[index].latitude, 6);
  });
}

describe('MarkService point and polygon edit regression', () => {
  it('routes point editing through OverlayService and keeps mark metadata/results in sync', () => {
    const { viewer } = createViewerStub();
    const { service, callbacks, overlayService } = createService(viewer);
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

    expect(service.startEdit(point, {
      outputCoordSystem: 'WGS84',
      move: {
        color: '#00ff00',
        pixelSize: 13,
      },
    })).toBe(true);
    expect(overlayService.startOverlayEdit).toHaveBeenCalledTimes(1);

    const sessionOptions = overlayService.startOverlayEdit.mock.calls[0][1];
    expect(sessionOptions.move).toEqual({
      color: '#00ff00',
      pixelSize: 13,
    });
    overlayService.stopOverlayEdit.mockImplementation(() => sessionOptions.onEnd(point));

    point.position = new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(116.3985, 39.9085, 0));
    sessionOptions.onChange(point);

    const changeResult = callbacks.onEditChange.mock.calls[0][0];
    expect(changeResult.position.longitude).toBeCloseTo(116.3985, 6);
    expect(changeResult.position.latitude).toBeCloseTo(39.9085, 6);

    const metadata = (point as Cesium.Entity & { _markMeta?: { controlPoints: Cesium.Cartesian3[] } })._markMeta;
    expectDegrees(metadata?.controlPoints.map(toDegrees) ?? [], [
      { longitude: 116.3985, latitude: 39.9085 },
    ]);

    const endResult = service.stopEdit();
    expect(endResult?.position?.longitude).toBeCloseTo(116.3985, 6);
    expect(endResult?.position?.latitude).toBeCloseTo(39.9085, 6);
    expect(overlayService.stopOverlayEdit).toHaveBeenCalledTimes(1);
    expect(callbacks.onEditEnd).toHaveBeenCalledTimes(1);
    expect(service.editState).toBeNull();
    expect(service.editEnabled).toBe(false);
  });

  it('routes polygon editing through OverlayService and keeps mark metadata/results in sync', () => {
    const { viewer } = createViewerStub();
    const { service, callbacks, overlayService } = createService(viewer);
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
    expect(overlayService.startOverlayEdit).toHaveBeenCalledTimes(1);

    const sessionOptions = overlayService.startOverlayEdit.mock.calls[0][1];
    overlayService.stopOverlayEdit.mockImplementation(() => sessionOptions.onEnd(polygon));

    polygon.polygon!.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy([
      Cesium.Cartesian3.fromDegrees(0, 0, 0),
      Cesium.Cartesian3.fromDegrees(2.5, 0.5, 0),
      Cesium.Cartesian3.fromDegrees(1, 2, 0),
    ]));
    sessionOptions.onChange(polygon);

    const changeResult = callbacks.onEditChange.mock.calls[0][0];
    expectDegrees(
      (changeResult?.positions ?? []).map((point: any) => ({ longitude: point.longitude, latitude: point.latitude })),
      [
        { longitude: 0, latitude: 0 },
        { longitude: 2.5, latitude: 0.5 },
        { longitude: 1, latitude: 2 },
      ],
    );

    const metadata = (polygon as Cesium.Entity & { _markMeta?: { controlPoints: Cesium.Cartesian3[] } })._markMeta;
    expectDegrees(metadata?.controlPoints.map(toDegrees) ?? [], [
      { longitude: 0, latitude: 0 },
      { longitude: 2.5, latitude: 0.5 },
      { longitude: 1, latitude: 2 },
    ]);

    const endResult = service.stopEdit();
    expectDegrees(
      endResult?.cartesian3Positions.map(toDegrees) ?? [],
      [
        { longitude: 0, latitude: 0 },
        { longitude: 2.5, latitude: 0.5 },
        { longitude: 1, latitude: 2 },
      ],
    );
    expect(overlayService.stopOverlayEdit).toHaveBeenCalledTimes(1);
    expect(callbacks.onEditEnd).toHaveBeenCalledTimes(1);
    expect(service.editState).toBeNull();
    expect(service.editEnabled).toBe(false);
  });

  it('keeps polygon insert and delete edits flowing through the mark entrypoint', () => {
    const { viewer } = createViewerStub();
    const { service, callbacks, overlayService } = createService(viewer);
    const polygon = new Cesium.Entity({
      id: 'mark-polygon-edit-1',
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
    const sessionOptions = overlayService.startOverlayEdit.mock.calls[0][1];

    polygon.polygon!.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy([
      Cesium.Cartesian3.fromDegrees(0, 0, 0),
      Cesium.Cartesian3.fromDegrees(2, 0, 0),
      Cesium.Cartesian3.fromDegrees(1.5, 1, 0),
      Cesium.Cartesian3.fromDegrees(1, 2, 0),
    ]));
    sessionOptions.onChange(polygon);

    let changeResult = callbacks.onEditChange.mock.calls.at(-1)?.[0];
    expect(changeResult?.positions).toHaveLength(4);

    polygon.polygon!.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy([
      Cesium.Cartesian3.fromDegrees(0, 0, 0),
      Cesium.Cartesian3.fromDegrees(2, 0, 0),
      Cesium.Cartesian3.fromDegrees(1, 2, 0),
    ]));
    sessionOptions.onChange(polygon);

    changeResult = callbacks.onEditChange.mock.calls.at(-1)?.[0];
    expect(changeResult?.positions).toHaveLength(3);

    overlayService.stopOverlayEdit.mockImplementation(() => sessionOptions.onEnd(polygon));
    const endResult = service.stopEdit();
    expect(endResult?.positions).toHaveLength(3);
    expect(callbacks.onEditEnd).toHaveBeenCalledTimes(1);
  });
});
