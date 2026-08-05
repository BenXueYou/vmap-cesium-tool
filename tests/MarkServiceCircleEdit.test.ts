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

describe('MarkService circle edit', () => {
  it('routes circle editing through OverlayService and keeps mark metadata/results in sync', () => {
    const { service, callbacks, overlayService } = createService();
    const center = Cesium.Cartesian3.fromDegrees(116.397, 39.907, 0);
    const radius = 900;
    const circle = new Cesium.Entity({
      id: 'circle-1',
      position: new Cesium.ConstantPositionProperty(center),
      ellipse: {
        semiMajorAxis: new Cesium.ConstantProperty(radius),
        semiMinorAxis: new Cesium.ConstantProperty(radius),
      },
    });

    (circle as Cesium.Entity & { _markMeta?: Record<string, unknown> })._markMeta = {
      type: 'circle',
      controlPoints: [center, Cesium.Cartesian3.fromDegrees(116.40756519692012, 39.907, 0)],
      radius,
      color: '#00A3FF',
    };

    service.entities.set(String(circle.id), circle);

    expect(service.startEdit(circle, { outputCoordSystem: 'WGS84' })).toBe(true);
    expect(overlayService.startOverlayEdit).toHaveBeenCalledTimes(1);

    circle.position = new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(116.398, 39.908, 0));
    circle.ellipse!.semiMajorAxis = new Cesium.ConstantProperty(1200);
    circle.ellipse!.semiMinorAxis = new Cesium.ConstantProperty(1200);

    const sessionOptions = overlayService.startOverlayEdit.mock.calls[0][1];
    sessionOptions.onChange(circle);

    const changeResult = callbacks.onEditChange.mock.calls[0][0];
    expect(changeResult.position.longitude).toBeCloseTo(116.398, 6);
    expect(changeResult.position.latitude).toBeCloseTo(39.908, 6);
    expect(changeResult.radius).toBeCloseTo(1200, 6);

    const metadata = (circle as Cesium.Entity & { _markMeta?: { controlPoints: Cesium.Cartesian3[]; radius?: number } })._markMeta;
    expect(metadata?.radius).toBeCloseTo(1200, 6);
    expect(metadata?.controlPoints).toHaveLength(2);

    sessionOptions.onEnd(circle);

    const endResult = callbacks.onEditEnd.mock.calls[0][0];
    expect(endResult.radius).toBeCloseTo(1200, 6);
    expect(service.editState).toBeNull();
    expect(service.editEnabled).toBe(false);
  });
});
