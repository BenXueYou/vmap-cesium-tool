/**
 * 工具栏服务类型定义
 */

import type { ToolbarButton } from '../../../components/ToolbarButton';
import type { I18nLike } from '../../../i18n';

/**
 * 按钮处理器接口
 */
export interface IButtonHandler {
  /** 按钮 ID */
  readonly id: string;
  
  /** 初始化按钮 */
  initialize(button: ToolbarButton): void;
  
  /** 处理点击事件 */
  handleClick(): void;
  
  /** 处理鼠标进入事件（可选） */
  handleMouseEnter?(): void;
  
  /** 处理鼠标离开事件（可选） */
  handleMouseLeave?(): void;
  
  /** 销毁处理器 */
  destroy(): void;
}

/**
 * 菜单接口
 */
export interface IMenu {
  /** 显示菜单 */
  show(anchor: HTMLElement): void;
  
  /** 隐藏菜单 */
  hide(): void;
  
  /** 切换菜单显示状态 */
  toggle(anchor: HTMLElement): void;
  
  /** 销毁菜单 */
  destroy(): void;
}

/**
 * 工具栏服务配置
 */
export interface ToolbarServiceConfig {
  /** Cesium Viewer 实例 */
  viewer: any;
  
  /** 容器元素 */
  container: HTMLElement;
  
  /** 绘图助手实例 */
  drawHelper?: any;
  
  /** 搜索服务配置 */
  search?: SearchServiceConfig;
  
  /** 测量服务配置 */
  measurement?: MeasurementServiceConfig;
  
  /** 图层服务配置 */
  layers?: LayersServiceConfig;
  
  /** 禁飞区服务配置 */
  noFlyZone?: NoFlyZoneServiceConfig;
  
  /** 地图控制器配置 */
  mapController?: MapControllerConfig;
  
  /** 国际化配置 */
  i18n?: I18nLike;
  
  /** 是否使用国际化 */
  useI18n?: boolean;
  
  /** 回调函数 */
  callbacks?: ToolbarCallbacks;
}

/**
 * 工具栏回调函数
 */
export interface ToolbarCallbacks {
  /** 搜索回调 */
  onSearch?: (query: string) => Promise<SearchResult[]>;
  
  /** 搜索选择回调 */
  onSelect?: (result: SearchResult) => void;
  
  /** 测量回调 */
  onMeasurementStart?: () => void;
  onDistanceComplete?: (positions: any[], distance: number) => void;
  onAreaComplete?: (positions: any[], area: number) => void;
  onClear?: () => void;
  
  /** 缩放回调 */
  onZoomIn?: (beforeHeight: number, afterHeight: number) => void;
  onZoomOut?: (beforeHeight: number, afterHeight: number) => void;
  
  /** 全屏回调 */
  onFullscreenChange?: (isFullscreen: boolean) => void;
  
  /** 复位位置回调 */
  onResetLocation?: () => void;
}

/**
 * 搜索结果
 */
export interface SearchResult {
  name: string;
  address: string;
  longitude: number;
  latitude: number;
  height?: number;
}

/**
 * 搜索服务配置
 */
export interface SearchServiceConfig {
  /** 搜索回调 */
  onSearch?: (query: string) => Promise<SearchResult[]>;
  
  /** 搜索选择回调 */
  onSelect?: (result: SearchResult) => void;
}

/**
 * 测量服务配置
 */
export interface MeasurementServiceConfig {
  /** 测量回调 */
  onMeasurementStart?: () => void;
  onDistanceComplete?: (positions: any[], distance: number) => void;
  onAreaComplete?: (positions: any[], area: number) => void;
  onClear?: () => void;
}

/**
 * 图层服务配置
 */
export interface LayersServiceConfig {
  /** 地图类型配置 */
  mapTypes?: any[];
  
  /** 当前地图类型 */
  currentMapType?: string;
  
  /** 天地图 token */
  token?: string;
  
  /** 地图类型改变回调 */
  onMapTypeChange?: (mapTypeId: string) => void;
}

/**
 * 禁飞区服务配置
 */
export interface NoFlyZoneServiceConfig {
  /** 挤出高度 */
  extrudedHeight?: number;
  
  /** 自动加载 */
  autoLoad?: boolean;
  
  /** 是否勾选 */
  isChecked?: boolean;
}

/**
 * 地图控制器配置
 */
export interface MapControllerConfig {
  /** 初始中心点 */
  initialCenter?: {
    longitude: number;
    latitude: number;
    height: number;
  };
  
  /** 获取地图类型列表 */
  getMapTypes?: () => any[];
  
  /** 获取当前地图类型 */
  getCurrentMapTypeId?: () => string;
  
  /** 获取 token */
  getToken?: () => string;
  
  /** 缩放回调 */
  zoomCallback?: any;
  
  /** 场景模式改变回调 */
  onSceneModeChanged?: () => void;
  
  /** 全屏回调 */
  fullscreenCallback?: (isFullscreen: boolean) => void;
  
  /** 复位位置回调 */
  resetLocationCallback?: () => void;
}

/**
 * 默认按钮配置
 */
export interface DefaultButtonConfig {
  id: string;
  icon: string | HTMLElement;
  title: string;
  titleKey?: string;
  sort: number;
}

/**
 * 默认按钮列表
 */
export const DEFAULT_BUTTONS: DefaultButtonConfig[] = [
  { id: 'search', icon: '🔍', title: '搜索', titleKey: 'toolbar.search', sort: 0 },
  { id: 'measure', icon: '📏', title: '测量', titleKey: 'toolbar.measure', sort: 1 },
  { id: 'view2d3d', icon: '3D', title: '2D 或 3D', titleKey: 'toolbar.view2d3d', sort: 2 },
  { id: 'layers', icon: '📚', title: '图层切换', titleKey: 'toolbar.layers', sort: 3 },
  { id: 'location', icon: '🎯', title: '定位', titleKey: 'toolbar.location', sort: 4 },
  { id: 'zoom-in', icon: '➖', title: '缩小', titleKey: 'toolbar.zoom_in', sort: 5 },
  { id: 'zoom-out', icon: '➕', title: '放大', titleKey: 'toolbar.zoom_out', sort: 6 },
  { id: 'fullscreen', icon: '⛶', title: '全屏', titleKey: 'toolbar.fullscreen', sort: 7 },
];

/**
 * 默认测量菜单项
 */
export interface MeasureMenuItem {
  id: string;
  text: string;
  textKey?: string;
  icon: string;
}

export const DEFAULT_MEASURE_ITEMS: MeasureMenuItem[] = [
  { id: 'measure-area', text: '测面积', textKey: 'measurement.menu.area', icon: '📐' },
  { id: 'measure-distance', text: '测距', textKey: 'measurement.menu.distance', icon: '📏' },
  { id: 'clear-measurement', text: '清除', textKey: 'measurement.menu.clear', icon: '🗑️' },
];