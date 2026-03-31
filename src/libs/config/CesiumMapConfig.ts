import type { MapType } from '../CesiumMapModel';
import { DEFAULT_MAP_TYPES } from '../../core/services/toolbar/config';

/**
 * 旧版天地图类型配置。
 * 直接复用 core 常量，保持默认配置单源化。
 */
export const TDTMapTypes: MapType[] = DEFAULT_MAP_TYPES.map((mapType) => ({
  ...mapType,
}));