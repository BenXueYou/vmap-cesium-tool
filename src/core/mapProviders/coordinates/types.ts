export type CoordSystem = 'WGS84' | 'GCJ02' | 'BD09';

export interface LngLat {
  longitude: number;
  latitude: number;
  height?: number;
}
