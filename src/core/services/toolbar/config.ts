import searchIcon from './assets/toolbar/search@3x.png';
import measureIcon from './assets/toolbar/measure@3x.png';
import layersIcon from './assets/toolbar/layers@3x.png';
import locationIcon from './assets/toolbar/location@3x.png';
import zoomInIcon from './assets/toolbar/zoom-in@3x.png';
import zoomOutIcon from './assets/toolbar/zoom-out@3x.png';
import fullscreenIcon from './assets/toolbar/fullscreen@3x.png';
import areaIcon from './assets/measure/area.svg';
import distanceIcon from './assets/measure/distance.svg';
import clearIcon from './assets/measure/clear.svg';
import vecThumbnail from './assets/layers/vec_c.png';
import imgThumbnail from './assets/layers/img_c.png';
import terThumbnail from './assets/layers/ter_c.png';
import threeDThumbnail from './assets/layers/ele_c.jpg';

import type { CustomButtonConfig, MapType, ToolbarConfig } from '../../types';
import type { DefaultButtonConfig, MeasureMenuItem } from './types';
import { baseMapRegistry, buildDefaultBaseMap } from '../../mapProviders/registry';

export const DEFAULT_BUTTON_SORTS: Record<string, number> = {
  search: 0,
  measure: 1,
  view2d3d: 2,
  layers: 3,
  location: 4,
  'zoom-in': 5,
  'zoom-out': 6,
  fullscreen: 7,
};

export const DEFAULT_BUTTON_CONFIGS: CustomButtonConfig[] = [
  {
    size: 40,
    id: 'search',
    icon: searchIcon,
    title: '搜索',
    titleKey: 'toolbar.search',
    color: '#007BFF',
    borderColor: 'transparent',
    backgroundColor: 'rgba(66, 133, 244, 0.4)',
    hoverColor: 'rgba(51, 103, 214, 0.9)',
    sort: 0,
  },
  {
    size: 40,
    id: 'measure',
    icon: measureIcon,
    title: '测量',
    titleKey: 'toolbar.measure',
    color: '#007BFF',
    borderColor: 'transparent',
    backgroundColor: 'rgba(66, 133, 244, 0.4)',
    hoverColor: 'rgba(51, 103, 214, 0.9)',
    sort: 1,
  },
  {
    size: 40,
    id: 'view2d3d',
    icon: '3D',
    title: '2D 或 3D',
    titleKey: 'toolbar.view2d3d',
    color: '#007BFF',
    borderColor: 'transparent',
    backgroundColor: 'rgba(66, 133, 244, 0.4)',
    hoverColor: 'rgba(51, 103, 214, 0.9)',
    activeColor: 'rgba(26, 115, 232, 0.9)',
    activeIcon: '2D',
    sort: 2,
  },
  {
    size: 40,
    id: 'layers',
    icon: layersIcon,
    title: '图层切换',
    titleKey: 'toolbar.layers',
    color: '#007BFF',
    borderColor: 'transparent',
    backgroundColor: 'rgba(66, 133, 244, 0.4)',
    hoverColor: 'rgba(51, 103, 214, 0.9)',
    sort: 3,
  },
  {
    size: 40,
    id: 'location',
    icon: locationIcon,
    title: '定位',
    titleKey: 'toolbar.location',
    color: '#007BFF',
    borderColor: 'transparent',
    backgroundColor: 'rgba(66, 133, 244, 0.4)',
    hoverColor: 'rgba(51, 103, 214, 0.9)',
    sort: 4,
  },
  {
    size: 40,
    id: 'zoom-in',
    icon: zoomInIcon,
    title: '缩小',
    titleKey: 'toolbar.zoom_in',
    color: '#007BFF',
    borderColor: 'transparent',
    backgroundColor: 'rgba(66, 133, 244, 0.4)',
    hoverColor: 'rgba(51, 103, 214, 0.9)',
    sort: 5,
  },
  {
    size: 40,
    id: 'zoom-out',
    icon: zoomOutIcon,
    title: '放大',
    titleKey: 'toolbar.zoom_out',
    color: '#007BFF',
    borderColor: 'transparent',
    backgroundColor: 'rgba(66, 133, 244, 0.4)',
    hoverColor: 'rgba(51, 103, 214, 0.9)',
    sort: 6,
  },
  {
    size: 40,
    id: 'fullscreen',
    icon: fullscreenIcon,
    title: '全屏',
    titleKey: 'toolbar.fullscreen',
    color: '#007BFF',
    borderColor: 'transparent',
    backgroundColor: 'rgba(66, 133, 244, 0.4)',
    hoverColor: 'rgba(51, 103, 214, 0.9)',
    sort: 7,
  },
];

export const DEFAULT_MEASURE_ITEMS: MeasureMenuItem[] = [
  { id: 'measure-area', text: '测面积', textKey: 'measurement.menu.area', icon: areaIcon },
  { id: 'measure-distance', text: '测距', textKey: 'measurement.menu.distance', icon: distanceIcon },
  { id: 'clear-measurement', text: '清除', textKey: 'measurement.menu.clear', icon: clearIcon },
];

export const DEFAULT_TOOLBAR_STYLE: ToolbarConfig = {
  position: 'bottom-right',
  direction: 'column',
  buttonSize: 40,
  buttonSpacing: 8,
  padding: '8px',
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  borderColor: '#e0e0e0',
  borderWidth: 1,
  borderRadius: 6,
  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
  zIndex: 1000,
  offsetTop: 10,
  offsetRight: 10,
  offsetBottom: 10,
  offsetLeft: 10,
};

function resolveDefaultThumbnail(mapType: MapType): string {
  if (mapType.id.includes('3d')) {
    return threeDThumbnail;
  }
  if (mapType.id.includes('vec') || mapType.id.includes('vector') || mapType.id.includes('roadmap') || mapType.id.includes('normal')) {
    return vecThumbnail;
  }
  if (mapType.id.includes('ter')) {
    return terThumbnail;
  }
  return imgThumbnail;
}

export function withDefaultMapTypeThumbnails(mapTypes: MapType[]): MapType[] {
  return mapTypes.map((mapType) => ({
    ...mapType,
    thumbnail: mapType.thumbnail || resolveDefaultThumbnail(mapType),
  }));
}

// 默认仅展示天地图基础图层；业务方可通过配置显式覆盖为其他厂商。
export const DEFAULT_MAP_TYPES: MapType[] = withDefaultMapTypeThumbnails(
  baseMapRegistry.getMapTypes(buildDefaultBaseMap('tdt')),
);
