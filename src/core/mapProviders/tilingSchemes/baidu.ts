import * as Cesium from 'cesium';
import { coordinateService } from '../coordinates/CoordinateService';

class BaiduWebMercatorProjection {
  private readonly projection = new Cesium.WebMercatorProjection();

  project(cartographic: Cesium.Cartographic, result?: Cesium.Cartesian3): Cesium.Cartesian3 {
    const point = coordinateService.fromWGS84({
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      height: cartographic.height,
    }, 'BD09');

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
    }, 'BD09');

    cartographic.longitude = Cesium.Math.toRadians(point.longitude);
    cartographic.latitude = Cesium.Math.toRadians(point.latitude);
    cartographic.height = point.height ?? cartographic.height;
    return cartographic;
  }
}

export function createBaiduTilingScheme(): Cesium.WebMercatorTilingScheme {
  // 百度墨卡托瓦片使用的原生投影范围大于标准 WebMercator。
  // 如果沿用 Cesium 默认的 ±20037508 范围，生成的瓦片 x/y 会落到错误区域。
  const scheme = new Cesium.WebMercatorTilingScheme({
    rectangleSouthwestInMeters: new Cesium.Cartesian2(-33554054, -33746824),
    rectangleNortheastInMeters: new Cesium.Cartesian2(33554054, 33746824),
  });
  (scheme as any)._projection = new BaiduWebMercatorProjection();
  // 上面的百度原生米制范围若直接用标准 WebMercator 反算，会得到超出
  // [-PI, PI] 的经度，使 UrlTemplateImageryProvider.rectangle 变成 undefined。
  // 瓦片计算继续使用百度米制范围，对外覆盖范围保持为合法的全球墨卡托矩形。
  (scheme as any)._rectangle = Cesium.Rectangle.fromDegrees(
    -180,
    -Cesium.Math.toDegrees(Cesium.WebMercatorProjection.MaximumLatitude),
    180,
    Cesium.Math.toDegrees(Cesium.WebMercatorProjection.MaximumLatitude),
  );
  return scheme;
}
