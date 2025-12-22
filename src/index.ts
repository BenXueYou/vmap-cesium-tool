// 核心类
export { CesiumMapToolbar } from './libs/CesiumMapToolbar';
export { default as DrawHelper } from './libs/CesiumMapDraw';
export { initCesium } from './libs/CesiumMapLoader';

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

// 默认导出
export default {
  CesiumMapToolbar,
  DrawHelper,
  initCesium,
  initCesiumMap: initCesium
};
