/**
 * 组件模块入口文件
 * 导出所有可重用的UI组件
 */
import { BaseComponent, createComponent } from './BaseComponent';
import { ToolbarButton, createToolbarButton } from './ToolbarButton';
import { Toolbar, createToolbar } from './Toolbar';
import { SearchBox, createSearchBox } from './SearchBox';
export { BaseComponent, createComponent } from './BaseComponent';
export { ToolbarButton, createToolbarButton } from './ToolbarButton';
export { Toolbar, createToolbar } from './Toolbar';
export { SearchBox, createSearchBox, type SearchBoxConfig } from './SearchBox';
export type { StyleConfig } from '../core/types';
/**
 * 组件模块版本信息
 */
export declare const VERSION = "1.0.0";
/**
 * 组件模块描述
 */
export declare const DESCRIPTION = "VMap Cesium Tool \u7EC4\u4EF6\u6A21\u5757 - \u63D0\u4F9B\u53EF\u91CD\u7528\u7684UI\u7EC4\u4EF6\uFF0C\u652F\u6301\u6837\u5F0F\u9694\u79BB\u548C\u81EA\u5B9A\u4E49";
/**
 * 默认导出组件模块
 */
declare const componentsModule: {
    VERSION: string;
    DESCRIPTION: string;
    BaseComponent: typeof BaseComponent;
    ToolbarButton: typeof ToolbarButton;
    Toolbar: typeof Toolbar;
    SearchBox: typeof SearchBox;
    createComponent: typeof createComponent;
    createToolbarButton: typeof createToolbarButton;
    createToolbar: typeof createToolbar;
    createSearchBox: typeof createSearchBox;
};
export default componentsModule;
