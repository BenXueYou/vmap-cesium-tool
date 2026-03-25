/**
 * VMap Cesium Tool 主入口文件 (新架构)
 * 
 * 基于 core/components/services 架构重构后的新入口点。
 * 提供模块化的 API，同时通过适配器保持向后兼容。
 */

// ==================== 核心模块 ====================
export { MapPlugin, createMapPlugin } from './core/MapPlugin';

/**
 * @deprecated 使用 MapPluginOptions 代替
 */
export type {
  ToolbarConfig,
  ButtonConfig,
  CustomButtonConfig,
  SearchCallback,
  SearchResult,
  MeasurementCallback,
  ZoomCallback,
  MapType,
  MapToolsConfig,
  ComponentStyleConfig,
  StyleConfig,
  // 新增：分层配置类型
  MapPluginOptions,
  CameraConfig,
  LayersConfig,
  ProviderType,
  TDTLayerConfig,
  GaodeLayerConfig,
  BaiduLayerConfig,
  ArcGISLayerConfig,
  OSMLayerConfig,
  CustomLayerConfig,
} from './core/types';

// ==================== 实体模块 ====================
export {
  BaseOverlay,
  Marker,
  Label,
  Icon,
  SVG,
  InfoWindow,
  Polyline,
  Polygon,
  Rectangle,
  Circle,
  Ring,
} from './core/entities';
export type {
  OverlayPosition,
  BaseOverlayOptions,
  OverlayClickHighlightOptions,
  OverlayHoverHighlightOptions,
  OverlayEntity,
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
} from './core/entities';

// ==================== 服务模块 ====================
export { OverlayService, DrawService } from './core/services';
export type {
  OverlayServiceOptions,
  DrawMode,
  DrawOptions,
  DrawResult,
} from './core/services';

// ==================== 图层模块 ====================
export { HeatmapLayer, PointClusterLayer } from './core/layers';
export type {
  HeatPoint,
  HeatmapGradient,
  HeatmapOptions,
  ClusterPoint,
  ClusterStyleStep,
  PointClusterLayerOptions,
} from './core/layers';

// ==================== 组件模块 ====================
export {
  BaseComponent,
  Toolbar,
  ToolbarButton,
  SearchBox,
} from './components';

// ==================== 样式模块 ====================
export {
  styleManager,
  initStyleSystem,
  applyTheme,
  getCurrentTheme,
  getAvailableThemes,
} from './styles';

// ==================== 国际化 ====================
export { i18n } from './i18n';
export type { I18nLike } from './i18n';

// ==================== 工具函数 ====================
// export * from './utils'; // 暂时注释，等待 utils 模块创建

// ==================== 适配器（向后兼容） ====================
export { DrawHelperAdapter as DrawHelper } from './adapters/DrawHelperAdapter';
export type {
  LegacyDrawCallbacks,
  LegacyDrawOptions,
  LegacyDrawEntity,
} from './adapters/DrawHelperAdapter';

export { OverlayServiceAdapter as CesiumOverlayService } from './adapters/OverlayServiceAdapter';
export type { LegacyCesiumOverlayServiceOptions } from './adapters/OverlayServiceAdapter';

// 从 libs 重新导出旧版实现（过渡期，直到完全迁移）
export { CesiumMapToolbar } from './libs/CesiumMapToolbar';
export { initCesium } from './libs/CesiumMapLoader';

// ==================== 便捷工厂函数 ====================

/**
 * 快速创建地图插件实例
 */
export async function createVMap(
  containerId: string,
  config?: any,
  toolbarConfig?: any,
  styleConfig?: any
) {
  const { createMapPlugin } = await import('./core/MapPlugin');
  return createMapPlugin(containerId, config, toolbarConfig, styleConfig);
}

/**
 * 快速初始化样式系统
 */
export async function initVMapStyles(config?: any) {
  const { initStyleSystem } = await import('./styles');
  return initStyleSystem(config);
}

// ==================== 版本信息 ====================
export const VERSION = '2.0.0';
export const DESCRIPTION = 'VMap Cesium Tool - 基于 Cesium 和天地图的地图插件工具库 (新架构)';

// ==================== 默认导出 ====================
const VMap = {
  // 核心
  MapPlugin: (await import('./core/MapPlugin')).MapPlugin,
  createMapPlugin: (await import('./core/MapPlugin')).createMapPlugin,
  createVMap,
  
  // 实体
  BaseOverlay: (await import('./core/entities')).BaseOverlay,
  Marker: (await import('./core/entities')).Marker,
  Label: (await import('./core/entities')).Label,
  Icon: (await import('./core/entities')).Icon,
  SVG: (await import('./core/entities')).SVG,
  InfoWindow: (await import('./core/entities')).InfoWindow,
  Polyline: (await import('./core/entities')).Polyline,
  Polygon: (await import('./core/entities')).Polygon,
  Rectangle: (await import('./core/entities')).Rectangle,
  Circle: (await import('./core/entities')).Circle,
  Ring: (await import('./core/entities')).Ring,
  
  // 服务
  OverlayService: (await import('./core/services')).OverlayService,
  DrawService: (await import('./core/services')).DrawService,
  
  // 图层
  HeatmapLayer: (await import('./core/layers')).HeatmapLayer,
  PointClusterLayer: (await import('./core/layers')).PointClusterLayer,
  
  // 组件
  BaseComponent: (await import('./components')).BaseComponent,
  Toolbar: (await import('./components')).Toolbar,
  ToolbarButton: (await import('./components')).ToolbarButton,
  SearchBox: (await import('./components')).SearchBox,
  
  // 样式
  styleManager: (await import('./styles')).styleManager,
  initVMapStyles,
  
  // 适配器（向后兼容）
  DrawHelper: (await import('./adapters/DrawHelperAdapter')).DrawHelperAdapter,
  CesiumOverlayService: (await import('./adapters/OverlayServiceAdapter')).OverlayServiceAdapter,
  CesiumMapToolbar: (await import('./libs/CesiumMapToolbar')).CesiumMapToolbar,
  initCesium: (await import('./libs/CesiumMapLoader')).initCesium,
  
  // 元数据
  VERSION,
  DESCRIPTION,
};

export default VMap;