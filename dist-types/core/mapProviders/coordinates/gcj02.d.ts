import type { LngLat } from './types';
export declare function isInsideChina(longitude: number, latitude: number): boolean;
export declare function wgs84ToGcj02(point: LngLat): LngLat;
export declare function gcj02ToWgs84(point: LngLat): LngLat;
