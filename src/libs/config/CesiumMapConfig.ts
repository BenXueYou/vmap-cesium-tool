import type { MapType } from '../CesiumMapModel';

/**
 * 天地图类型配置 - 简化的存根实现
 */
export const TDTMapTypes: MapType[] = [
  {
    id: 'vec',
    name: '矢量地图',
    nameKey: 'map.types.vec',
    provider: (token: string) => [],
  },
  {
    id: 'img',
    name: '影像地图',
    nameKey: 'map.types.img',
    provider: (token: string) => [],
  },
  {
    id: 'ter',
    name: '地形地图',
    nameKey: 'map.types.ter',
    provider: (token: string) => [],
  },
];