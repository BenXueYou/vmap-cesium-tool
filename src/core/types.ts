import * as Cesium from 'cesium';
import type { Cartesian3, Cartographic, Color, MaterialProperty, Rectangle, Entity } from 'cesium';
import type { I18nLike } from '../i18n';
import type { ToolbarCallbacks } from './services/toolbar/types';

/**
 * 核心类型定义 - 整合所有地图插件相关的类型
 */

// ==================== 工具栏相关类型 ====================

/**
 * 工具栏配置接口
 */
export interface ToolbarConfig {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  direction?: 'row' | 'column';
  buttonSize?: number;
  buttonSpacing?: number;
  padding?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  boxShadow?: string;
  zIndex?: number;
  offsetTop?: number;
  offsetRight?: number;
  offsetBottom?: number;
  offsetLeft?: number;
  buttons?: CustomButtonConfig[];
  useI18n?: boolean;
  i18n?: I18nLike;
}

/**
 * 基础按钮配置接口
 */
export interface ButtonConfig {
  sort?: number; // 排序号
  id: string;
  icon: string;
  title: string;
  titleKey?: string;
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

/**
 * 自定义按钮配置接口
 */
export interface CustomButtonConfig {
  id: string;
  icon: string | HTMLElement | false;
  title: string;
  titleKey?: string;
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
  sort?: number; // 排序号
  activeIcon?: string | HTMLElement | false;
  callback?: () => void;
  onClick?: (buttonId: string, buttonElement: HTMLElement) => void;
}

/**
 * 解析后的按钮配置
 */
export interface ResolvedButtonConfig extends CustomButtonConfig {
  resolvedIcon: string | HTMLElement | false;
  resolvedTitle: string;
}

// ==================== 搜索相关类型 ====================

/**
 * 搜索回调接口
 */
export interface SearchCallback {
  onSearch?: (query: string) => Promise<SearchResult[]>;
  onSelect?: (result: SearchResult) => void;
  onSearchInput?: (query: string, container: HTMLElement) => void;
  onSearchResults?: (results: SearchResult[], container: HTMLElement) => void;
}

/**
 * 搜索结果接口
 */
export interface SearchResult {
  name: string;
  address: string;
  longitude: number;
  latitude: number;
  height?: number;
}

// ==================== 测量相关类型 ====================

/**
 * 测量回调接口
 */
export interface MeasurementCallback {
  onMeasurementStart?: (positions?: Cartesian3[]) => void;
  onDistanceComplete?: (positions: Cartesian3[], distance: number) => void;
  onAreaComplete?: (positions: Cartesian3[], area: number) => void;
  onClear?: () => void;
}

/**
 * 缩放回调接口
 */
export interface ZoomCallback {
  onZoomIn?: (beforeHeight: number, afterHeight: number, currentLevel: number) => void;
  onZoomOut?: (beforeHeight: number, afterHeight: number, currentLevel: number) => void;
}

// ==================== 地图类型相关 ====================

/**
 * 地图类型接口
 */
export interface MapType {
  id: string;
  name: string;
  nameKey?: string;
  /** 选中态左上角"路网"文案（可选，未配置时走 i18n 默认 key） */
  placeNameLabel?: string;
  /** 选中态左上角"路网"文案 i18n key（可选） */
  placeNameLabelKey?: string;
  /** 是否强制始终显示路网层（不受 placeName 开关影响） */
  forcePlaceName?: boolean;
  thumbnail: string;
  provider: (token: string) => Cesium.ImageryProvider[];
  // 三维地图专用：地形提供者
  terrainProvider?: (token: string) => Cesium.TerrainProvider | null;
  // 三维地图专用：路网服务配置
  geoWTFS?: (token: string, viewer: Cesium.Viewer) => any | null;
}

export interface LayersPanelStyleConfig {
  containerStyle?: Partial<CSSStyleDeclaration>;
  sectionStyle?: Partial<CSSStyleDeclaration>;
  sectionTitleStyle?: Partial<CSSStyleDeclaration>;
  mapTypesGridStyle?: Partial<CSSStyleDeclaration>;
  mapTypeCardStyle?: Partial<CSSStyleDeclaration>;
  mapTypeCardSelectedStyle?: Partial<CSSStyleDeclaration>;
  mapTypeCardHoverStyle?: Partial<CSSStyleDeclaration>;
  mapTypeCardSelectedHoverStyle?: Partial<CSSStyleDeclaration>;
  mapTypeThumbnailStyle?: Partial<CSSStyleDeclaration>;
  mapTypeLabelStyle?: Partial<CSSStyleDeclaration>;
  mapTypeCheckmarkStyle?: Partial<CSSStyleDeclaration>;
  mapTypeCheckmarkSelectedStyle?: Partial<CSSStyleDeclaration>;
  placeNameBadgeStyle?: Partial<CSSStyleDeclaration>;
  placeNameCheckboxStyle?: Partial<CSSStyleDeclaration>;
  placeNameTextStyle?: Partial<CSSStyleDeclaration>;
  noFlyZoneItemStyle?: Partial<CSSStyleDeclaration>;
  noFlyZoneItemHoverStyle?: Partial<CSSStyleDeclaration>;
  noFlyZoneCheckboxStyle?: Partial<CSSStyleDeclaration>;
  noFlyZoneLabelStyle?: Partial<CSSStyleDeclaration>;
  noFlyZoneDotStyle?: Partial<CSSStyleDeclaration>;
}

export interface ToolbarLayersMenuOptions {
  mapTypes?: MapType[];
  defaultPlaceNameChecked?: boolean;
  defaultNoFlyZoneChecked?: boolean;
  panelStyle?: LayersPanelStyleConfig;
}

// ==================== 地图提供商类型 ====================

/**
 * 地图提供商类型
 */
export type ProviderType = 'tdt' | 'gaode' | 'baidu' | 'arcgis' | 'osm' | 'custom';

// ==================== 分层配置接口 ====================

/**
 * 相机/视图配置
 */
export interface CameraConfig {
  /** 中心点坐标 [经度，纬度，高度] */
  center: [number, number, number];
  /** 俯仰角（度），默认 -45 */
  pitch?: number;
  /** 朝向角（度），默认 0 */
  heading?: number;
  /** 翻滚角（度），默认 0 */
  roll?: number;
}

/**
 * 天地图图层配置
 */
export interface TDTLayerConfig {
  /** 天地图子类型：矢量/影像/地形 */
  mapTypeId?: 'vec' | 'img' | 'ter';
  /** 天地图 token */
  token: string;
  /** 是否显示注记层，默认 true */
  showLabel?: boolean;
}

/**
 * 高德地图图层配置
 */
export interface GaodeLayerConfig {
  /** 高德地图子类型：矢量/卫星/地形 */
  mapTypeId?: 'vector' | 'satellite' | 'terrain';
  /** 高德 key */
  token?: string;
  /** 是否显示注记层，默认 true */
  showLabel?: boolean;
}

/**
 * 百度地图图层配置
 */
export interface BaiduLayerConfig {
  /** 百度地图子类型：普通/卫星/地形 */
  mapTypeId?: 'normal' | 'satellite' | 'terrain';
  /** 百度 ak */
  token?: string;
  /** 是否显示注记层，默认 true */
  showLabel?: boolean;
}

/**
 * ArcGIS 地图图层配置
 */
export interface ArcGISLayerConfig {
  /** ArcGIS 服务 URL */
  url: string;
  /** 是否使用动态图层 */
  dynamic?: boolean;
}

/**
 * OSM 地图图层配置
 */
export interface OSMLayerConfig {
  /** OSM 风格 URL 模板，默认使用标准 OSM */
  urlTemplate?: string;
  /** 最大层级，默认 19 */
  maximumLevel?: number;
}

/**
 * 自定义图层配置
 */
export interface CustomLayerConfig {
  /** 自定义影像图层提供者数组 */
  providers: Cesium.ImageryProvider[];
}

/**
 * 图层配置 - 支持多种地图提供商
 */
export interface LayersConfig {
  /** 地图提供商类型，默认 'tdt' */
  type?: ProviderType;
  /** 天地图配置 */
  tdt?: TDTLayerConfig;
  /** 高德地图配置 */
  gaode?: GaodeLayerConfig;
  /** 百度地图配置 */
  baidu?: BaiduLayerConfig;
  /** ArcGIS 配置 */
  arcgis?: ArcGISLayerConfig;
  /** OSM 配置 */
  osm?: OSMLayerConfig;
  /** 自定义图层配置 */
  custom?: CustomLayerConfig;
}

/**
 * 地图插件配置选项
 */
export interface MapPluginOptions {
  /** Cesium Viewer 原生配置 */
  viewerOptions?: Cesium.Viewer.ConstructorOptions;
  /** 相机/视图配置 */
  camera?: CameraConfig;
  /** 图层配置 */
  layers?: LayersConfig;
  /** Cesium Ion Token */
  cesiumToken?: string;
  /** 服务装配配置 */
  services?: MapPluginServicesOptions;
}

/**
 * Toolbar 服务装配配置
 */
export interface ToolbarPluginOptions {
  /** 是否启用 ToolbarService */
  enabled?: boolean;
  /** 工具栏挂载容器，默认使用地图容器 */
  container?: HTMLElement;
  /** 工具栏配置 */
  config?: ToolbarConfig;
  /** 是否使用默认按钮，默认 true */
  useDefaultButtons?: boolean;
  /** 自定义按钮配置 */
  buttonConfigs?: CustomButtonConfig[];
  /** 图层菜单配置 */
  layersMenu?: ToolbarLayersMenuOptions;
  /** 工具栏回调 */
  callbacks?: ToolbarCallbacks;
}

/**
 * Overlay 服务装配配置
 */
export interface OverlayPluginOptions {
  /** 是否启用 OverlayService，默认 true */
  enabled?: boolean;
  /** 是否启用 hover 处理器 */
  enableHoverHandler?: boolean;
  /** 点击节流间隔 */
  clickPickMinIntervalMs?: number;
}

/**
 * Draw 服务装配配置
 */
export interface DrawPluginOptions {
  /** 是否启用 DrawService，默认 true */
  enabled?: boolean;
}

/**
 * MapPlugin 服务装配总配置
 */
export interface MapPluginServicesOptions {
  toolbar?: boolean | ToolbarPluginOptions;
  overlay?: boolean | OverlayPluginOptions;
  draw?: boolean | DrawPluginOptions;
}

// ==================== 地图工具配置（向后兼容） ====================

/**
 * 地图工具配置接口（保留用于向后兼容）
 */
export interface MapToolsConfig {
  containerId: string; // 地图容器 ID
  viewerOptions?: Cesium.Viewer.ConstructorOptions; // 地图初始化配置项
  cesiumToken?: string; // Cesium Ion 访问令牌
  /** @deprecated 使用 camera.center 代替 */
  mapCenter?: {
    longitude: number; // 中心点经度
    latitude: number; // 中心点纬度
    height: number; // 中心点高度
    pitch?: number; // 俯仰角
    heading?: number; // 航向角
  };
  zoomLevels?: number[]; // 缩放级别数组
  defaultZoom?: number; // 默认缩放级别索引
  
