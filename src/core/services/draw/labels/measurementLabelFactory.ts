import * as Cesium from 'cesium';
import type { Cartesian3, Entity, Viewer } from 'cesium';

import { calculateDistance, formatArea, formatDistance } from '../geometry/drawGeometry';
import { isValidCartesian3, toCartographic } from '../geometry/drawPosition';
import { createRoundedLabelCanvas } from './measurementCanvas';
import type {
  ResolvedMeasurementLabelStyle,
  ResolvedMeasurementTheme,
} from '../types/drawTypes';

export class MeasurementLabelFactory {
  constructor(private readonly viewer: Viewer) {}

  createVertexMarkerEntities(positions: Cartesian3[], theme: ResolvedMeasurementTheme): Entity[] {
    return positions
      .filter(isValidCartesian3)
      .map((position) => this.viewer.entities.add({
        position,
        point: {
          pixelSize: theme.vertex.pixelSize,
          color: theme.vertex.color,
          outlineColor: theme.vertex.outlineColor,
          outlineWidth: theme.vertex.outlineWidth,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      }));
  }

  createMeasurementBillboardEntity(
    position: Cartesian3,
    text: string,
    style: ResolvedMeasurementLabelStyle,
  ): Entity {
    return this.viewer.entities.add({
      position,
      billboard: {
        image: createRoundedLabelCanvas(text, {
          font: style.font,
          textColor: style.textColor,
          backgroundColor: style.backgroundColor,
          borderRadius: style.borderRadius,
        }),
        pixelOffset: style.pixelOffset,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  }

  createDistanceLabelEntities(positions: Cartesian3[], theme: ResolvedMeasurementTheme): Entity[] {
    if (positions.length < 2) {
      return [];
    }

    const entities: Entity[] = [];
    let totalDistance = 0;

    for (let index = 1; index < positions.length; index += 1) {
      const start = toCartographic(positions[index - 1]);
      const end = toCartographic(positions[index]);
      if (!start || !end) {
        continue;
      }

      const segmentDistance = calculateDistance(start, end);
      if (!Number.isFinite(segmentDistance) || segmentDistance <= 0) {
        continue;
      }

      totalDistance += segmentDistance;
      const midpoint = Cesium.Cartesian3.midpoint(positions[index - 1], positions[index], new Cesium.Cartesian3());
      if (isValidCartesian3(midpoint)) {
        entities.push(this.createMeasurementBillboardEntity(
          midpoint,
          formatDistance(segmentDistance),
          theme.segmentDistanceLabel,
        ));
      }
    }

    const targetPosition = positions[positions.length - 1];
    if (isValidCartesian3(targetPosition) && Number.isFinite(totalDistance) && totalDistance > 0) {
      entities.push(this.createMeasurementBillboardEntity(
        targetPosition,
        `总长：${formatDistance(totalDistance)}`,
        theme.totalDistanceLabel,
      ));
    }

    return entities;
  }

  createAreaLabelEntity(
    positions: Cartesian3[],
    area: number,
    variant: 'preview' | 'final',
    theme: ResolvedMeasurementTheme,
  ): Entity | null {
    if (positions.length < 3 || !Number.isFinite(area) || area <= 0) {
      return null;
    }

    const center = Cesium.BoundingSphere.fromPoints(positions).center;
    if (!isValidCartesian3(center)) {
      return null;
    }

    if (variant === 'preview') {
      return this.createMeasurementBillboardEntity(center, `面积：${formatArea(area)}`, theme.previewAreaLabel);
    }

    return this.createMeasurementBillboardEntity(center, `总面积：${formatArea(area)}`, theme.totalAreaLabel);
  }
}