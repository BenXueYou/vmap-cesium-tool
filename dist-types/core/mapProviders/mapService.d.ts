import type { BaseMapConfig, BaseMapProviderId, MapAuthConfig, MapServiceConfig } from './types';
export interface ResolvedMapService {
    provider: BaseMapProviderId;
    baseMap: BaseMapConfig;
    auth?: MapAuthConfig;
    credentials: {
        serviceKey: string;
        secureKey: string;
        mapId: string;
    };
    isOffline: boolean;
}
export declare class MapServiceConfigError extends Error {
    constructor(message: string);
}
export declare function normalizeProviderId(provider?: string): BaseMapProviderId;
export declare function buildDefaultBaseMap(provider?: BaseMapProviderId): BaseMapConfig;
export declare function normalizeMapServiceConfig(mapService: MapServiceConfig): MapServiceConfig;
export declare function normalizeMapAuth(mapAuth?: MapAuthConfig): MapAuthConfig | undefined;
export declare function normalizeBaseMapConfig(baseMap: BaseMapConfig): BaseMapConfig;
export declare function resolveServiceKey(baseMap: BaseMapConfig, auth: MapAuthConfig | undefined, provider: BaseMapProviderId): string;
export declare function resolveSecureKey(baseMap: BaseMapConfig, auth: MapAuthConfig | undefined, provider: BaseMapProviderId): string;
export declare function resolveLegacyMapService(input: {
    baseMap: BaseMapConfig;
    mapAuth?: MapAuthConfig;
}): ResolvedMapService;
export declare function resolveConfiguredMapService(mapService: MapServiceConfig): ResolvedMapService;
