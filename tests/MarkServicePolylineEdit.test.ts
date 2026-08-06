import { describe, expect, it, vi } from 'vitest';
import * as Cesium from 'cesium';
import { MarkService } from '../src/core/services/mark/MarkService';

function createService() {
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
  service.viewer = {
    scene: {
      requestRender: vi.fn(),
    },
  };
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

describe('MarkService polyline edit', () => {
  it('routes polyline editing through OverlayService and keeps mark metadata/results in sync', () => {
    const { service, callbacks, overlayService } = createService();
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

    expect(service.startEdit(polyline, { outputCoordSystem: 'WGS84' })).toBe(true);
    expect(overlayService.startOverlayEdit).toHaveBeenCalledTimes(1);

    const sessionOptions = overlayService.startOverlayEdit.mock.calls[0][1];
    overlayService.stopOverlayEdit.mockImplementation(() => sessionOptions.onEnd(polyline));

    polyline.polyline!.positions = new Cesium.ConstantProperty([
      Cesium.Cartesian3.fromDegrees(0, 0, 0),
      Cesium.Cartesian3.fromDegrees(0.5, 0.3, 0),
      Cesium.Cartesian3.fromDegrees(2, 0, 0),
    ]);
    sessionOptions.onChange(polyline);

    const changeResult = callbacks.onEditChange.mock.calls[0][0];
    expect(changeResult.positions).toHaveLength(3);
    expect(changeResult.positions[1].longitude).toBeCloseTo(0.5, 6);
    expect(changeResult.positions[1].latitude).toBeCloseTo(0.3, 6);

    const metadata = (polyline as Cesium.Entity & { _markMeta?: { controlPoints: Cesium.Cartesian3[] } })._markMeta;
    expect(metadata?.controlPoints).toHaveLength(3);
    expect(toDegrees(metadata!.controlPoints[1]).longitude).toBeCloseTo(0.5, 6);
    expect(toDegrees(metadata!.controlPoints[1]).latitude).toBeCloseTo(0.3, 6);

    const endResult = service.stopEdit();
    expect(endResult?.positions).toHaveLength(3);
    expect(endResult?.positions[1].longitude).toBeCloseTo(0.5, 6);
    expect(endResult?.positions[1].latitude).toBeCloseTo(0.3, 6);
    expect(overlayService.stopOverlayEdit).toHaveBeenCalledTimes(1);
    expect(callbacks.onEditEnd).toHaveBeenCalledTimes(1);
    expect(service.editState).toBeNull();
    expect(service.editEnabled).toBe(false);
  });
});
