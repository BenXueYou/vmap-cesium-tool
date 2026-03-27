import * as Cesium from 'cesium';
import searchIcon from './assets/toolbar/search@3x.png';
import measureIcon from './assets/toolbar/measure@3x.png';
import layersIcon from './assets/toolbar/layers@3x.png';
import locationIcon from './assets/toolbar/location@3x.png';
import zoomInIcon from './assets/toolbar/zoom-in@3x.png';
import zoomOutIcon from './assets/toolbar/zoom-out@3x.png';
import fullscreenIcon from './assets/toolbar/fullscreen@3x.png';
import view2DIcon from './assets/toolbar/view_2d@3x.png';
import areaIcon from './assets/measure/area.svg';
import distanceIcon from './assets/measure/distance.svg';
import clearIcon from './assets/measure/clear.svg';
import vecThumbnail from './assets/layers/vec_c.png';
import imgThumbnail from './assets/layers/img_c.png';
import terThumbnail from './assets/layers/ter_c.png';

import type { CustomButtonConfig, MapType, ToolbarConfig } from '../../types';
import type { DefaultButtonConfig, MeasureMenuItem } from './types';

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
    icon: view2DIcon,
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

export const DEFAULT_MAP_TYPES: MapType[] = [
  {
    id: 'vec',
    name: '矢量地图',
    nameKey: 'map.types.vec',
    thumbnail: vecThumbnail,
    provider: (token: string) => [
      new Cesium.UrlTemplateImageryProvider({
        url: `https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        maximumLevel: 18,
        tileWidth: 256,
        tileHeight: 256,
      }),
    ],
  },
  {
    id: 'img',
    name: '影像地图',
    nameKey: 'map.types.img',
    thumbnail: imgThumbnail,
    provider: (token: string) => [
      new Cesium.UrlTemplateImageryProvider({
        url: `https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        maximumLevel: 18,
        tileWidth: 256,
        tileHeight: 256,
      }),
    ],
  },
  {
    id: 'ter',
    name: '地形地图',
    nameKey: 'map.types.ter',
    thumbnail: terThumbnail,
    provider: (token: string) => [
      new Cesium.UrlTemplateImageryProvider({
        url: `https://t{s}.tianditu.gov.cn/ter_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ter&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        maximumLevel: 18,
        tileWidth: 256,
        tileHeight: 256,
      }),
    ],
    terrainProvider: () => null,
  },
];