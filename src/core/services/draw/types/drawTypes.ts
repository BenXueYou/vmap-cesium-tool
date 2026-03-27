import * as Cesium from 'cesium';
import type { Cartesian3, Entity } from 'cesium';
import type { I18nLike } from '../../../../i18n';

export type DrawMode = 'point' | 'line' | 'polygon' | 'rectangle' | 'circle' | null;

export interface MeasurementLabelOffset {
  x: number;
  y: number;
}

export interface MeasurementSummaryLabelStyle {
  font?: string;
  textColor?: Cesium.Color | string;
  backgroundColor?: Cesium.Color | string;
  borderRadius?: number;
  pixelOffset?: Cesium.Cartesian2 | MeasurementLabelOffset;
}

export interface MeasurementVertexStyle {
  pixelSize?: number;
  color?: Cesium.Color | string;
  outlineColor?: Cesium.Color | string;
  outlineWidth?: number;
}

export interface MeasurementStrokeStyle {
  color?: Cesium.Color | string;
  width?: number;
  clampToGround?: boolean;
}

export interface MeasurementFillStyle {
  color?: Cesium.Color | string;
}

export interface MeasurementTheme {
  stroke?: MeasurementStrokeStyle;
  fill?: MeasurementFillStyle;
  vertex?: MeasurementVertexStyle;
  segmentDistanceLabel?: MeasurementSummaryLabelStyle;
  totalDistanceLabel?: MeasurementSummaryLabelStyle;
  previewAreaLabel?: MeasurementSummaryLabelStyle;
  totalAreaLabel?: MeasurementSummaryLabelStyle;
  hintBubble?: MeasurementSummaryLabelStyle;
}

export interface DrawOptions {
  mode?: DrawMode;
  measurementTheme?: MeasurementTheme;
  lineColor?: Cesium.Color | string;
  lineWidth?: number;
  fillColor?: Cesium.Color | string;
  clampToGround?: boolean;
  segmentDistanceLabelStyle?: MeasurementSummaryLabelStyle;
  totalDistanceLabelStyle?: MeasurementSummaryLabelStyle;
  previewAreaLabelStyle?: MeasurementSummaryLabelStyle;
  totalAreaLabelStyle?: MeasurementSummaryLabelStyle;
  hintBubbleStyle?: MeasurementSummaryLabelStyle;
  onClick?: (entity: Entity, positions?: Cartesian3[]) => void;
}

export interface DrawServiceOptions {
  i18n?: I18nLike;
  useI18n?: boolean;
}

export interface DrawResult {
  entity: Entity;
  positions: Cartesian3[];
}

export interface DrawArtifacts {
  primary: Entity;
  auxiliary: Entity[];
}

export type MeasurementLabelKind =
  | 'segmentDistanceLabel'
  | 'totalDistanceLabel'
  | 'previewAreaLabel'
  | 'totalAreaLabel'
  | 'hintBubble';

export interface ResolvedMeasurementLabelStyle {
  font: string;
  textColor: Cesium.Color;
  backgroundColor: Cesium.Color;
  borderRadius: number;
  pixelOffset: Cesium.Cartesian2;
}

export interface ResolvedMeasurementVertexStyle {
  pixelSize: number;
  color: Cesium.Color;
  outlineColor: Cesium.Color;
  outlineWidth: number;
}

export interface ResolvedMeasurementStrokeStyle {
  color: Cesium.Color;
  width: number;
  clampToGround: boolean;
}

export interface ResolvedMeasurementFillStyle {
  color: Cesium.Color;
}

export interface ResolvedMeasurementTheme {
  stroke: ResolvedMeasurementStrokeStyle;
  fill: ResolvedMeasurementFillStyle;
  vertex: ResolvedMeasurementVertexStyle;
  segmentDistanceLabel: ResolvedMeasurementLabelStyle;
  totalDistanceLabel: ResolvedMeasurementLabelStyle;
  previewAreaLabel: ResolvedMeasurementLabelStyle;
  totalAreaLabel: ResolvedMeasurementLabelStyle;
  hintBubble: ResolvedMeasurementLabelStyle;
}