  // === 以下字段用于兼容旧的 API，实际使用 layers 配置 ===
  /** @deprecated 使用 layers.type 代替 */
  mapType?: 'tdt' | 'ion';
  /** @deprecated 使用 layers.tdt.mapTypeId 代替 */
  tdtMapTypeId?: 'vec' | 'img' | 'ter';
  /** @deprecated 使用 layers.tdt.token 代替 */
  token?: string;
}

// ==================== 绘制相关类型 ====================

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

/**
 * 覆盖物选项
 */
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

// ==================== 覆盖物相关类型 ====================

/**
 * 覆盖物位置类型
 */
export type OverlayPosition = Cartesian3 | [number, number] | [number, number, number];

/**
 * 覆盖物高亮原始样式
 */
export interface OverlayHighlightOriginalStyle {
  point?: {
    pixelSize?: any;
    color?: any;
    outlineColor?: any;
    outlineWidth?: any;
  };
  label?: {
    fillColor?: any;
    outlineColor?: any;
    outlineWidth?: any;
    scale?: any;
  };
  billboard?: {
    scale?: any;
    color?: any;
  };
  polyline?: {
    width?: any;
    material?: any;
  };
  polygon?: {
    outline?: any;
    outlineColor?: any;
    outlineWidth?: any;
    material?: any;
  };
  rectangle?: {
    outline?: any;
    outlineColor?: any;
    outlineWidth?: any;
    material?: any;
  };
  ellipse?: {
    outline?: any;
    outlineColor?: any;
    outlineWidth?: any;
    material?: any;
  };
}

/**
 * 覆盖物点击高亮选项
 */
export interface OverlayClickHighlightOptions {
  /** 高亮主颜色（默认 yellow） */
  color?: Color | string;
  /** 面填充透明度（默认 0.35） */
  fillAlpha?: number;
}

/**
 * 覆盖物悬停高亮选项
 */
export type OverlayHoverHighlightOptions = OverlayClickHighlightOptions;

/**
 * 覆盖物扩展实体类型
 */
export interface OverlayEntity extends Entity {
  /** 覆盖物点击回调（由各 Map* 工具类设置） */
  _onClick?: (entity: Entity) => void;

