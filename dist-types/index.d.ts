/**
 * VMap Cesium Tool 主入口文件 (新架构)
 *
 * 基于 core/components/services 架构重构后的新入口点。
 * 提供模块化的 API，同时通过适配器保持向后兼容。
 */
import { createMapPlugin } from './core/MapPlugin';
import type { ToolbarConfig } from './core/types';
import { initStyleSystem } from './styles';
export { MapPlugin, createMapPlugin } from './core/MapPlugin';
/**
 * @deprecated 使用 MapPluginOptions 代替
 */
export type { ToolbarConfig, ButtonConfig, CustomButtonConfig, SearchCallback, SearchResult, MeasurementCallback, ZoomCallback, MapType, MapToolsConfig, ComponentStyleConfig, StyleConfig, LayersPanelStyleConfig, SearchPanelStyleConfig, ToolbarSearchMenuOptions, ToolbarLayersMenuOptions, NoFlyZonePluginOptions, MapPluginOptions, CameraConfig, LayersConfig, ProviderType, BaseMapConfig, BaseMapProviderId, MapAuthConfig, ProviderSearchOptions, CreditsOptions, BaseMapRectangle, OfflineCameraBoundsConfig, CoordSystem, CoordinateAwareInput, CoordinateAwareOutput, TDTLayerConfig, GaodeLayerConfig, TencentLayerConfig, GoogleLayerConfig, BaiduLayerConfig, ArcGISLayerConfig, OSMLayerConfig, CustomLayerConfig, } from './core/types';
export { BaseOverlay, Marker, Label, Icon, SVG, InfoWindow, Polyline, Polygon, Rectangle, Circle, Ring, } from './core/entities';
export type { OverlayPosition, BaseOverlayOptions, OverlayClickHighlightOptions, OverlayHoverHighlightOptions, OverlayEntity, MarkerOptions, LabelOptions, IconOptions, SvgOptions, InfoWindowOptions, PolylineOptions, PolygonOptions, RectangleOptions, CircleOptions, RingOptions, } from './core/entities';
export { OverlayService, resolveOverlayPickCandidates, DrawService, ToolbarService, createToolbarService, } from './core/services';
export type { OverlayServiceOptions, OverlayPickingOptions, OverlayPickCandidate, OverlayPickReason, OverlayPickResolverOptions, OverlayPickRoot, DrawMode, DrawOptions, DrawResult, DrawServiceOptions, MeasurementFillStyle, MeasurementLabelOffset, MeasurementStrokeStyle, MeasurementSummaryLabelStyle, MeasurementTheme, MeasurementVertexStyle, MarkCallbacks, MarkDrawOptions, MarkDrawResult, MarkDrawType, MarkEditOptions, MarkExportItem, MarkServiceOptions, MarkWorkAreaKind, MarkWorkAreaType, ToolbarServiceOptions, ToolbarCallbacks, } from './core/services';
export { MarkService, MarkToolbar } from './core/services';
export { PointClusterLayer, setTDTPlugin, createTDTImageryConfig, createTDTVectorConfig, createTDTTerrainConfig, createTDT3DImageryConfig, createTDT3DTerrainProvider, createTDT3DGeoWTFS, hasTDT3DExtension, } from './core/layers';
export { HeatmapLayer } from './adapters/HeatmapLayerAdapter';
export { baseMapRegistry } from './core/mapProviders/registry';
export { ProviderSearchService, createAmapSignature, normalizeMapAuth } from './core/mapProviders/ProviderSearchService';
export type { ClusterPoint, ClusterStyleStep, PointClusterLayerOptions, } from './core/layers';
export type { HeatPoint, HeatmapAutoUpdateOptions, HeatmapGradient, HeatmapOptions, } from './adapters/HeatmapLayerAdapter';
export { BaseComponent, Toolbar, ToolbarButton, SearchBox, } from './components';
export { styleManager, initStyleSystem, applyTheme, getCurrentTheme, getAvailableThemes, } from './styles';
export { i18n } from './i18n';
export type { I18nLike } from './i18n';
export { CoordinateService, coordinateService } from './core/mapProviders/coordinates/CoordinateService';
export { DrawHelperAdapter as DrawHelper } from './adapters/DrawHelperAdapter';
export type { LegacyDrawCallbacks, LegacyDrawOptions, LegacyDrawEntity, } from './adapters/DrawHelperAdapter';
export { OverlayServiceAdapter as CesiumOverlayService } from './adapters/OverlayServiceAdapter';
export type { LegacyCesiumOverlayServiceOptions } from './adapters/OverlayServiceAdapter';
export { ToolbarAdapter as CesiumMapToolbar } from './adapters/ToolbarAdapter';
export type { LegacyCesiumMapToolbarCallbacks } from './adapters/ToolbarAdapter';
export { initCesium } from './adapters/MapLoaderAdapter';
export type { LegacyInitOptions, LegacyInitResult, LegacyMapCenter } from './adapters/MapLoaderAdapter';
export { MapMarkAdapter as CesiumMapMark } from './adapters/MapMarkAdapter';
export type { CesiumMapMarkOptions } from './adapters/MapMarkAdapter';
export { DrawHelperAdapter as CompatDrawHelper, OverlayServiceAdapter as CompatCesiumOverlayService, ToolbarAdapter as CompatCesiumMapToolbar, MapMarkAdapter as CompatCesiumMapMark, } from './adapters';
/**
 * 快速创建地图插件实例
 */
export declare function createVMap(containerId: string, config?: Parameters<typeof createMapPlugin>[1], toolbarConfig?: ToolbarConfig): import("./core/MapPlugin").MapPlugin;
/**
 * 快速初始化样式系统
 */
export declare function initVMapStyles(config?: Parameters<typeof initStyleSystem>[0]): import("./styles").StyleManager;
export declare const VERSION = "2.0.0";
export declare const DESCRIPTION = "VMap Cesium Tool - \u57FA\u4E8E Cesium \u548C\u5929\u5730\u56FE\u7684\u5730\u56FE\u63D2\u4EF6\u5DE5\u5177\u5E93 (\u65B0\u67B6\u6784)";
