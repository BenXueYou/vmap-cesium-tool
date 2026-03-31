import type { Entity, Viewer } from 'cesium';
import {
  OverlayServiceAdapter,
  type LegacyCesiumOverlayServiceOptions,
} from '../adapters/OverlayServiceAdapter';
import type {
  MarkerOptions,
  LabelOptions,
  IconOptions,
  SvgOptions,
  InfoWindowOptions,
  PolylineOptions,
  PolygonOptions,
  RectangleOptions,
  CircleOptions,
  RingOptions,
  OverlayEntity,
  OverlayPosition,
  OverlayClickHighlightOptions,
  OverlayHoverHighlightOptions,
} from '../core/entities';

export type {
  MarkerOptions,
  LabelOptions,
  IconOptions,
  SvgOptions,
  InfoWindowOptions,
  PolylineOptions,
  PolygonOptions,
  RectangleOptions,
  CircleOptions,
  RingOptions,
  OverlayEntity,
  OverlayPosition,
  OverlayClickHighlightOptions,
  OverlayHoverHighlightOptions,
};

export interface CesiumOverlayServiceOptions extends LegacyCesiumOverlayServiceOptions {
  onOverlayEditChange?: (entity: Entity & OverlayEntity) => void;
}

/**
 * 旧版覆盖物服务兼容层。
 * 直接复用新的 OverlayServiceAdapter，并保留旧类名。
 */
export class CesiumOverlayService extends OverlayServiceAdapter {
  constructor(viewer: Viewer, options: CesiumOverlayServiceOptions = {}) {
    super(viewer, options);
  }
}
