import * as Cesium from 'cesium';
import type { MapType } from '../types';
import type { BaseMapConfig, MapAuthConfig } from './types';
import { buildDefaultBaseMap, normalizeProviderId } from './mapService';
export declare function resolveMapTypeId(baseMap: BaseMapConfig): string;
export declare function mapTypeIdToBaseMapConfig(mapTypeId: string, current: BaseMapConfig): BaseMapConfig;
export declare class BaseMapRegistry {
    getMapTypes(baseMap: BaseMapConfig, auth?: MapAuthConfig, viewer?: Cesium.Viewer): MapType[];
    getAllMapTypes(auth?: MapAuthConfig, viewer?: Cesium.Viewer): MapType[];
    getMapTypeById(mapTypeId: string, baseMap: BaseMapConfig, auth?: MapAuthConfig, viewer?: Cesium.Viewer): MapType | undefined;
}
export declare const baseMapRegistry: BaseMapRegistry;
export { buildDefaultBaseMap, normalizeProviderId };
