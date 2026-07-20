import * as Cesium from 'cesium';
import { coordinateService } from '../coordinates/CoordinateService';

class GCJ02WebMercatorProjection {
  private readonly projection = new Cesium.WebMercatorProjection();

  project(cartographic: Cesium.Cartographic, result?: Cesium.Cartesian3): Cesium.Cartesian3 {
    const point = coordinateService.fromWGS84({
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      height: cartographic.height,
    }, 'GCJ02');

    return this.projection.project(new Cesium.Cartographic(
      Cesium.Math.toRadians(point.longitude),
      Cesium.Math.toRadians(point.latitude),
      point.height ?? cartographic.height,
    ), result);
  }

  unproject(cartesian: Cesium.Cartesian3, result?: Cesium.Cartographic): Cesium.Cartographic {
    const cartographic = this.projection.unproject(cartesian, result);
    const point = coordinateService.toWGS84({
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      height: cartographic.height,
    }, 'GCJ02');

    cartographic.longitude = Cesium.Math.toRadians(point.longitude);
    cartographic.latitude = Cesium.Math.toRadians(point.latitude);
    cartographic.height = point.height ?? cartographic.height;
    return cartographic;
  }
}

export function createGCJ02TilingScheme(): Cesium.WebMercatorTilingScheme {
  const scheme = new Cesium.WebMercatorTilingScheme();
  (scheme as any)._projection = new GCJ02WebMercatorProjection();
  return scheme;
}
