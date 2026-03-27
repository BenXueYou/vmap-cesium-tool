/**
 * 工具栏服务模块
 * 
 * 提供基于分层架构的工具栏功能实现：
 * - ToolbarService: 核心服务类，负责工具栏的创建和管理
 * - BaseButtonHandler: 按钮处理器基类
 * - SimpleButtonHandler: 简单按钮处理器（2D/3D、定位、缩放、全屏）
 * - SearchButtonHandler: 搜索按钮处理器
 * - MeasureButtonHandler: 测量按钮处理器
 * - LayersButtonHandler: 图层按钮处理器
 * - BaseMenu: 菜单基类
 * - MeasureMenu: 测量菜单
 */

// 核心服务
export { ToolbarService, createToolbarService } from './ToolbarService';
export type { ToolbarServiceOptions } from './ToolbarService';

// 类型定义
export type {
  IButtonHandler,
  IMenu,
  ToolbarServiceConfig,
  ToolbarCallbacks,
  MeasurementCompleteEvent,
  MeasurementServiceLike,
  SearchResult,
  SearchServiceConfig,
  MeasurementServiceConfig,
  LayersServiceConfig,
  NoFlyZoneServiceConfig,
  MapControllerConfig,
  DefaultButtonConfig,
  MeasureMenuItem,
} from './types';

// 按钮处理器
export { BaseButtonHandler } from './buttons/BaseButtonHandler';
export { SimpleButtonHandler, createSimpleButtonHandler } from './buttons/SimpleButtonHandler';
export type { SimpleButtonConfig, MapControllerLike } from './buttons/SimpleButtonHandler';
export { SearchButtonHandler } from './buttons/SearchButtonHandler';
export type { SearchButtonHandlerOptions } from './buttons/SearchButtonHandler';
export { MeasureButtonHandler } from './buttons/MeasureButtonHandler';
export type { MeasureButtonHandlerOptions } from './buttons/MeasureButtonHandler';
export { LayersButtonHandler } from './buttons/LayersButtonHandler';
export type { LayersButtonHandlerOptions, MapTypeConfig } from './buttons/LayersButtonHandler';

// 菜单
export { BaseMenu } from './menus/BaseMenu';
export type { MenuPositionConfig } from './menus/BaseMenu';
export { MeasureMenu } from './menus/MeasureMenu';
export type { MeasureMenuOptions } from './menus/MeasureMenu';

// 常量
export {
  DEFAULT_BUTTONS,
  DEFAULT_BUTTON_CONFIGS,
  DEFAULT_BUTTON_SORTS,
  DEFAULT_MEASURE_ITEMS,
  DEFAULT_TOOLBAR_STYLE,
  DEFAULT_MAP_TYPES,
} from './config';