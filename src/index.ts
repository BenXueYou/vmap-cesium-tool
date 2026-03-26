/**
 * VMap Cesium Tool 主入口文件 (新架构)
 * 
 * 基于 core/components/services 架构重构后的新入口点。
 * 提供模块化的 API，同时通过适配器保持向后兼容。
 */

import { createMapPlugin } from './core/MapPlugin';
import type { ToolbarConfig } from './core/types';
import { initStyleSystem } from './styles';

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
  LayersPanelStyleConfig,
  ToolbarLayersMenuOptions,
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
export { OverlayService, DrawService, ToolbarService, createToolbarService } from './core/services';
export type {
  OverlayServiceOptions,
  DrawMode,
  DrawOptions,
  DrawResult,
  ToolbarServiceOptions,
  ToolbarCallbacks,
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

export { ToolbarAdapter as CesiumMapToolbar } from './adapters/ToolbarAdapter';
export type { LegacyCesiumMapToolbarCallbacks } from './adapters/ToolbarAdapter';

export { initCesium } from './adapters/MapLoaderAdapter';
export type { LegacyInitOptions, LegacyInitResult, LegacyMapCenter } from './adapters/MapLoaderAdapter';

export {
  DrawHelperAdapter as CompatDrawHelper,
  OverlayServiceAdapter as CompatCesiumOverlayService,
  ToolbarAdapter as CompatCesiumMapToolbar,
} from './adapters';

// ==================== 便捷工厂函数 ====================

/**
 * 快速创建地图插件实例
 */
export function createVMap(
  containerId: string,
  config?: Parameters<typeof createMapPlugin>[1],
  toolbarConfig?: ToolbarConfig,
) {
  return createMapPlugin(containerId, config, toolbarConfig);
}

/**
 * 快速初始化样式系统
 */
export function initVMapStyles(config?: Parameters<typeof initStyleSystem>[0]) {
  return initStyleSystem(config);
}

// ==================== 版本信息 ====================
export const VERSION = '2.0.0';
export const DESCRIPTION = 'VMap Cesium Tool - 基于 Cesium 和天地图的地图插件工具库 (新架构)';
