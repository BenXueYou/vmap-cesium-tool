import * as Cesium from 'cesium';
import { describe, expect, it } from 'vitest';
import { OverlayService } from '../src/core/services/overlay/OverlayService';
import type { OverlayEntity } from '../src/core/entities/BaseOverlay';

type TestService = OverlayService & Record<string, any>;

function createService(roots: OverlayEntity[]): TestService {
  const service = Object.create(OverlayService.prototype) as TestService;
  service.viewer = { scene: {} };
  service.overlays = new Map(
    roots.map((root) => [
      String(root.id),
      {
        getEntity: () => root,
      },
    ]),
  );
  service.entityOverlayMap = new Map();
  service.creationOrderById = new Map(roots.map((root, index) => [String(root.id), index + 1]));
  service.clickHighlightTargets = [];
  service.hoverHighlightTargets = [];
  service.selectionListeners = new Set();
  service.highlightCache = new WeakMap();
  service.picking = {
    enabled: true,
    hover: true,
    selection: true,
    pickWidth: 3,
    pickHeight: 3,
    drillLimit: 16,
    clickDebounceMs: 250,
  };
  service.hoverEnabled = true;
  service.selectionEnabled = true;
  service.selectedOverlayId = null;
  service.drawInteractionActive = false;
  service.cameraHoverSuspended = false;
  service.overlayEditState = null;
  return service;
}

function createPolygonRoot(
  id: string,
  options: {
    selectionHighlight?: boolean;
  } = {},
): OverlayEntity {
  const entity = new Cesium.Entity({
    id,
    show: true,
    polygon: new Cesium.PolygonGraphics({
      material: new Cesium.ColorMaterialProperty(Cesium.Color.RED.withAlpha(0.1)),
      outlineColor: new Cesium.ConstantProperty(Cesium.Color.BLACK),
    }),
  }) as OverlayEntity;

  entity._highlightEntities = [entity];
  entity._hoverHighlight = true;
  entity._selectable = true;
  if (options.selectionHighlight !== undefined) {
    entity._selectionHighlight = options.selectionHighlight;
  }

  return entity;
}

function createPointRoot(id: string): OverlayEntity {
  const entity = new Cesium.Entity({
    id,
    show: true,
    point: new Cesium.PointGraphics({
      color: Cesium.Color.RED,
      outlineColor: Cesium.Color.WHITE,
      pixelSize: 10,
    }),
  }) as OverlayEntity;

  entity._highlightEntities = [entity];
  entity._hoverHighlight = true;
  entity._selectable = true;
  return entity;
}

function getPolygonColor(entity: OverlayEntity): Cesium.Color {
  const material = entity.polygon?.material as Cesium.ColorMaterialProperty | undefined;
  const color = material?.color?.getValue(Cesium.JulianDate.now());
  if (!(color instanceof Cesium.Color)) {
    throw new Error('Expected polygon color material');
  }
  return color;
}

function getPointColor(entity: OverlayEntity): Cesium.Color {
  const color = entity.point?.color?.getValue(Cesium.JulianDate.now());
  if (!(color instanceof Cesium.Color)) {
    throw new Error('Expected point color');
  }
  return color;
}

function getPointOutlineColor(entity: OverlayEntity): Cesium.Color {
  const color = entity.point?.outlineColor?.getValue(Cesium.JulianDate.now());
  if (!(color instanceof Cesium.Color)) {
    throw new Error('Expected point outline color');
  }
  return color;
}

function getPointPixelSize(entity: OverlayEntity): number {
  return entity.point?.pixelSize?.getValue(Cesium.JulianDate.now()) as number;
}

function expectColor(actual: Cesium.Color, expected: Cesium.Color): void {
  expect(actual.red).toBeCloseTo(expected.red, 6);
  expect(actual.green).toBeCloseTo(expected.green, 6);
  expect(actual.blue).toBeCloseTo(expected.blue, 6);
  expect(actual.alpha).toBeCloseTo(expected.alpha, 6);
}

describe('OverlayService highlight state visuals', () => {
  it('uses the spec defaults, lets selected beat hover, and falls back to hover when selected styling is disabled', () => {
    const selected = createPolygonRoot('selected');
    const service = createService([selected]);
    const hoverColor = Cesium.Color.fromCssColorString('#FFFF00')!.withAlpha(0.25);
    const selectedColor = Cesium.Color.fromCssColorString('#00E5FF')!.withAlpha(0.4);

    expect(service.setOverlayHighlight('selected', true, 'hover')).toBe(true);
    expectColor(getPolygonColor(selected), hoverColor);

    expect(service.selectOverlay('selected')).toBe(true);
    expectColor(getPolygonColor(selected), selectedColor);

    expect(service.clearSelection()).toBe(true);
    expectColor(getPolygonColor(selected), hoverColor);

    expect(service.setOverlayHighlight('selected', false, 'hover')).toBe(true);
    expectColor(getPolygonColor(selected), Cesium.Color.RED.withAlpha(0.1));

    const hoverOnlySelected = createPolygonRoot('hover-only-selected', { selectionHighlight: false });
    const hoverOnlyService = createService([hoverOnlySelected]);

    expect(hoverOnlyService.selectOverlay('hover-only-selected')).toBe(true);
    expectColor(getPolygonColor(hoverOnlySelected), Cesium.Color.RED.withAlpha(0.1));

    expect(hoverOnlyService.setOverlayHighlight('hover-only-selected', true, 'hover')).toBe(true);
    expectColor(getPolygonColor(hoverOnlySelected), hoverColor);

    expect(hoverOnlyService.clearSelection()).toBe(true);
    expectColor(getPolygonColor(hoverOnlySelected), hoverColor);

    expect(hoverOnlyService.setOverlayHighlight('hover-only-selected', false, 'hover')).toBe(true);
    expectColor(getPolygonColor(hoverOnlySelected), Cesium.Color.RED.withAlpha(0.1));
  });

  it('restores the latest base style after point styles change during selection highlight', () => {
    const marker = createPointRoot('marker');
    const service = createService([marker]);
    const selectedColor = Cesium.Color.fromCssColorString('#00E5FF')!;

    expect(service.selectOverlay('marker')).toBe(true);
    expectColor(getPointColor(marker), selectedColor.withAlpha(0.95));
    expect(getPointPixelSize(marker)).toBe(12);

    marker.point!.color = new Cesium.ConstantProperty(Cesium.Color.BLUE);
    marker.point!.outlineColor = new Cesium.ConstantProperty(Cesium.Color.BLACK);
    marker.point!.pixelSize = new Cesium.ConstantProperty(20);

    expectColor(getPointColor(marker), selectedColor.withAlpha(0.95));
    expect(getPointPixelSize(marker)).toBe(22);

    expect(service.clearSelection()).toBe(true);
    expectColor(getPointColor(marker), Cesium.Color.BLUE);
    expectColor(getPointOutlineColor(marker), Cesium.Color.BLACK);
    expect(getPointPixelSize(marker)).toBe(20);
  });
});
