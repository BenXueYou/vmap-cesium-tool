import type { LngLat } from './types';
import { gcj02ToWgs84, wgs84ToGcj02 } from './gcj02';

const X_PI = Math.PI * 3000.0 / 180.0;

export function gcj02ToBd09(point: LngLat): LngLat {
  const z = Math.sqrt(point.longitude * point.longitude + point.latitude * point.latitude) + 0.00002 * Math.sin(point.latitude * X_PI);
  const theta = Math.atan2(point.latitude, point.longitude) + 0.000003 * Math.cos(point.longitude * X_PI);

  return {
    longitude: z * Math.cos(theta) + 0.0065,
    latitude: z * Math.sin(theta) + 0.006,
    height: point.height,
  };
}

export function bd09ToGcj02(point: LngLat): LngLat {
  const x = point.longitude - 0.0065;
  const y = point.latitude - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI);

  return {
    longitude: z * Math.cos(theta),
    latitude: z * Math.sin(theta),
    height: point.height,
  };
}

export function wgs84ToBd09(point: LngLat): LngLat {
  return gcj02ToBd09(wgs84ToGcj02(point));
}

export function bd09ToWgs84(point: LngLat): LngLat {
  return gcj02ToWgs84(bd09ToGcj02(point));
}
