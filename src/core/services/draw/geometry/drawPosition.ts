import * as Cesium from 'cesium';
import type { Cartesian3 } from 'cesium';

export function isValidCartesian3(position: Cartesian3 | null | undefined): position is Cartesian3 {
  if (!position) {
    return false;
  }

  return Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z);
}

export function sanitizePositions(positions: Cartesian3[]): Cartesian3[] {
  return positions.filter(isValidCartesian3).map((position) => position.clone());
}

export function toCartographic(position: Cartesian3): Cesium.Cartographic | null {
  if (!isValidCartesian3(position)) {
    return null;
  }

  try {
    const cartographic = Cesium.Cartographic.fromCartesian(position);
    if (
      !Number.isFinite(cartographic.longitude)
      || !Number.isFinite(cartographic.latitude)
      || !Number.isFinite(cartographic.height)
    ) {
      return null;
    }

    return cartographic;
  } catch {
    return null;
  }
}

export function clonePositions(positions: Cartesian3[]): Cartesian3[] {
  return positions.map((position) => position.clone());
}