/**
 * 样式模块入口文件
 * 导出样式管理、组件样式和主题相关功能
 */

// 导入样式管理器
import {
  StyleManager,
  createStyleManager,
  styleManager,
  type StyleRule,
  type Theme,
  type StyleManagerConfig,
} from './StyleManager';

// 导入组件样式工具
import {
  ComponentStyles,
  createComponentStyles,
  getPredefinedComponentStyles,
  predefinedComponentStyles,
  type ComponentStyleOptions,
} from './ComponentStyles';

// 导出样式管理器
export {
  StyleManager,
  createStyleManager,
  styleManager,
  type StyleRule,
  type Theme,
  type StyleManagerConfig,
} from './StyleManager';

// 导出组件样式工具
export {
  ComponentStyles,
  createComponentStyles,
  getPredefinedComponentStyles,
  predefinedComponentStyles,
  type ComponentStyleOptions,
} from './ComponentStyles';

/**
 * 样式模块版本信息
 */
export const VERSION = '1.0.0';

/**
 * 样式模块描述
 */
export const DESCRIPTION = 'VMap Cesium Tool 样式模块 - 提供样式管理、主题切换和组件样式功能';

/**
 * 预定义主题
 */
export const predefinedThemes = {
  light: {
    name: 'light',
    variables: {
      '--primary-color': '#4285f4',
      '--primary-hover-color': '#3367d6',
      '--primary-active-color': '#1a73e8',
      '--background-color': 'rgba(255, 255, 255, 0.95)',
      '--border-color': '#e0e0e0',
      '--text-color': '#333333',
      '--text-secondary-color': '#666666',
    },
    rules: [],
  },
  dark: {
    name: 'dark',
    variables: {
      '--primary-color': '#8ab4f8',
      '--primary-hover-color': '#669df6',
      '--primary-active-color': '#4285f4',
      '--background-color': 'rgba(32, 33, 36, 0.95)',
      '--border-color': '#5f6368',
      '--text-color': '#e8eaed',
      '--text-secondary-color': '#9aa0a6',
    },
    rules: [],
  },
  blue: {
    name: 'blue',
    variables: {
      '--primary-color': '#1976d2',
      '--primary-hover-color': '#1565c0',
      '--primary-active-color': '#0d47a1',
      '--background-color': 'rgba(227, 242, 253, 0.95)',
      '--border-color': '#bbdefb',
      '--text-color': '#0d47a1',
      '--text-secondary-color': '#1976d2',
    },
    rules: [],
  },
};

/**
 * 初始化样式系统
 */
export function initStyleSystem(config?: StyleManagerConfig): StyleManager {
  const manager = createStyleManager(config);
  
  // 添加预定义主题
  Object.values(predefinedThemes).forEach(theme => {
    manager.addTheme(theme);
  });
  
  return manager;
}

/**
 * 应用主题
 */
export function applyTheme(themeName: string): boolean {
  return styleManager.applyTheme(themeName);
}

/**
 * 获取当前主题
 */
export function getCurrentTheme(): string {
  return styleManager.getCurrentTheme();
}

/**
 * 获取所有可用主题
 */
export function getAvailableThemes(): string[] {
  return styleManager.getThemeNames();
}

/**
 * 默认导出样式模块
 */
const stylesModule = {
  VERSION,
  DESCRIPTION,
  styleManager,
  initStyleSystem,
  applyTheme,
  getCurrentTheme,
  getAvailableThemes,
  predefinedThemes,
  ComponentStyles,
  createComponentStyles,
};

export default stylesModule;