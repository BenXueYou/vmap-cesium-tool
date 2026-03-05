import type { ButtonConfig, ToolbarConfig } from '../CesiumMapModel';
export const defaultButtonSorts: Record<string, number> = {
    'search': 0,
    'measure': 1,
    'view2d3d': 2,
    'layers': 3,
    'location': 4,
    'zoom-in': 5,
    'zoom-out': 6,
    'fullscreen': 7
};

// 获取默认按钮配置
export const defaultButtons: ButtonConfig[] = [
    { id: 'search', icon: '🔍', title: '搜索', titleKey: 'toolbar.search', sort: defaultButtonSorts['search'] },
    { id: 'measure', icon: '📏', title: '测量', titleKey: 'toolbar.measure', sort: defaultButtonSorts['measure'] },
    { id: 'view2d3d', icon: '3D', title: '2D或3D', titleKey: 'toolbar.view2d3d', sort: defaultButtonSorts['view2d3d'] },
    { id: 'layers', icon: '📚', title: '图层切换', titleKey: 'toolbar.layers', sort: defaultButtonSorts['layers'] },
    { id: 'location', icon: '🎯', title: '定位', titleKey: 'toolbar.location', sort: defaultButtonSorts['location'] },
    { id: 'zoom-in', icon: '🔍-', title: '缩小', titleKey: 'toolbar.zoom_in', sort: defaultButtonSorts['zoom-in'] },
    { id: 'zoom-out', icon: '🔍+', title: '放大', titleKey: 'toolbar.zoom_out', sort: defaultButtonSorts['zoom-out'] },
    { id: 'fullscreen', icon: '⛶', title: '全屏', titleKey: 'toolbar.fullscreen', sort: defaultButtonSorts['fullscreen'] }
];

// 测量菜单
export const defaultMeasureItems = [
    { id: 'measure-area', text: '测面积', textKey: 'measurement.menu.area', icon: 'src/assets/images/svg/area.svg' },
    { id: 'measure-distance', text: '测距', textKey: 'measurement.menu.distance', icon: 'src/assets/images/svg/distance.svg' },
    { id: 'clear-measurement', text: '清除', textKey: 'measurement.menu.clear', icon: 'src/assets/images/svg/clear .svg' }
]

// 测量绘制
export const defaultToolBarStyle: ToolbarConfig = {
    position: 'bottom-right',
    buttonSize: 40,
    buttonSpacing: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: '#e0e0e0',
    borderRadius: 6,
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
}


