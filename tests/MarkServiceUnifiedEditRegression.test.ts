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

function attachMetadata(entity: Cesium.Entity, metadata: Record<string, unknown>): void {
  (entity as Cesium.Entity & { _markMeta?: Record<string, unknown> })._markMeta = {
    ...metadata,
    controlPoints: (metadata.controlPoints as Cesium.Cartesian3[]).map((point) => point.clone()),
  };
}

function expectPositions(
  actual: Array<{ longitude: number; latitude: number }>,
  expected: Array<{ longitude: number; latitude: number }>,
): void {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((point, index) => {
    expect(point.longitude).toBeCloseTo(expected[index].longitude, 6);
    expect(point.latitude).toBeCloseTo(expected[index].latitude, 6);
  });
}

describe('MarkService unified edit regression', () => {
  it.each([
    {
      label: 'point',
      createEntity: () => new Cesium.Entity({
        id: 'reg-point',
        position: new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(116.397, 39.907, 0)),
      }),
      metadata: {
        type: 'point',
        controlPoints: [Cesium.Cartesian3.fromDegrees(116.397, 39.907, 0)],
        color: '#00A3FF',
      },
      mutate: (entity: Cesium.Entity) => {
        entity.position = new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(116.3985, 39.9085, 0));
      },
      verifyChange: (result: any) => {
        expect(result.position.longitude).toBeCloseTo(116.3985, 6);
        expect(result.position.latitude).toBeCloseTo(39.9085, 6);
      },
      verifyEnd: (result: any) => {
        expect(result.position.longitude).toBeCloseTo(116.3985, 6);
        expect(result.position.latitude).toBeCloseTo(39.9085, 6);
      },
    },
    {
      label: 'polyline',
      createEntity: () => new Cesium.Entity({
        id: 'reg-line',
        polyline: {
          positions: new Cesium.ConstantProperty([
            Cesium.Cartesian3.fromDegrees(0, 0, 0),
            Cesium.Cartesian3.fromDegrees(1, 0, 0),
            Cesium.Cartesian3.fromDegrees(2, 0, 0),
          ]),
        },
      }),
      metadata: {
        type: 'polyline',
        controlPoints: [
          Cesium.Cartesian3.fromDegrees(0, 0, 0),
          Cesium.Cartesian3.fromDegrees(1, 0, 0),
          Cesium.Cartesian3.fromDegrees(2, 0, 0),
        ],
        color: '#00A3FF',
      },
      mutate: (entity: Cesium.Entity) => {
        entity.polyline!.positions = new Cesium.ConstantProperty([
          Cesium.Cartesian3.fromDegrees(0, 0, 0),
          Cesium.Cartesian3.fromDegrees(0.5, 0.3, 0),
          Cesium.Cartesian3.fromDegrees(2, 0, 0),
        ]);
      },
      verifyChange: (result: any) => {
        expect(result.positions).toHaveLength(3);
        expect(result.positions[1].longitude).toBeCloseTo(0.5, 6);
        expect(result.positions[1].latitude).toBeCloseTo(0.3, 6);
      },
      verifyEnd: (result: any) => {
        expect(result.positions).toHaveLength(3);
        expect(result.positions[1].longitude).toBeCloseTo(0.5, 6);
        expect(result.positions[1].latitude).toBeCloseTo(0.3, 6);
      },
    },
    {
      label: 'polygon',
      createEntity: () => new Cesium.Entity({
        id: 'reg-poly',
        polygon: {
          hierarchy: new Cesium.ConstantProperty(new Cesium.PolygonHierarchy([
            Cesium.Cartesian3.fromDegrees(0, 0, 0),
            Cesium.Cartesian3.fromDegrees(2, 0, 0),
            Cesium.Cartesian3.fromDegrees(1, 2, 0),
          ])),
        },
      }),
      metadata: {
        type: 'polygon',
        controlPoints: [
          Cesium.Cartesian3.fromDegrees(0, 0, 0),
          Cesium.Cartesian3.fromDegrees(2, 0, 0),
          Cesium.Cartesian3.fromDegrees(1, 2, 0),
        ],
        color: '#00A3FF',
      },
      mutate: (entity: Cesium.Entity) => {
        entity.polygon!.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy([
          Cesium.Cartesian3.fromDegrees(0, 0, 0),
          Cesium.Cartesian3.fromDegrees(2.5, 0.5, 0),
          Cesium.Cartesian3.fromDegrees(1, 2, 0),
        ]));
      },
      verifyChange: (result: any) => {
        expect(result.positions).toHaveLength(3);
        expect(result.positions[1].longitude).toBeCloseTo(2.5, 6);
        expect(result.positions[1].latitude).toBeCloseTo(0.5, 6);
      },
      verifyEnd: (result: any) => {
        expect(result.positions).toHaveLength(3);
        expect(result.positions[1].longitude).toBeCloseTo(2.5, 6);
        expect(result.positions[1].latitude).toBeCloseTo(0.5, 6);
      },
    },
    {
      label: 'rectangle',
      createEntity: () => new Cesium.Entity({
        id: 'reg-rect',
        rectangle: {
          coordinates: new Cesium.ConstantProperty(Cesium.Rectangle.fromDegrees(0, 0, 2, 2)),
        },
      }),
      metadata: {
        type: 'rectangle',
        controlPoints: [
          Cesium.Cartesian3.fromDegrees(0, 0, 0),
          Cesium.Cartesian3.fromDegrees(2, 0, 0),
          Cesium.Cartesian3.fromDegrees(2, 2, 0),
          Cesium.Cartesian3.fromDegrees(0, 2, 0),
        ],
        color: '#00A3FF',
      },
      mutate: (entity: Cesium.Entity) => {
        entity.rectangle!.coordinates = new Cesium.ConstantProperty(Cesium.Rectangle.fromDegrees(0, 0, 1, 1));
      },
      verifyChange: (result: any) => {
        expectPositions(result.positions, [
          { longitude: 0, latitude: 0 },
          { longitude: 1, latitude: 0 },
          { longitude: 1, latitude: 1 },
          { longitude: 0, latitude: 1 },
        ]);
      },
      verifyEnd: (result: any) => {
        expectPositions(result.positions, [
          { longitude: 0, latitude: 0 },
          { longitude: 1, latitude: 0 },
          { longitude: 1, latitude: 1 },
          { longitude: 0, latitude: 1 },
        ]);
      },
    },
    {
      label: 'circle',
      createEntity: () => new Cesium.Entity({
        id: 'reg-circle',
        position: new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(116.397, 39.907, 0)),
        ellipse: {
          semiMajorAxis: new Cesium.ConstantProperty(900),
          semiMinorAxis: new Cesium.ConstantProperty(900),
        },
      }),
      metadata: {
        type: 'circle',
        controlPoints: [
          Cesium.Cartesian3.fromDegrees(116.397, 39.907, 0),
          Cesium.Cartesian3.fromDegrees(116.40756519692012, 39.907, 0),
        ],
        radius: 900,
        color: '#00A3FF',
      },
      mutate: (entity: Cesium.Entity) => {
        entity.position = new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(116.398, 39.908, 0));
        entity.ellipse!.semiMajorAxis = new Cesium.ConstantProperty(1200);
        entity.ellipse!.semiMinorAxis = new Cesium.ConstantProperty(1200);
      },
      verifyChange: (result: any) => {
        expect(result.position.longitude).toBeCloseTo(116.398, 6);
        expect(result.position.latitude).toBeCloseTo(39.908, 6);
        expect(result.radius).toBeCloseTo(1200, 6);
      },
      verifyEnd: (result: any) => {
        expect(result.position.longitude).toBeCloseTo(116.398, 6);
        expect(result.position.latitude).toBeCloseTo(39.908, 6);
        expect(result.radius).toBeCloseTo(1200, 6);
      },
    },
  ])('keeps %s editing routed through OverlayService and synced end-to-end', ({ createEntity, metadata, mutate, verifyChange, verifyEnd }) => {
    const { viewer } = createViewerStub();
    const { service, callbacks, overlayService } = createService(viewer);
    const entity = createEntity();

    attachMetadata(entity, metadata);
    service.entities.set(String(entity.id), entity);

    expect(service.startEdit(entity, { outputCoordSystem: 'WGS84' })).toBe(true);
    expect(overlayService.startOverlayEdit).toHaveBeenCalledTimes(1);

    const sessionOptions = overlayService.startOverlayEdit.mock.calls[0][1];
    overlayService.stopOverlayEdit.mockImplementation(() => sessionOptions.onEnd(entity));

    mutate(entity);
    sessionOptions.onChange(entity);

    const changeResult = callbacks.onEditChange.mock.calls[0][0];
    verifyChange(changeResult);

    const endResult = service.stopEdit();
    verifyEnd(endResult);
    expect(callbacks.onEditEnd).toHaveBeenCalledTimes(1);
    expect(service.editState).toBeNull();
    expect(service.editEnabled).toBe(false);
  });
});