  /** 点击覆盖物时是否启用高亮（由各 Map* 工具类设置） */
  _clickHighlight?: boolean | OverlayClickHighlightOptions;
  /** 鼠标移入覆盖物时是否启用高亮（由各 Map* 工具类设置） */
  _hoverHighlight?: boolean | OverlayHoverHighlightOptions;
  /** 高亮联动的实体集合（复合覆盖物：边框/填充等一起切换） */
  _highlightEntities?: Entity[];
  /** 当前是否处于高亮状态 */
  _isHighlighted?: boolean;
  /** 当前高亮原因（click/hover 可叠加；click 优先显示） */
  _highlightState?: { click?: boolean; hover?: boolean };
  /** 用于还原高亮前的原始样式 */
  _highlightOriginalStyle?: OverlayHighlightOriginalStyle;
  /** 高亮时临时创建的"发光边框"实体（由 CesiumOverlayService 管理） */
  _highlightGlowEntity?: Entity;

  /** 覆盖物类型标识（用于 CesiumOverlayService 做差异化更新/删除） */
  _overlayType?: string;

  /** 信息窗口根 DOM（由 MapInfoWindow / CesiumOverlayService 使用） */
  _infoWindow?: HTMLElement;

  /** 复合图形的内层实体或边框实体等关联引用 */
  _borderEntity?: Entity;
  _innerEntity?: Entity;

