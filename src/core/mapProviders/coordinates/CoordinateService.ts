import type { CoordSystem, LngLat } from './types';
import { transformLngLat } from './transform';

export class CoordinateService {
  toWGS84(point: LngLat, source: CoordSystem = 'WGS84'): LngLat {
    return transformLngLat(point, source, 'WGS84');
  }

  fromWGS84(point: LngLat, target: CoordSystem = 'WGS84'): LngLat {
    return transformLngLat(point, 'WGS84', target);
  }

  transform(point: LngLat, source: CoordSystem, target: CoordSystem): LngLat {
    return transformLngLat(point, source, target);
  }

  transformGeometry<T>(geometry: T, source: CoordSystem, target: CoordSystem): T {
    if (source === target) {
      return geometry;
    }

    if (Array.isArray(geometry)) {
      return geometry.map((item) => this.transformGeometry(item, source, target)) as T;
    }

    if (geometry && typeof geometry === 'object' && 'longitude' in (geometry as Record<string, unknown>) && 'latitude' in (geometry as Record<string, unknown>)) {
      return this.transform(geometry as unknown as LngLat, source, target) as T;
    }

    return geometry;
  }
}

export const coordinateService = new CoordinateService();
