import * as Cesium from 'cesium';
import type { Cartesian3 } from 'cesium';

import { DEFAULT_CIRCLE_SEGMENTS } from '../drawDefaults';
import { toCartographic } from './drawPosition';
import type { DrawMode } from '../types/drawTypes';

export function calculateDistance(cart1: Cesium.Cartographic, cart2: Cesium.Cartographic): number {
  const earthRadius = 6378137.0;
  const deltaLatitude = cart2.latitude - cart1.latitude;
  const deltaLongitude = cart2.longitude - cart1.longitude;
  const a = Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2)
    + Math.cos(cart1.latitude) * Math.cos(cart2.latitude)
    * Math.sin(deltaLongitude / 2) * Math.sin(deltaLongitude / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

export function calculateTotalDistance(positions: Cartesian3[]): number {
  let distance = 0;

  for (let index = 1; index < positions.length; index += 1) {
    const start = toCartographic(positions[index - 1]);
    const end = toCartographic(positions[index]);
    if (!start || !end) {
      continue;
    }

    distance += calculateDistance(start, end);
  }

  return distance;
}

export function calculatePolygonArea(positions: Cartesian3[]): number {
  if (positions.length < 3) {
    return 0;
  }

  const origin = positions[0];
  const inverseFrame = Cesium.Matrix4.inverse(
    Cesium.Transforms.eastNorthUpToFixedFrame(origin),
    new Cesium.Matrix4(),
  );

  let area = 0;
  for (let index = 0; index < positions.length; index += 1) {
    const current = Cesium.Matrix4.multiplyByPoint(inverseFrame, positions[index], new Cesium.Cartesian3());
    const next = Cesium.Matrix4.multiplyByPoint(
      inverseFrame,
      positions[(index + 1) % positions.length],
      new Cesium.Cartesian3(),
    );
    area += current.x * next.y - next.x * current.y;
  }

  return Math.abs(area) / 2;
}

export function getRectangleCornerPositions(start: Cartesian3, end: Cartesian3): Cartesian3[] {
  const startCarto = toCartographic(start);
  const endCarto = toCartographic(end);
  if (!startCarto || !endCarto) {
    return [];
  }

  const west = Math.min(startCarto.longitude, endCarto.longitude);
  const south = Math.min(startCarto.latitude, endCarto.latitude);
  const east = Math.max(startCarto.longitude, endCarto.longitude);
  const north = Math.max(startCarto.latitude, endCarto.latitude);

  return [
    Cesium.Cartesian3.fromRadians(west, north, 0),
    Cesium.Cartesian3.fromRadians(east, north, 0),
    Cesium.Cartesian3.fromRadians(east, south, 0),
    Cesium.Cartesian3.fromRadians(west, south, 0),
  ];
}

export function generateCirclePositions(
  center: Cesium.Cartographic,
  radius: number,
  segments: number = DEFAULT_CIRCLE_SEGMENTS,
): Cartesian3[] {
  const positions: Cartesian3[] = [];
  const earthRadius = 6378137;

  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const deltaLongitude = (radius / earthRadius) * Math.cos(angle) / Math.max(Math.cos(center.latitude), 1e-6);
    const deltaLatitude = (radius / earthRadius) * Math.sin(angle);
    positions.push(Cesium.Cartesian3.fromRadians(
      center.longitude + deltaLongitude,
      center.latitude + deltaLatitude,
      0,
    ));
  }

  return positions;
}

export function formatDistance(distance: number): string {
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(2)}km`;
  }

  return `${distance.toFixed(2)}m`;
}

export function formatArea(area: number): string {
  if (area >= 1_000_000) {
    return `${(area / 1_000_000).toFixed(2)}km²`;
  }

  return `${area.toFixed(2)}㎡`;
}

export function getMinimumPointCount(mode: DrawMode): number {
  switch (mode) {
    case 'polygon':
      return 3;
    case 'line':
    case 'rectangle':
    case 'circle':
      return 2;
    default:
      return 1;
  }
}