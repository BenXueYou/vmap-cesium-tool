/**
 * 适配器模块入口
 *
 * 提供基于新框架架构的适配器，保持与旧 libs 代码的 API 兼容性。
 *
 * @packageDocumentation
 */
export { ToolbarAdapter, createToolbarAdapter } from './ToolbarAdapter';
export type { LegacyCesiumMapToolbarCallbacks } from './ToolbarAdapter';
export { initCesium } from './MapLoaderAdapter';
export type { LegacyInitOptions, LegacyInitResult, LegacyMapCenter } from './MapLoaderAdapter';
export { DrawHelperAdapter, createDrawHelperAdapter } from './DrawHelperAdapter';
export type { LegacyDrawCallbacks, LegacyDrawOptions, LegacyDrawEntity } from './DrawHelperAdapter';
export { HeatmapLayer } from './HeatmapLayerAdapter';
export type { HeatPoint, HeatmapAutoUpdateOptions, HeatmapGradient, HeatmapOptions, } from './HeatmapLayerAdapter';
export { OverlayServiceAdapter, createOverlayServiceAdapter } from './OverlayServiceAdapter';
export type { LegacyCesiumOverlayServiceOptions } from './OverlayServiceAdapter';
export { MapMarkAdapter } from './MapMarkAdapter';
export type { CesiumMapMarkOptions } from './MapMarkAdapter';
/**
 * 适配器模块版本信息
 */
export declare const ADAPTERS_VERSION = "1.0.0";
/**
 * 适配器模块描述
 */
export declare const ADAPTERS_DESCRIPTION = "VMap Cesium Tool \u9002\u914D\u5668\u6A21\u5757 - \u63D0\u4F9B\u57FA\u4E8E\u65B0\u6846\u67B6\u67B6\u6784\u7684\u9002\u914D\u5668\uFF0C\u4FDD\u6301\u4E0E\u65E7 libs \u4EE3\u7801\u7684 API \u517C\u5BB9\u6027";
