/**
 * 核心模块入口文件
 * 导出所有核心类型、常量和类
 */

// 导出类型定义
export * from './types';

// 导出常量
export * from './constants';

// 导出主插件类
export { MapPlugin, createMapPlugin } from './MapPlugin';

// 重新导出 Cesium 类型（可选）
import * as Cesium from 'cesium';
export { Cesium };

/**
 * 核心模块版本信息
 */
export const VERSION = '1.0.0';

/**
 * 核心模块描述
 */
export const DESCRIPTION = 'VMap Cesium Tool 核心模块 - 提供地图插件的基础类型、常量和核心类';

/**
 * 默认导出核心模块
 */
const coreModule = {
  VERSION,
  DESCRIPTION,
};

export default coreModule;