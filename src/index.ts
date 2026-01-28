// 核心类
export { CesiumMapToolbar } from './libs/CesiumMapToolbar';
export { default as DrawHelper } from './libs/CesiumMapDraw';
export { initCesium } from './libs/CesiumMapLoader';
export { i18n } from './libs/i18n';
export type { I18nLike } from './libs/i18n';

// 类型定义
export type {
  OverlayOptions,
  ToolbarConfig,
  ButtonConfig,
  CustomButtonConfig,
  SearchCallback,
  SearchResult,
  MeasurementCallback,
  ZoomCallback,
  MapType,
} from './libs/CesiumMapModel';

// 天地图插件
// export { GeoTerrainProvider, GeoWTFS } from './libs/tdt';

// 导入用于默认导出
import { CesiumMapToolbar } from './libs/CesiumMapToolbar';
import DrawHelper from './libs/CesiumMapDraw';
import { initCesium } from './libs/CesiumMapLoader';

export * from './libs/overlay/index';
export type * from './libs/overlay/index';
export * from './libs/drawHelper/index';
export type * from './libs/drawHelper/index';
import { CesiumOverlayService } from './libs/CesiumOverlayService';
export { CesiumOverlayService } from './libs/CesiumOverlayService';
export type * from './libs/CesiumOverlayService';

export * from './libs/toolBar/CesiumMapController';
export type * from './libs/toolBar/CesiumMapController';
export * from './libs/toolBar/MapLayersService';
export type * from './libs/toolBar/MapLayersService';
export * from './libs/toolBar/MapSearchService';
export type * from './libs/toolBar/MapSearchService';
export * from './libs/toolBar/MapToolBarConfig';
export type * from './libs/toolBar/MapToolBarConfig';
export * from './libs/toolBar/NotFlyZonesService';
export type * from './libs/toolBar/NotFlyZonesService';

// Heatmap functionality
import CesiumHeatmapLayer from './libs/CesiumHeatmapLayer';
export { CesiumHeatmapLayer as HeatmapLayer };
export type { HeatmapOptions } from './types/index';

// 默认导出
export default {
  CesiumMapToolbar,
  DrawHelper,
  CesiumOverlayService,
  initCesium,
  initCesiumMap: initCesium
};
