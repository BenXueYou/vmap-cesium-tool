/**
 * VMap Cesium Tool 主入口文件
 * 整合新的模块化架构，提供向后兼容的API
 */

// ==================== 核心模块 ====================
// 避免导出冲突，只导出特定的核心模块
export { MapPlugin, createMapPlugin } from './core/MapPlugin';
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
  StyleConfig
} from './core/types';

// ==================== 组件模块 ====================
export { 
  BaseComponent, 
  ToolbarButton, 
  Toolbar, 
  SearchBox,
  createToolbar,
  createToolbarButton,
  createSearchBox
} from './components';

// ==================== 样式模块 ====================
export { 
  styleManager,
  initStyleSystem,
  applyTheme,
  getCurrentTheme,
  getAvailableThemes
} from './styles';

// ==================== 向后兼容的导出 ====================

// 导出现有的核心类（保持向后兼容）
export { CesiumMapToolbar } from './libs/CesiumMapToolbar';
export { default as DrawHelper } from './libs/CesiumMapDraw';
export { initCesium } from './libs/CesiumMapLoader';
export { i18n } from './i18n';
export type { I18nLike } from './i18n';

// 导出现有的类型定义（使用别名避免冲突）
export type {
  OverlayOptions as LegacyOverlayOptions,
  ToolbarConfig as LegacyToolbarConfig,
  ButtonConfig as LegacyButtonConfig,
  CustomButtonConfig as LegacyCustomButtonConfig,
  SearchCallback as LegacySearchCallback,
  SearchResult as LegacySearchResult,
  MeasurementCallback as LegacyMeasurementCallback,
  ZoomCallback as LegacyZoomCallback,
  MapType as LegacyMapType,
} from './libs/CesiumMapModel';

// 导出现有的覆盖物功能（避免与核心模块冲突）
export { 
  MapCircle,
  MapIcon,
  MapInfoWindow,
  MapLabel,
  MapMarker,
  MapPolygon,
  MapPolyline,
  MapRectangle,
  MapRing,
  MapSVG
} from './libs/overlay/index';

// 导出现有的绘制功能
export * from './libs/drawHelper/index';

// 导出现有的覆盖物服务
export { CesiumOverlayService } from './libs/CesiumOverlayService';

// 导出现有的工具栏服务
export * from './libs/toolBar/CesiumMapController';
export * from './libs/toolBar/MapLayersService';
export * from './libs/toolBar/MapSearchService';
export * from './libs/toolBar/MapToolBarConfig';
export * from './libs/toolBar/NotFlyZonesService';

// 导出现有的热力图功能
import CesiumHeatmapLayer from './libs/CesiumHeatmapLayer';
export { CesiumHeatmapLayer as HeatmapLayer };
export type { HeatmapOptions } from './libs/CesiumHeatmapLayer';

// 导出现有的点聚合功能
import CesiumPointClusterLayer from './libs/CesiumPointClusterLayer';
export { CesiumPointClusterLayer as PointClusterLayer };
export type { ClusterPoint, PointClusterLayerOptions, ClusterStyleStep } from './libs/CesiumPointClusterLayer';

// ==================== 工具函数 ====================

/**
 * 初始化新的地图插件（推荐使用）
 */
export async function createVMapPlugin(
  containerId: string,
  config?: any,
  toolbarConfig?: any,
  styleConfig?: any
) {
  // 动态导入以避免循环依赖
  const { createMapPlugin } = await import('./core/MapPlugin');
  return createMapPlugin(containerId, config, toolbarConfig, styleConfig);
}

/**
 * 初始化样式系统
 */
export async function initVMapStyles(config?: any) {
  // 动态导入以避免循环依赖
  const { initStyleSystem } = await import('./styles');
  return initStyleSystem(config);
}

/**
 * 获取样式管理器
 */
export async function getStyleManager() {
  // 动态导入以避免循环依赖
  const { styleManager } = await import('./styles');
  return styleManager;
}

/**
 * 版本信息
 */
export const VERSION = '2.0.0';
export const DESCRIPTION = 'VMap Cesium Tool - 基于Cesium和天地图的地图插件工具库';

/**
 * 默认导出（保持向后兼容）
 */
const VMap = {
  // 新架构
  MapPlugin: (await import('./core/MapPlugin')).MapPlugin,
  createMapPlugin: (await import('./core/MapPlugin')).createMapPlugin,
  createVMapPlugin,
  
  // 旧架构（向后兼容）
  CesiumMapToolbar: (await import('./libs/CesiumMapToolbar')).CesiumMapToolbar,
  DrawHelper: (await import('./libs/CesiumMapDraw')).default,
  CesiumOverlayService: (await import('./libs/CesiumOverlayService')).CesiumOverlayService,
  initCesium: (await import('./libs/CesiumMapLoader')).initCesium,
  initCesiumMap: (await import('./libs/CesiumMapLoader')).initCesium,
  HeatmapLayer: CesiumHeatmapLayer,
  PointClusterLayer: CesiumPointClusterLayer,
  
  // 工具函数
  initVMapStyles,
  getStyleManager,
  
  // 元数据
  VERSION,
  DESCRIPTION,
};

export default VMap;
