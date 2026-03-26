import * as Cesium from 'cesium';

import type {
  MeasurementLabelOffset,
  ResolvedMeasurementFillStyle,
  ResolvedMeasurementLabelStyle,
  ResolvedMeasurementStrokeStyle,
  ResolvedMeasurementVertexStyle,
} from './types/drawTypes';

export const DEFAULT_LINE_WIDTH = 2;
export const DEFAULT_CLAMP_TO_GROUND = true;
export const DEFAULT_LINE_COLOR = Cesium.Color.YELLOW;
export const DEFAULT_FILL_COLOR = Cesium.Color.RED.withAlpha(0.5);
export const DEFAULT_CIRCLE_SEGMENTS = 64;

export const DEFAULT_STROKE_STYLE: ResolvedMeasurementStrokeStyle = {
  color: DEFAULT_LINE_COLOR,
  width: DEFAULT_LINE_WIDTH,
  clampToGround: DEFAULT_CLAMP_TO_GROUND,
};

export const DEFAULT_FILL_STYLE: ResolvedMeasurementFillStyle = {
  color: DEFAULT_FILL_COLOR,
};

export const DEFAULT_VERTEX_STYLE: ResolvedMeasurementVertexStyle = {
  pixelSize: 10,
  color: Cesium.Color.fromCssColorString('#20b7ff'),
  outlineColor: Cesium.Color.WHITE,
  outlineWidth: 1,
};

export const DEFAULT_SEGMENT_DISTANCE_LABEL_STYLE: ResolvedMeasurementLabelStyle = {
  font: '12px sans-serif',
  textColor: Cesium.Color.BLACK,
  backgroundColor: Cesium.Color.fromCssColorString('rgba(191, 191, 191, 0.9)'),
  borderRadius: 6,
  pixelOffset: new Cesium.Cartesian2(0, -8),
};

export const DEFAULT_TOTAL_DISTANCE_LABEL_STYLE: ResolvedMeasurementLabelStyle = {
  font: '13px sans-serif',
  textColor: Cesium.Color.WHITE,
  backgroundColor: Cesium.Color.fromCssColorString('rgba(47, 92, 168, 0.94)'),
  borderRadius: 8,
  pixelOffset: new Cesium.Cartesian2(0, -30),
};

export const DEFAULT_PREVIEW_AREA_LABEL_STYLE: ResolvedMeasurementLabelStyle = {
  font: '12px sans-serif',
  textColor: Cesium.Color.BLACK,
  backgroundColor: Cesium.Color.fromCssColorString('rgba(228, 235, 245, 0.94)'),
  borderRadius: 6,
  pixelOffset: new Cesium.Cartesian2(0, -6),
};

export const DEFAULT_TOTAL_AREA_LABEL_STYLE: ResolvedMeasurementLabelStyle = {
  font: '13px sans-serif',
  textColor: Cesium.Color.WHITE,
  backgroundColor: Cesium.Color.fromCssColorString('rgba(47, 92, 168, 0.94)'),
  borderRadius: 8,
  pixelOffset: new Cesium.Cartesian2(0, -4),
};

export const DEFAULT_HINT_OFFSET: MeasurementLabelOffset = {
  x: 92,
  y: -16,
};

export const DEFAULT_HINT_BUBBLE_STYLE: ResolvedMeasurementLabelStyle = {
  font: '13px sans-serif',
  textColor: Cesium.Color.WHITE,
  backgroundColor: Cesium.Color.fromCssColorString('rgba(110, 110, 110, 0.82)'),
  borderRadius: 8,
  pixelOffset: new Cesium.Cartesian2(DEFAULT_HINT_OFFSET.x, DEFAULT_HINT_OFFSET.y),
};