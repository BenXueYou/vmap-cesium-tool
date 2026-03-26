import * as Cesium from 'cesium';

import {
  DEFAULT_FILL_STYLE,
  DEFAULT_HINT_BUBBLE_STYLE,
  DEFAULT_PREVIEW_AREA_LABEL_STYLE,
  DEFAULT_SEGMENT_DISTANCE_LABEL_STYLE,
  DEFAULT_STROKE_STYLE,
  DEFAULT_TOTAL_AREA_LABEL_STYLE,
  DEFAULT_TOTAL_DISTANCE_LABEL_STYLE,
  DEFAULT_VERTEX_STYLE,
} from './drawDefaults';
import type {
  DrawOptions,
  MeasurementLabelKind,
  MeasurementLabelOffset,
  MeasurementSummaryLabelStyle,
  ResolvedMeasurementFillStyle,
  ResolvedMeasurementLabelStyle,
  ResolvedMeasurementStrokeStyle,
  ResolvedMeasurementTheme,
  ResolvedMeasurementVertexStyle,
} from './types/drawTypes';

export function resolveColor(color: Cesium.Color | string, fallback: Cesium.Color): Cesium.Color {
  if (color instanceof Cesium.Color) {
    return color;
  }

  try {
    return Cesium.Color.fromCssColorString(color);
  } catch {
    return fallback;
  }
}

export function resolveMeasurementPixelOffset(
  offset: MeasurementSummaryLabelStyle['pixelOffset'] | undefined,
  fallback: Cesium.Cartesian2 | MeasurementLabelOffset,
): Cesium.Cartesian2 {
  if (offset instanceof Cesium.Cartesian2) {
    return offset;
  }

  if (offset && Number.isFinite(offset.x) && Number.isFinite(offset.y)) {
    return new Cesium.Cartesian2(offset.x, offset.y);
  }

  if (fallback instanceof Cesium.Cartesian2) {
    return fallback;
  }

  return new Cesium.Cartesian2(fallback.x, fallback.y);
}

function resolveLabel(
  style: MeasurementSummaryLabelStyle | undefined,
  fallback: ResolvedMeasurementLabelStyle,
): ResolvedMeasurementLabelStyle {
  return {
    font: style?.font ?? fallback.font,
    textColor: resolveColor(style?.textColor ?? fallback.textColor, fallback.textColor),
    backgroundColor: resolveColor(style?.backgroundColor ?? fallback.backgroundColor, fallback.backgroundColor),
    borderRadius: Math.max(0, Math.round(style?.borderRadius ?? fallback.borderRadius)),
    pixelOffset: resolveMeasurementPixelOffset(style?.pixelOffset, fallback.pixelOffset),
  };
}

export function resolveMeasurementTheme(options?: DrawOptions | null): ResolvedMeasurementTheme {
  const theme = options?.measurementTheme;

  return {
    stroke: {
      color: options?.lineColor
        ? resolveColor(options.lineColor, DEFAULT_STROKE_STYLE.color)
        : resolveColor(theme?.stroke?.color ?? DEFAULT_STROKE_STYLE.color, DEFAULT_STROKE_STYLE.color),
      width: options?.lineWidth ?? theme?.stroke?.width ?? DEFAULT_STROKE_STYLE.width,
      clampToGround: options?.clampToGround ?? theme?.stroke?.clampToGround ?? DEFAULT_STROKE_STYLE.clampToGround,
    },
    fill: {
      color: options?.fillColor
        ? resolveColor(options.fillColor, DEFAULT_FILL_STYLE.color)
        : resolveColor(theme?.fill?.color ?? DEFAULT_FILL_STYLE.color, DEFAULT_FILL_STYLE.color),
    },
    vertex: {
      pixelSize: theme?.vertex?.pixelSize ?? DEFAULT_VERTEX_STYLE.pixelSize,
      color: resolveColor(theme?.vertex?.color ?? DEFAULT_VERTEX_STYLE.color, DEFAULT_VERTEX_STYLE.color),
      outlineColor: resolveColor(theme?.vertex?.outlineColor ?? DEFAULT_VERTEX_STYLE.outlineColor, DEFAULT_VERTEX_STYLE.outlineColor),
      outlineWidth: theme?.vertex?.outlineWidth ?? DEFAULT_VERTEX_STYLE.outlineWidth,
    },
    segmentDistanceLabel: resolveLabel(options?.segmentDistanceLabelStyle ?? theme?.segmentDistanceLabel, DEFAULT_SEGMENT_DISTANCE_LABEL_STYLE),
    totalDistanceLabel: resolveLabel(options?.totalDistanceLabelStyle ?? theme?.totalDistanceLabel, DEFAULT_TOTAL_DISTANCE_LABEL_STYLE),
    previewAreaLabel: resolveLabel(options?.previewAreaLabelStyle ?? theme?.previewAreaLabel, DEFAULT_PREVIEW_AREA_LABEL_STYLE),
    totalAreaLabel: resolveLabel(options?.totalAreaLabelStyle ?? theme?.totalAreaLabel, DEFAULT_TOTAL_AREA_LABEL_STYLE),
    hintBubble: resolveLabel(options?.hintBubbleStyle ?? theme?.hintBubble, DEFAULT_HINT_BUBBLE_STYLE),
  };
}

export function resolveLabelStyle(
  theme: ResolvedMeasurementTheme,
  kind: MeasurementLabelKind,
): ResolvedMeasurementLabelStyle {
  return theme[kind];
}

export function resolveStrokeStyle(theme: ResolvedMeasurementTheme): ResolvedMeasurementStrokeStyle {
  return theme.stroke;
}

export function resolveFillStyle(theme: ResolvedMeasurementTheme): ResolvedMeasurementFillStyle {
  return theme.fill;
}

export function resolveVertexStyle(theme: ResolvedMeasurementTheme): ResolvedMeasurementVertexStyle {
  return theme.vertex;
}