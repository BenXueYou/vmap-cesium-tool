import * as Cesium from 'cesium';
import type { Cartesian3, Entity, Viewer } from 'cesium';

import {
  calculateDistance,
  calculatePolygonArea,
  calculateRectangleArea,
  generateCirclePositions,
  getRectangleCornerPositions,
} from '../geometry/drawGeometry';
import { toCartographic } from '../geometry/drawPosition';
import { MeasurementLabelFactory } from '../labels/measurementLabelFactory';
import type { ResolvedMeasurementTheme } from '../types/drawTypes';

const MIN_DISTINCT_VERTEX_DISTANCE_METERS = 0.001;
const MIN_DISTINCT_VERTEX_DISTANCE_SQUARED = MIN_DISTINCT_VERTEX_DISTANCE_METERS ** 2;
const MIN_POLYGON_AREA_SQUARE_METERS = 1e-6;

function hasEnoughDistinctPolygonVertices(positions: Cartesian3[]): boolean {
  const distinctPositions: Cartesian3[] = [];

  for (const position of positions) {
    const isDuplicate = distinctPositions.some((candidate) => (
      Cesium.Cartesian3.distanceSquared(candidate, position) <= MIN_DISTINCT_VERTEX_DISTANCE_SQUARED
    ));
    if (!isDuplicate) {
      distinctPositions.push(position);
      if (distinctPositions.length >= 3) {
        return true;
      }
    }
  }

  return false;
}

function getRenderablePolygonArea(positions: Cartesian3[]): number | null {
  if (!hasEnoughDistinctPolygonVertices(positions)) {
    return null;
  }

  try {
    const area = calculatePolygonArea(positions);
    return Number.isFinite(area) && area > MIN_POLYGON_AREA_SQUARE_METERS ? area : null;
  } catch {
    return null;
  }
}

export class DrawPreviewFactory {
  constructor(
    private readonly viewer: Viewer,
    private readonly labelFactory: MeasurementLabelFactory,
  ) {}

  createPreviewLine(positions: Cartesian3[], theme: ResolvedMeasurementTheme): Entity[] {
    if (positions.length < 2) {
      return [];
    }

    return [
      this.createPolylineEntity(positions, theme.stroke.color, theme.stroke.width, theme.stroke.clampToGround, false),
      ...this.labelFactory.createDistanceLabelEntities(positions, theme),
    ];
  }

  createPreviewPolygon(
    basePositions: Cartesian3[],
    previewPoint: Cartesian3 | undefined,
    theme: ResolvedMeasurementTheme,
  ): Entity[] {
    const entities: Entity[] = [];
    const allPositions = previewPoint ? [...basePositions, previewPoint] : basePositions;

    if (allPositions.length >= 2) {
      entities.push(this.createPolylineEntity(allPositions, theme.stroke.color, theme.stroke.width, theme.stroke.clampToGround, false));
    }

    if (allPositions.length < 3) {
      return entities;
    }

    const area = getRenderablePolygonArea(allPositions);
    if (area === null) {
      return entities;
    }

    entities.push(this.createPolygonFillEntity(allPositions, theme.fill.color, theme.stroke.clampToGround));
    entities.push(this.createPolylineEntity(allPositions, theme.stroke.color, theme.stroke.width, theme.stroke.clampToGround, true));

    const areaLabel = this.labelFactory.createAreaLabelEntity(
      allPositions,
      area,
      'preview',
      theme,
    );
    if (areaLabel) {
      entities.push(areaLabel);
    }

    return entities;
  }

  createPreviewRectangle(start: Cartesian3, end: Cartesian3, theme: ResolvedMeasurementTheme): Entity[] {
    const corners = getRectangleCornerPositions(start, end);
    if (corners.length < 4) {
      return [];
    }
    const area = calculateRectangleArea(corners);
    if (!Number.isFinite(area) || area <= 0) {
      return [];
    }

    const entities = [
      this.createRectangleEntity(start, end, theme),
    ];
    const areaLabel = this.labelFactory.createAreaLabelEntity(corners, area, 'preview', theme);
    if (areaLabel) {
      entities.push(areaLabel);
    }

    return entities;
  }

  createPreviewCircle(center: Cartesian3, edge: Cartesian3, theme: ResolvedMeasurementTheme): Entity[] {
    const centerCarto = toCartographic(center);
    const edgeCarto = toCartographic(edge);
    if (!centerCarto || !edgeCarto) {
      return [];
    }

    const radius = calculateDistance(centerCarto, edgeCarto);
    if (!Number.isFinite(radius) || radius <= 0) {
      return [];
    }

    const heightReference = theme.stroke.clampToGround
      ? Cesium.HeightReference.RELATIVE_TO_GROUND
      : Cesium.HeightReference.NONE;
    const entities: Entity[] = [this.viewer.entities.add({
      position: center,
      ellipse: {
        semiMajorAxis: radius,
        semiMinorAxis: radius,
        material: theme.fill.color,
        outline: false,
        heightReference,
        height: theme.stroke.clampToGround ? 0.1 : (centerCarto.height ?? 0),
      },
    })];

    const areaLabel = this.labelFactory.createAreaLabelEntity(
      generateCirclePositions(centerCarto, radius),
      Math.PI * radius * radius,
      'preview',
      theme,
    );
    if (areaLabel) {
      entities.push(areaLabel);
    }

    return entities;
  }

  createPolylineEntity(
    positions: Cartesian3[],
    color: Cesium.Color,
    width: number,
    clampToGround: boolean,
    closeLoop: boolean,
  ): Entity {
    const linePositions = positions.map((position) => position.clone());
    if (closeLoop && linePositions.length >= 2) {
      linePositions.push(linePositions[0].clone());
    }

    return this.viewer.entities.add({
      polyline: {
        positions: linePositions,
        width,
        material: new Cesium.ColorMaterialProperty(color),
        clampToGround,
      },
    });
  }

  createPolygonFillEntity(positions: Cartesian3[], fill: Cesium.Color, clampToGround: boolean): Entity {
    return this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: fill,
        outline: false,
        heightReference: clampToGround ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.NONE,
        ...(clampToGround ? { height: 0.1 } : {}),
      },
    });
  }

  createRectangleEntity(start: Cartesian3, end: Cartesian3, theme: ResolvedMeasurementTheme): Entity {
    const startCarto = toCartographic(start);
    const endCarto = toCartographic(end);
    if (!startCarto || !endCarto) {
      return this.viewer.entities.add({
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(0, 0, 0, 0),
          outline: true,
        },
      });
    }

    const rectangle = new Cesium.Rectangle(
      Math.min(startCarto.longitude, endCarto.longitude),
      Math.min(startCarto.latitude, endCarto.latitude),
      Math.max(startCarto.longitude, endCarto.longitude),
      Math.max(startCarto.latitude, endCarto.latitude),
    );

    return this.viewer.entities.add({
      rectangle: {
        coordinates: rectangle,
        material: theme.fill.color,
        outline: true,
        outlineColor: theme.stroke.color,
        outlineWidth: theme.stroke.width,
        heightReference: theme.stroke.clampToGround
          ? Cesium.HeightReference.RELATIVE_TO_GROUND
          : Cesium.HeightReference.NONE,
        ...(theme.stroke.clampToGround ? { height: 0.1 } : {}),
      },
    });
  }
}
