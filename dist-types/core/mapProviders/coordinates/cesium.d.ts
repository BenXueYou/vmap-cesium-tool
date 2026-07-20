import * as Cesium from 'cesium';
import type { CoordSystem, LngLat } from './types';
export declare function cartesianToLngLat(position: Cesium.Cartesian3, outputCoordSystem?: CoordSystem): LngLat;
export declare function lngLatToCartesian(point: LngLat, coordSystem?: CoordSystem): Cesium.Cartesian3;
export declare function positionsToLngLats(positions: Cesium.Cartesian3[], outputCoordSystem?: CoordSystem): LngLat[];
