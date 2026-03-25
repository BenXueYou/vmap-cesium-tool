/**
 * 覆盖物实体模块入口
 * 
 * @packageDocumentation
 */

// 导出基类和类型
export { BaseOverlay } from './BaseOverlay';
export type {
  OverlayPosition,
  BaseOverlayOptions,
  OverlayClickHighlightOptions,
  OverlayHoverHighlightOptions,
  OverlayEntity,
} from './BaseOverlay';

// 导出具体覆盖物类
export { Marker } from './Marker';
export type { MarkerOptions } from './Marker';

export { Label } from './Label';
export type { LabelOptions } from './Label';

export { Icon } from './Icon';
export type { IconOptions } from './Icon';

export { SVG } from './SVG';
export type { SvgOptions } from './SVG';

export { InfoWindow } from './InfoWindow';
export type { InfoWindowOptions } from './InfoWindow';

export { Polyline } from './Polyline';
export type { PolylineOptions } from './Polyline';

export { Polygon } from './Polygon';
export type { PolygonOptions } from './Polygon';

export { Rectangle } from './Rectangle';
export type { RectangleOptions } from './Rectangle';

export { Circle } from './Circle';
export type { CircleOptions } from './Circle';

export { Ring } from './Ring';
export type { RingOptions } from './Ring';