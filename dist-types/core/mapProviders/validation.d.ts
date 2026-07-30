import type { MapServiceConfig, MapServiceProvider, MapServiceValidationOptions, MapServiceValidationResult } from './types';
export declare function getDefaultMapServiceSearchCapability(provider: MapServiceProvider): MapServiceValidationResult['capabilities']['search'];
export declare function validateMapService(mapService: MapServiceConfig, options?: MapServiceValidationOptions): Promise<MapServiceValidationResult>;
