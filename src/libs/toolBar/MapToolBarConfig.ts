import type { CustomButtonConfig } from '../CesiumMapModel';
import {
  DEFAULT_BUTTON_CONFIGS,
  DEFAULT_MEASURE_ITEMS,
  DEFAULT_TOOLBAR_STYLE,
} from '../../core/services/toolbar/config';

/**
 * 旧版默认按钮配置。
 * 从 core/constants 映射导出，避免重复维护。
 */
export const defaultButtons: CustomButtonConfig[] = DEFAULT_BUTTON_CONFIGS.map((button) => ({
  ...button,
}));

/**
 * 旧版默认测量菜单项。
 */
export const defaultMeasureItems = DEFAULT_MEASURE_ITEMS.map((item) => ({
  ...item,
}));

/**
 * 旧版默认工具栏样式配置。
 */
export const defaultToolBarStyle = {
  ...DEFAULT_TOOLBAR_STYLE,
};