import * as Cesium from 'cesium';
import type { Cartesian3, Entity, Viewer } from 'cesium';
import type { I18nLike } from '../../../../i18n';

import { calculateDistance, formatArea, formatDistance } from '../geometry/drawGeometry';
import { isValidCartesian3, toCartographic } from '../geometry/drawPosition';
import { createRoundedLabelCanvas } from './measurementCanvas';
import type {
  ResolvedMeasurementLabelStyle,
  ResolvedMeasurementTheme,
} from '../types/drawTypes';

export interface MeasurementLabelFactoryOptions {
  i18n?: I18nLike;
  useI18n?: boolean;
}

export class MeasurementLabelFactory {
  private readonly i18n?: I18nLike;

  private readonly useI18n: boolean;

  constructor(private readonly viewer: Viewer, options: MeasurementLabelFactoryOptions = {}) {
    this.i18n = options.i18n;
    this.useI18n = options.useI18n ?? true;
  }

  private t(key: string, params: Record<string, unknown>, fallback: string): string {
    if (!this.useI18n || !this.i18n) {
      return fallback;
    }

    const value = this.i18n.t(key, params);
    return !value || value === key ? fallback : value;
  }

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
      const formattedDistance = formatDistance(totalDistance);
      entities.push(this.createMeasurementBillboardEntity(
        targetPosition,
        this.t('draw.measurement.total_distance', { value: formattedDistance }, `总长：${formattedDistance}`),
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

    const formattedArea = formatArea(area);

    if (variant === 'preview') {
      return this.createMeasurementBillboardEntity(
        center,
        this.t('draw.measurement.preview_area', { value: formattedArea }, `面积：${formattedArea}`),
        theme.previewAreaLabel,
      );
    }

    return this.createMeasurementBillboardEntity(
      center,
      this.t('draw.measurement.total_area', { value: formattedArea }, `总面积：${formattedArea}`),
      theme.totalAreaLabel,
    );
  }
}