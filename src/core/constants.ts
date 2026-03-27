import type { TDTLayerConfig, GaodeLayerConfig, BaiduLayerConfig, OSMLayerConfig } from './types';
export {
  DEFAULT_BUTTON_SORTS,
  DEFAULT_BUTTON_CONFIGS,
  DEFAULT_MEASURE_ITEMS,
  DEFAULT_TOOLBAR_STYLE,
  DEFAULT_MAP_TYPES,
} from './services/toolbar/config';

/**
 * 核心常量定义
 */

// ==================== 默认相机配置 ====================

export const DEFAULT_CAMERA_CONFIG = {
  center: [116.3974, 39.9093, 1000000] as [number, number, number], // 北京
  pitch: -45,
  heading: 0,
  roll: 0,
};

// ==================== 默认图层配置 ====================

/**
 * 默认图层提供商类型
 */
export const DEFAULT_PROVIDER_TYPE: 'tdt' = 'tdt';

/**
 * 默认天地图配置
 */
export const DEFAULT_TDT_CONFIG: TDTLayerConfig = {
  mapTypeId: 'img',
  token: '',
  showLabel: true,
};


// ==================== 默认地图中心点 ====================

export const DEFAULT_MAP_CENTER = {
  longitude: 116.3974, // 北京经度
  latitude: 39.9093,   // 北京纬度
  height: 1000000,     // 默认高度
};

// ==================== 默认缩放级别 ====================

export const DEFAULT_ZOOM_LEVELS = [
  10000000, // 0级 - 全球视图
  5000000,  // 1级
  2000000,  // 2级
  1000000,  // 3级 - 默认
  500000,   // 4级
  200000,   // 5级
  100000,   // 6级
  50000,    // 7级
  20000,    // 8级
  10000,    // 9级
  5000,     // 10级
  2000,     // 11级
  1000,     // 12级
];

export const DEFAULT_ZOOM_INDEX = 3; // 对应 1000000 米高度

// ==================== CSS 类名常量 ====================

export const CSS_CLASSES = {
  TOOLBAR: 'cesium-map-toolbar',
  TOOLBAR_BUTTON: 'cesium-toolbar-button',
  SEARCH_CONTAINER: 'search-container',
  SEARCH_RESULTS: 'search-results',
  MEASUREMENT_MENU: 'measurement-menu',
  LAYERS_MENU: 'layers-menu',
  MAP_TYPE_ITEM: 'map-type-item',
  MAP_TYPE_THUMBNAIL: 'map-type-thumbnail',
  MAP_TYPE_CHECKMARK: 'map-type-checkmark',
  SELECTED: 'selected',
};

// ==================== 事件名称常量 ====================

export const EVENT_NAMES = {
  BUTTON_CLICK: 'button-click',
  SEARCH_START: 'search-start',
  SEARCH_COMPLETE: 'search-complete',
  SEARCH_SELECT: 'search-select',
  MEASUREMENT_START: 'measurement-start',
  MEASUREMENT_COMPLETE: 'measurement-complete',
  MEASUREMENT_CLEAR: 'measurement-clear',
  LAYER_CHANGE: 'layer-change',
  VIEW_MODE_CHANGE: 'view-mode-change',
  ZOOM_CHANGE: 'zoom-change',
  FULLSCREEN_CHANGE: 'fullscreen-change',
};

// ==================== 样式隔离前缀 ====================

export const STYLE_PREFIX = 'vmap-cesium-';

// ==================== 导出所有常量 ====================

export default {
  DEFAULT_MAP_CENTER,
  DEFAULT_ZOOM_LEVELS,
  DEFAULT_ZOOM_INDEX,
  CSS_CLASSES,
  EVENT_NAMES,
  STYLE_PREFIX,
};