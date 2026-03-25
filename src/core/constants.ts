import * as Cesium from 'cesium';
import type { TDTLayerConfig, GaodeLayerConfig, BaiduLayerConfig, OSMLayerConfig } from './types';

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

// ==================== 默认按钮排序 ====================

export const DEFAULT_BUTTON_SORTS: Record<string, number> = {
  'search': 0,
  'measure': 1,
  'view2d3d': 2,
  'layers': 3,
  'location': 4,
  'zoom-in': 5,
  'zoom-out': 6,
  'fullscreen': 7
};

// ==================== 默认按钮配置 ====================

/**
 * 默认按钮配置（基础信息）
 */
export const DEFAULT_BUTTONS = [
  { id: 'search', icon: '🔍', title: '搜索', titleKey: 'toolbar.search', sort: 0 },
  { id: 'measure', icon: '📏', title: '测量', titleKey: 'toolbar.measure', sort: 1 },
  { id: 'view2d3d', icon: '3D', title: '2D 或 3D', titleKey: 'toolbar.view2d3d', sort: 2 },
  { id: 'layers', icon: '📚', title: '图层切换', titleKey: 'toolbar.layers', sort: 3 },
  { id: 'location', icon: '🎯', title: '定位', titleKey: 'toolbar.location', sort: 4 },
  { id: 'zoom-in', icon: '🔍-', title: '缩小', titleKey: 'toolbar.zoom_in', sort: 5 },
  { id: 'zoom-out', icon: '🔍+', title: '放大', titleKey: 'toolbar.zoom_out', sort: 6 },
  { id: 'fullscreen', icon: '⛶', title: '全屏', titleKey: 'toolbar.fullscreen', sort: 7 }
];

/**
 * 默认按钮完整配置（包含样式）
 * 参考 src/hooks/toolBarConfig.ts 中的配置项结构
 */
export const DEFAULT_BUTTON_CONFIGS = [
  {
    size: 40,
    id: 'search',
    icon: '🔍',
    title: '搜索',
    titleKey: 'toolbar.search',
    color: '#007BFF',
    borderColor: 'transparent',
    backgroundColor: 'rgba(66, 133, 244, 0.4)',
    hoverColor: 'rgba(51, 103, 214, 0.9)',
    sort: 0,
  },
  {
    size: 40,
    id: 'measure',
    icon: '📏',
    title: '测量',
    titleKey: 'toolbar.measure',
    color: '#007BFF',
    borderColor: 'transparent',
    backgroundColor: 'rgba(66, 133, 244, 0.4)',
    hoverColor: 'rgba(51, 103, 214, 0.9)',
    sort: 1,
  },
  {
    size: 40,
    id: 'view2d3d',
    icon: '3D',
    title: '2D 或 3D',
    titleKey: 'toolbar.view2d3d',
    color: '#007BFF',
    borderColor: 'transparent',
    backgroundColor: 'rgba(66, 133, 244, 0.4)',
    hoverColor: 'rgba(51, 103, 214, 0.9)',
    activeColor: 'rgba(26, 115, 232, 0.9)',
    activeIcon: '2D',
    sort: 2,
  },
  {
    size: 40,
    id: 'layers',
    icon: '📚',
    title: '图层切换',
    titleKey: 'toolbar.layers',
    color: '#007BFF',
    borderColor: 'transparent',
    backgroundColor: 'rgba(66, 133, 244, 0.4)',
    hoverColor: 'rgba(51, 103, 214, 0.9)',
    sort: 3,
  },
  {
    size: 40,
    id: 'location',
    icon: '🎯',
    title: '定位',
    titleKey: 'toolbar.location',
    color: '#007BFF',
    borderColor: 'transparent',
    backgroundColor: 'rgba(66, 133, 244, 0.4)',
    hoverColor: 'rgba(51, 103, 214, 0.9)',
    sort: 4,
  },
  {
    size: 40,
    id: 'zoom-in',
    icon: '➖',
    title: '缩小',
    titleKey: 'toolbar.zoom_in',
    color: '#007BFF',
    borderColor: 'transparent',
    backgroundColor: 'rgba(66, 133, 244, 0.4)',
    hoverColor: 'rgba(51, 103, 214, 0.9)',
    sort: 5,
  },
  {
    size: 40,
    id: 'zoom-out',
    icon: '➕',
    title: '放大',
    titleKey: 'toolbar.zoom_out',
    color: '#007BFF',
    borderColor: 'transparent',
    backgroundColor: 'rgba(66, 133, 244, 0.4)',
    hoverColor: 'rgba(51, 103, 214, 0.9)',
    sort: 6,
  },
  {
    size: 40,
    id: 'fullscreen',
    icon: '⛶',
    title: '全屏',
    titleKey: 'toolbar.fullscreen',
    color: '#007BFF',
    borderColor: 'transparent',
    backgroundColor: 'rgba(66, 133, 244, 0.4)',
    hoverColor: 'rgba(51, 103, 214, 0.9)',
    sort: 7,
  },
];

// ==================== 测量菜单项 ====================

export const DEFAULT_MEASURE_ITEMS = [
  { id: 'measure-area', text: '测面积', textKey: 'measurement.menu.area', icon: '📐' },
  { id: 'measure-distance', text: '测距', textKey: 'measurement.menu.distance', icon: '📏' },
  { id: 'clear-measurement', text: '清除', textKey: 'measurement.menu.clear', icon: '🗑️' }
];

// ==================== 默认工具栏样式配置 ====================

export const DEFAULT_TOOLBAR_STYLE = {
  position: 'bottom-right' as const,
  buttonSize: 40,
  buttonSpacing: 8,
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  borderColor: '#e0e0e0',
  borderRadius: 6,
  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
  zIndex: 1000,
};

// ==================== 默认地图类型 ====================

export const DEFAULT_MAP_TYPES = [
  {
    id: 'vec',
    name: '矢量地图',
    nameKey: 'map.types.vec',
    thumbnail: '/assets/images/vec_c.png',
    provider: (token: string) => [
      // 矢量底图
      new Cesium.UrlTemplateImageryProvider({
        url: `https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        maximumLevel: 18,
        tileWidth: 256,
        tileHeight: 256,
      }),
    ],
  },
  {
    id: 'img',
    name: '影像地图',
    nameKey: 'map.types.img',
    thumbnail: '/assets/images/ele_c.jpg',
    provider: (token: string) => [
      // 影像底图
      new Cesium.UrlTemplateImageryProvider({
        url: `https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        maximumLevel: 18,
        tileWidth: 256,
        tileHeight: 256,
      }),
    ],
  },
  {
    id: 'ter',
    name: '地形地图',
    nameKey: 'map.types.ter',
    thumbnail: '/assets/images/ter_c.png',
    provider: (token: string) => [
      // 地形晕渲
      new Cesium.UrlTemplateImageryProvider({
        url: `https://t{s}.tianditu.gov.cn/ter_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ter&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        maximumLevel: 18,
        tileWidth: 256,
        tileHeight: 256,
      }),
    ],
    terrainProvider: (token: string) => null,
  },
];

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
  DEFAULT_BUTTON_SORTS,
  DEFAULT_BUTTONS,
  DEFAULT_MEASURE_ITEMS,
  DEFAULT_TOOLBAR_STYLE,
  DEFAULT_MAP_TYPES,
  DEFAULT_MAP_CENTER,
  DEFAULT_ZOOM_LEVELS,
  DEFAULT_ZOOM_INDEX,
  CSS_CLASSES,
  EVENT_NAMES,
  STYLE_PREFIX,
};