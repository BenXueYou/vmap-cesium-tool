/**
 * 样式模块入口文件
 * 导出样式管理、组件样式和主题相关功能
 */
import { StyleManager, type StyleManagerConfig } from './StyleManager';
import { ComponentStyles, createComponentStyles } from './ComponentStyles';
export { StyleManager, createStyleManager, styleManager, type StyleRule, type Theme, type StyleManagerConfig, } from './StyleManager';
export { ComponentStyles, createComponentStyles, getPredefinedComponentStyles, predefinedComponentStyles, type ComponentStyleOptions, } from './ComponentStyles';
/**
 * 样式模块版本信息
 */
export declare const VERSION = "1.0.0";
/**
 * 样式模块描述
 */
export declare const DESCRIPTION = "VMap Cesium Tool \u6837\u5F0F\u6A21\u5757 - \u63D0\u4F9B\u6837\u5F0F\u7BA1\u7406\u3001\u4E3B\u9898\u5207\u6362\u548C\u7EC4\u4EF6\u6837\u5F0F\u529F\u80FD";
/**
 * 预定义主题
 */
export declare const predefinedThemes: {
    light: {
        name: string;
        variables: {
            '--primary-color': string;
            '--primary-hover-color': string;
            '--primary-active-color': string;
            '--background-color': string;
            '--border-color': string;
            '--text-color': string;
            '--text-secondary-color': string;
        };
        rules: never[];
    };
    dark: {
        name: string;
        variables: {
            '--primary-color': string;
            '--primary-hover-color': string;
            '--primary-active-color': string;
            '--background-color': string;
            '--border-color': string;
            '--text-color': string;
            '--text-secondary-color': string;
        };
        rules: never[];
    };
    blue: {
        name: string;
        variables: {
            '--primary-color': string;
            '--primary-hover-color': string;
            '--primary-active-color': string;
            '--background-color': string;
            '--border-color': string;
            '--text-color': string;
            '--text-secondary-color': string;
        };
        rules: never[];
    };
};
/**
 * 初始化样式系统
 */
export declare function initStyleSystem(config?: StyleManagerConfig): StyleManager;
/**
 * 应用主题
 */
export declare function applyTheme(themeName: string): boolean;
/**
 * 获取当前主题
 */
export declare function getCurrentTheme(): string;
/**
 * 获取所有可用主题
 */
export declare function getAvailableThemes(): string[];
/**
 * 默认导出样式模块
 */
declare const stylesModule: {
    VERSION: string;
    DESCRIPTION: string;
    styleManager: StyleManager;
    initStyleSystem: typeof initStyleSystem;
    applyTheme: typeof applyTheme;
    getCurrentTheme: typeof getCurrentTheme;
    getAvailableThemes: typeof getAvailableThemes;
    predefinedThemes: {
        light: {
            name: string;
            variables: {
                '--primary-color': string;
                '--primary-hover-color': string;
                '--primary-active-color': string;
                '--background-color': string;
                '--border-color': string;
                '--text-color': string;
                '--text-secondary-color': string;
            };
            rules: never[];
        };
        dark: {
            name: string;
            variables: {
                '--primary-color': string;
                '--primary-hover-color': string;
                '--primary-active-color': string;
                '--background-color': string;
                '--border-color': string;
                '--text-color': string;
                '--text-secondary-color': string;
            };
            rules: never[];
        };
        blue: {
            name: string;
            variables: {
                '--primary-color': string;
                '--primary-hover-color': string;
                '--primary-active-color': string;
                '--background-color': string;
                '--border-color': string;
                '--text-color': string;
                '--text-secondary-color': string;
            };
            rules: never[];
        };
    };
    ComponentStyles: typeof ComponentStyles;
    createComponentStyles: typeof createComponentStyles;
};
export default stylesModule;
