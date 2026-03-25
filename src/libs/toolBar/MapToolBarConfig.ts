import type { CustomButtonConfig } from '../CesiumMapModel';

/**
 * 默认按钮配置
 */
export const defaultButtons: CustomButtonConfig[] = [
  { id: 'search', icon: '🔍', title: '搜索', titleKey: 'toolbar.search' },
  { id: 'measure', icon: '📏', title: '测量', titleKey: 'toolbar.measure' },
  { id: 'view2d3d', icon: '3D', title: '2D或3D', titleKey: 'toolbar.view2d3d' },
  { id: 'layers', icon: '📚', title: '图层切换', titleKey: 'toolbar.layers' },
  { id: 'location', icon: '🎯', title: '定位', titleKey: 'toolbar.location' },
  { id: 'zoom-in', icon: '🔍-', title: '缩小', titleKey: 'toolbar.zoom_in' },
  { id: 'zoom-out', icon: '🔍+', title: '放大', titleKey: 'toolbar.zoom_out' },
  { id: 'fullscreen', icon: '⛶', title: '全屏', titleKey: 'toolbar.fullscreen' }
];

/**
 * 默认测量菜单项
 */
export const defaultMeasureItems = [
  { id: 'measure-area', text: '测面积', textKey: 'measurement.menu.area', icon: '📐' },
  { id: 'measure-distance', text: '测距', textKey: 'measurement.menu.distance', icon: '📏' },
  { id: 'clear-measurement', text: '清除', textKey: 'measurement.menu.clear', icon: '🗑️' }
];

/**
 * 默认工具栏样式配置
 */
export const defaultToolBarStyle = {
  position: 'bottom-right' as const,
  buttonSize: 40,
  buttonSpacing: 8,
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  borderColor: '#e0e0e0',
  borderRadius: 6,
  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
  zIndex: 1000,
};