  /** 粗边框 / 环形等形状相关元数据 */
  /** 是否贴地（粗边框/环形等复合形状用） */
  _clampToGround?: boolean;
  /** 复合形状的基准高度（米，clampToGround=false 时有效） */
  _baseHeight?: number;
  /** 贴地抬高量（米，clampToGround=true 时有效） */
  _groundHeightEpsilon?: number;
  _isThickOutline?: boolean;
  _outlineWidth?: number;
  _isRing?: boolean;
  _ringThickness?: number;
  _ringSegments?: number;
  _ringGlowPower?: number;
  _ringLineColor?: Color | string;
  _ringLineStyle?: 'solid' | 'dashed';
  _ringLineMaterialMode?: 'stripe' | 'dash';
  _ringStripeRepeat?: number;
  _ringDashLength?: number;
  _ringDashPattern?: number;
  _ringGapColor?: Color | string;
  _ringShowInnerLine?: boolean;
  _fillMaterial?: MaterialProperty | Color | string;
  _ringHeightEpsilon?: number;
  _centerCartographic?: Cartographic;
  _outerRadius?: number;
  _innerRadius?: number;
  _outerRectangle?: Rectangle;

  /** primitive circle: 内部使用的纯色缓存（用于高亮恢复） */
  /** primitive layer key: 用于分层批处理路由 */
  _primitiveLayerKey?: string;
  _primitiveRingBaseColor?: Color;
  _primitiveFillBaseColor?: Color;
  /** primitive：用于高亮发光边框的外圈/边界位置（通常为闭合折线） */
  _primitiveOutlinePositions?: Cartesian3[];
  /** primitive polygon/rectangle: 边框纯色缓存（用于高亮恢复） */
  _primitiveBorderBaseColor?: Color;
}

// ==================== 样式相关类型 ====================

/**
 * CSS样式配置接口
 */
export interface StyleConfig {
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
  cssText?: string;
}

/**
 * 组件样式配置
 */
export interface ComponentStyleConfig {
  container?: StyleConfig;
  button?: StyleConfig;
  toolbar?: StyleConfig;
  search?: StyleConfig;
  measurement?: StyleConfig;
  layers?: StyleConfig;
}

// ==================== 导出所有类型 ====================

export type {
  Cesium
};