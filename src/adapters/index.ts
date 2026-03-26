/**
 * 适配器模块入口
 * 
 * 提供基于新框架架构的适配器，保持与旧 libs 代码的 API 兼容性。
 * 
 * @packageDocumentation
 */

// 导出工具栏适配器
export { ToolbarAdapter, createToolbarAdapter } from './ToolbarAdapter';
export type { LegacyCesiumMapToolbarCallbacks } from './ToolbarAdapter';

// 导出地图加载适配器
export { initCesium } from './MapLoaderAdapter';
export type { LegacyInitOptions, LegacyInitResult, LegacyMapCenter } from './MapLoaderAdapter';

// 导出绘制助手适配器
export { DrawHelperAdapter, createDrawHelperAdapter } from './DrawHelperAdapter';
export type { LegacyDrawCallbacks, LegacyDrawOptions, LegacyDrawEntity } from './DrawHelperAdapter';

// 导出覆盖物服务适配器
export { OverlayServiceAdapter, createOverlayServiceAdapter } from './OverlayServiceAdapter';
export type { LegacyCesiumOverlayServiceOptions } from './OverlayServiceAdapter';

/**
 * 适配器模块版本信息
 */
export const ADAPTERS_VERSION = '1.0.0';

/**
 * 适配器模块描述
 */
export const ADAPTERS_DESCRIPTION = 'VMap Cesium Tool 适配器模块 - 提供基于新框架架构的适配器，保持与旧 libs 代码的 API 兼容性';