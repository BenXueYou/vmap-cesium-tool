import type { ButtonConfig } from '../CesiumMapModel';
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
    { id: 'search', icon: '🔍', title: '搜索', sort: defaultButtonSorts['search'] },
    { id: 'measure', icon: '📏', title: '测量', sort: defaultButtonSorts['measure'] },
    { id: 'view2d3d', icon: '3D', title: '2D或3D', sort: defaultButtonSorts['view2d3d'] },
    { id: 'layers', icon: '📚', title: '图层切换', sort: defaultButtonSorts['layers'] },
    { id: 'location', icon: '🎯', title: '定位', sort: defaultButtonSorts['location'] },
    { id: 'zoom-in', icon: '🔍-', title: '缩小', sort: defaultButtonSorts['zoom-in'] },
    { id: 'zoom-out', icon: '🔍+', title: '放大', sort: defaultButtonSorts['zoom-out'] },
    { id: 'fullscreen', icon: '⛶', title: '全屏', sort: defaultButtonSorts['fullscreen'] }
];