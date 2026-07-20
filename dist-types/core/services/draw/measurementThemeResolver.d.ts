import * as Cesium from 'cesium';
import type { DrawOptions, MeasurementLabelKind, MeasurementLabelOffset, MeasurementSummaryLabelStyle, ResolvedMeasurementFillStyle, ResolvedMeasurementLabelStyle, ResolvedMeasurementStrokeStyle, ResolvedMeasurementTheme, ResolvedMeasurementVertexStyle } from './types/drawTypes';
export declare function resolveColor(color: Cesium.Color | string, fallback: Cesium.Color): Cesium.Color;
export declare function resolveMeasurementPixelOffset(offset: MeasurementSummaryLabelStyle['pixelOffset'] | undefined, fallback: Cesium.Cartesian2 | MeasurementLabelOffset): Cesium.Cartesian2;
export declare function resolveMeasurementTheme(options?: DrawOptions | null): ResolvedMeasurementTheme;
export declare function resolveLabelStyle(theme: ResolvedMeasurementTheme, kind: MeasurementLabelKind): ResolvedMeasurementLabelStyle;
export declare function resolveStrokeStyle(theme: ResolvedMeasurementTheme): ResolvedMeasurementStrokeStyle;
export declare function resolveFillStyle(theme: ResolvedMeasurementTheme): ResolvedMeasurementFillStyle;
export declare function resolveVertexStyle(theme: ResolvedMeasurementTheme): ResolvedMeasurementVertexStyle;
