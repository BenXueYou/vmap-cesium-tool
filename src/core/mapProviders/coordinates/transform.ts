import { bd09ToGcj02, bd09ToWgs84, gcj02ToBd09, wgs84ToBd09 } from './bd09';
import { gcj02ToWgs84, wgs84ToGcj02 } from './gcj02';
import type { CoordSystem, LngLat } from './types';

export function transformLngLat(point: LngLat, source: CoordSystem, target: CoordSystem): LngLat {
  if (source === target) {
    return { ...point };
  }

  if (source === 'WGS84' && target === 'GCJ02') {
    return wgs84ToGcj02(point);
  }
  if (source === 'GCJ02' && target === 'WGS84') {
    return gcj02ToWgs84(point);
  }
  if (source === 'WGS84' && target === 'BD09') {
    return wgs84ToBd09(point);
  }
  if (source === 'BD09' && target === 'WGS84') {
    return bd09ToWgs84(point);
  }
  if (source === 'GCJ02' && target === 'BD09') {
    return gcj02ToBd09(point);
  }
  if (source === 'BD09' && target === 'GCJ02') {
    return bd09ToGcj02(point);
  }

  return { ...point };
}
