/**
 * 组件模块入口文件
 * 导出所有可重用的UI组件
 */

// 导入组件
import { BaseComponent, createComponent } from './BaseComponent';
import { ToolbarButton, createToolbarButton } from './ToolbarButton';
import { Toolbar, createToolbar } from './Toolbar';
import { SearchBox, createSearchBox, type SearchBoxConfig } from './SearchBox';

// 导出基础组件
export { BaseComponent, createComponent } from './BaseComponent';

// 导出工具栏按钮组件
export { ToolbarButton, createToolbarButton } from './ToolbarButton';

// 导出工具栏组件
export { Toolbar, createToolbar } from './Toolbar';

// 导出搜索框组件
export { SearchBox, createSearchBox, type SearchBoxConfig } from './SearchBox';

// 导出类型
export type { StyleConfig } from '../core/types';

/**
 * 组件模块版本信息
 */
export const VERSION = '1.0.0';

/**
 * 组件模块描述
 */
export const DESCRIPTION = 'VMap Cesium Tool 组件模块 - 提供可重用的UI组件，支持样式隔离和自定义';

/**
 * 默认导出组件模块
 */
const componentsModule = {
  VERSION,
  DESCRIPTION,
  BaseComponent,
  ToolbarButton,
  Toolbar,
  SearchBox,
  createComponent,
  createToolbarButton,
  createToolbar,
  createSearchBox,
};

export default componentsModule;