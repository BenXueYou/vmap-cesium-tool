import * as Cesium from 'cesium';
import type { Cartesian3, Cartographic, Color } from 'cesium';
// 工具栏配置接口
export interface ToolbarConfig {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  buttonSize?: number;
  buttonSpacing?: number;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  boxShadow?: string;
  zIndex?: number;
  buttons?: CustomButtonConfig[];
}

// 按钮配置接口
export interface ButtonConfig {
  id: string;
  icon: string;
  title: string;
  size?: number;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: string;
  hoverColor?: string;
  activeColor?: string;
  backgroundColor?: string;
  callback?: () => void;
  activeIcon?: string | HTMLElement;
}

// 自定义按钮配置接口
export interface CustomButtonConfig {
  id: string;
  icon: string | HTMLElement | false;
  title: string;
  enabled?: boolean;
  visible?: boolean;
  size?: number;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: string;
  padding?: string;
  hoverColor?: string;
  activeColor?: string;
  backgroundColor?: string;
  activeIcon?: string | HTMLElement | false;
  callback?: () => void;
  onClick?: (buttonId: string, buttonElement: HTMLElement) => void;
}

// 搜索回调接口
export interface SearchCallback {
  onSearch?: (query: string) => Promise<SearchResult[]>;
  onSelect?: (result: SearchResult) => void;
  onSearchInput?: (query: string, container: HTMLElement) => void;
  onSearchResults?: (results: SearchResult[], container: HTMLElement) => void;
}

// 搜索结果接口
export interface SearchResult {
  name: string;
  address: string;
  longitude: number;
  latitude: number;
  height?: number;
}

// 测量回调接口
export interface MeasurementCallback {
  onDistanceComplete?: (positions: Cartesian3[], distance: number) => void;
  onAreaComplete?: (positions: Cartesian3[], area: number) => void;
  onClear?: () => void;
}

// 缩放回调接口
export interface ZoomCallback {
  onZoomIn?: (beforeLevel: number, afterLevel: number) => void;
  onZoomOut?: (beforeLevel: number, afterLevel: number) => void;
}

// 地图类型接口
export interface MapType {
  id: string;
  name: string;
  thumbnail: string;
  provider: (token: string) => Cesium.ImageryProvider[];
}

// 配置接口定义
export interface MapToolsConfig {
  containerId: string; // 地图容器ID
  viewerOptions?: Cesium.Viewer.ConstructorOptions; // 地图初始化配置项
  mapCenter?: {
    longitude: number; // 中心点经度
    latitude: number; // 中心点纬度
    height: number; // 中心点高度
    pitch?: number; // 俯仰角
    heading?: number; // 航向角
  };
  zoomLevels?: number[]; // 缩放级别数组
  defaultZoom?: number; // 默认缩放级别索引
}

/**
 * 点位绘制选项
 */
export interface PointOptions {
  pixelSize?: number; // 点大小
  color?: Color; // 点颜色
  outlineColor?: Color; // 轮廓颜色
  outlineWidth?: number; // 轮廓宽度
  showLabel?: boolean; // 是否显示标签
  labelText?: string; // 标签文本
  onClick?: (position: Cartesian3, cartographic: Cartographic) => void; // 点击回调
}

/**
 * 线条绘制选项
 */
export interface LineOptions {
  width?: number; // 线条宽度
  material?: Cesium.MaterialProperty | Color; // 线条材质或颜色
  showDistance?: boolean; // 是否显示距离 (对于多段线，显示总长度)
  dashPattern?: number; // 虚线模式 (例如 0xff for dashed)
  onClick?: (positions: Cartesian3[], distance: number) => void; // 点击回调
}

/**
 * 多边形绘制选项
 */
export interface PolygonOptions {
  material?: Cesium.MaterialProperty | Color; // 填充材质或颜色
  outline?: boolean;
  outlineColor?: Color; // 轮廓颜色
  outlineWidth?: number; // 轮廓宽度
  showArea?: boolean; // 是否显示面积
  dashPattern?: number; // 虚线模式 (轮廓)
  onClick?: (positions: Cartesian3[], area: number) => void; // 点击回调
}

export interface OverlayOptions {
  position: Cartesian3;
  type: 'point' | 'label' | 'billboard' | 'model' | 'cylinder';
  point?: {
    pixelSize?: number;
    color?: Color;
    outlineColor?: Color;
    outlineWidth?: number;
  };
  label?: {
    text: string;
    font?: string;
    fillColor?: Color;
    outlineColor?: Color;
    outlineWidth?: number;
  };
  billboard?: {
    image: string;
    scale?: number;
  };
  model?: {
    uri: string;
    scale?: number;
  };
  cylinder?: {
    length: number;
    topRadius: number;
    bottomRadius: number;
    material?: Color;
  };
}

export * as Cesium from 'cesium';
