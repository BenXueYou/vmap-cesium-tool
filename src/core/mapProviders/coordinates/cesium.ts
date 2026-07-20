import * as Cesium from 'cesium';
import type { CoordSystem, LngLat } from './types';
import { coordinateService } from './CoordinateService';

export function cartesianToLngLat(position: Cesium.Cartesian3, outputCoordSystem: CoordSystem = 'WGS84'): LngLat {
  const cartographic = Cesium.Cartographic.fromCartesian(position);
  return coordinateService.fromWGS84({
    longitude: Cesium.Math.toDegrees(cartographic.longitude),
    latitude: Cesium.Math.toDegrees(cartographic.latitude),
    height: cartographic.height,
  }, outputCoordSystem);
}

export function lngLatToCartesian(point: LngLat, coordSystem: CoordSystem = 'WGS84'): Cesium.Cartesian3 {
  const wgs84 = coordinateService.toWGS84(point, coordSystem);
  return Cesium.Cartesian3.fromDegrees(wgs84.longitude, wgs84.latitude, wgs84.height ?? 0);
}

export function positionsToLngLats(
  positions: Cesium.Cartesian3[],
  outputCoordSystem: CoordSystem = 'WGS84',
): LngLat[] {
  return positions.map((position) => cartesianToLngLat(position, outputCoordSystem));
}
