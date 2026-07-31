import * as Cesium from 'cesium';
import { cartesianToLngLat } from '../../mapProviders/coordinates/cesium';
import type { CoordSystem } from '../../mapProviders/coordinates/types';
import {
  calculatePolygonArea,
  calculateRectangleArea,
  calculateTotalDistance,
} from '../draw/geometry/drawGeometry';
import type { MarkDrawResult, MarkEntityMetadata, MarkExportItem } from './markTypes';

function getControlPoints(entity: Cesium.Entity): Cesium.Cartesian3[] {
  const metadata = (entity as Cesium.Entity & { _markMeta?: MarkEntityMetadata })._markMeta;
  return metadata?.controlPoints?.map((point) => point.clone()) || [];
}

export function buildMarkDrawResult(entity: Cesium.Entity, outputCoordSystem: CoordSystem = 'WGS84'): MarkDrawResult | null {
  const metadata = (entity as Cesium.Entity & { _markMeta?: MarkEntityMetadata })._markMeta;
  if (!metadata) {
    return null;
  }

  const controlPoints = getControlPoints(entity);
  const cartesian3Positions = resolveCartesionPositions(metadata.type, controlPoints);
  const positions = cartesian3Positions.map((point) => cartesianToLngLat(point, outputCoordSystem));
  const position = resolveRepresentativePosition(metadata.type, cartesian3Positions, outputCoordSystem);
  const radius = metadata.type === 'circle'
    ? (metadata.radius ?? resolveCircleRadius(controlPoints))
    : metadata.radius;

  return {
    id: String(entity.id),
    type: metadata.type,
    entity,
    position,
    positions,
    cartesian3Positions,
    length: metadata.type === 'polyline' ? calculateTotalDistance(cartesian3Positions) : undefined,
    area: resolveArea(metadata.type, cartesian3Positions, radius),
    radius,
    color: metadata.color,
    outputCoordSystem,
    kind: metadata.kind,
  };
}

export function exportMarkEntity(entity: Cesium.Entity, outputCoordSystem: CoordSystem = 'WGS84'): MarkExportItem | null {
  const result = buildMarkDrawResult(entity, outputCoordSystem);
  if (!result) {
    return null;
  }

  return {
    id: result.id,
    type: result.type,
    position: result.position,
    positions: result.positions,
    cartesian3Positions: result.cartesian3Positions,
    length: result.length,
    area: result.area,
    radius: result.radius,
    color: result.color,
    kind: result.kind,
  };
}

function resolveCartesionPositions(type: MarkEntityMetadata['type'], controlPoints: Cesium.Cartesian3[]): Cesium.Cartesian3[] {
  if (type === 'rectangle' && controlPoints.length >= 2) {
    return resolveRectanglePositions(controlPoints);
  }

  if (type === 'circle' && controlPoints.length >= 2) {
    return controlPoints.slice(0, 2).map((point) => point.clone());
  }

  return controlPoints.map((point) => point.clone());
}

function resolveRectanglePositions(controlPoints: Cesium.Cartesian3[]): Cesium.Cartesian3[] {
  const cartographics = controlPoints
    .map((point) => Cesium.Cartographic.fromCartesian(point))
    .filter((item): item is Cesium.Cartographic => !!item);
  if (cartographics.length < 2) {
    return controlPoints.map((point) => point.clone());
  }

  const west = Math.min(...cartographics.map((item) => item.longitude));
  const east = Math.max(...cartographics.map((item) => item.longitude));
  const south = Math.min(...cartographics.map((item) => item.latitude));
  const north = Math.max(...cartographics.map((item) => item.latitude));
  const height = cartographics[0]?.height ?? 0;

  return [
    Cesium.Cartesian3.fromRadians(west, south, height),
    Cesium.Cartesian3.fromRadians(east, south, height),
    Cesium.Cartesian3.fromRadians(east, north, height),
    Cesium.Cartesian3.fromRadians(west, north, height),
  ];
}

function resolveRepresentativePosition(
  type: MarkEntityMetadata['type'],
  cartesian3Positions: Cesium.Cartesian3[],
  outputCoordSystem: CoordSystem,
): MarkDrawResult['position'] {
  if (cartesian3Positions.length === 0) {
    return undefined;
  }

  if (type === 'rectangle' && cartesian3Positions.length >= 4) {
    const center = Cesium.BoundingSphere.fromPoints(cartesian3Positions).center;
    return cartesianToLngLat(center, outputCoordSystem);
  }

  if (type === 'circle' || type === 'point') {
    return cartesianToLngLat(cartesian3Positions[0], outputCoordSystem);
  }

  return cartesianToLngLat(cartesian3Positions[0], outputCoordSystem);
}

function resolveArea(
  type: MarkEntityMetadata['type'],
  cartesian3Positions: Cesium.Cartesian3[],
  radius?: number,
): number | undefined {
  if (type === 'polygon' && cartesian3Positions.length >= 3) {
    return calculatePolygonArea(cartesian3Positions);
  }

  if (type === 'rectangle' && cartesian3Positions.length >= 4) {
    return calculateRectangleArea(cartesian3Positions);
  }

  if (type === 'circle' && radius && Number.isFinite(radius) && radius > 0) {
    return Math.PI * radius * radius;
  }

  return undefined;
}

function resolveCircleRadius(controlPoints: Cesium.Cartesian3[]): number | undefined {
  if (controlPoints.length < 2) {
    return undefined;
  }

  const center = Cesium.Cartographic.fromCartesian(controlPoints[0]);
  const edge = Cesium.Cartographic.fromCartesian(controlPoints[1]);
  if (!center || !edge) {
    return undefined;
  }

  const earthRadius = 6378137.0;
  const deltaLatitude = edge.latitude - center.latitude;
  const deltaLongitude = edge.longitude - center.longitude;
  const a = Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2)
    + Math.cos(center.latitude) * Math.cos(edge.latitude)
    * Math.sin(deltaLongitude / 2) * Math.sin(deltaLongitude / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const radius = earthRadius * c;
  return Number.isFinite(radius) && radius > 0 ? radius : undefined;
}
