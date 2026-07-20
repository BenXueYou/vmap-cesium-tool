import type { CoordSystem, LngLat } from './types';
export declare class CoordinateService {
    toWGS84(point: LngLat, source?: CoordSystem): LngLat;
    fromWGS84(point: LngLat, target?: CoordSystem): LngLat;
    transform(point: LngLat, source: CoordSystem, target: CoordSystem): LngLat;
    transformGeometry<T>(geometry: T, source: CoordSystem, target: CoordSystem): T;
}
export declare const coordinateService: CoordinateService;
