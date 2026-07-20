import type { LngLat } from './types';

const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function transformLatitude(x: number, y: number): number {
  let result = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  result += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  result += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
  result += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
  return result;
}

function transformLongitude(x: number, y: number): number {
  let result = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  result += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  result += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
  result += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
  return result;
}

export function isInsideChina(longitude: number, latitude: number): boolean {
  return longitude >= 72.004 && longitude <= 137.8347 && latitude >= 0.8293 && latitude <= 55.8271;
}

export function wgs84ToGcj02(point: LngLat): LngLat {
  if (!isInsideChina(point.longitude, point.latitude)) {
    return { ...point };
  }

  const dLat = transformLatitude(point.longitude - 105.0, point.latitude - 35.0);
  const dLon = transformLongitude(point.longitude - 105.0, point.latitude - 35.0);
  const radLat = point.latitude / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  const mgLat = point.latitude + (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  const mgLon = point.longitude + (dLon * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);

  return {
    longitude: mgLon,
    latitude: mgLat,
    height: point.height,
  };
}

export function gcj02ToWgs84(point: LngLat): LngLat {
  if (!isInsideChina(point.longitude, point.latitude)) {
    return { ...point };
  }

  const gcj = wgs84ToGcj02(point);
  return {
    longitude: point.longitude * 2 - gcj.longitude,
    latitude: point.latitude * 2 - gcj.latitude,
    height: point.height,
  };
}
