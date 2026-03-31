import * as Cesium from 'cesium';
import type { Cartesian3, Entity, Viewer } from 'cesium';

import { calculateDistance, calculatePolygonArea, generateCirclePositions, getRectangleCornerPositions } from '../geometry/drawGeometry';
import { toCartographic } from '../geometry/drawPosition';
import { MeasurementLabelFactory } from '../labels/measurementLabelFactory';
import type { DrawArtifacts, ResolvedMeasurementTheme } from '../types/drawTypes';
import { DrawPreviewFactory } from './drawPreviewFactory';

export class DrawFinalFactory {
  constructor(
    private readonly viewer: Viewer,
    private readonly labelFactory: MeasurementLabelFactory,
    private readonly previewFactory: DrawPreviewFactory,
  ) {}

  createFinalLine(positions: Cartesian3[], theme: ResolvedMeasurementTheme): DrawArtifacts {
    const primary = this.viewer.entities.add({
      polyline: {
        positions,
        width: theme.stroke.width,
        material: new Cesium.ColorMaterialProperty(theme.stroke.color),
        clampToGround: theme.stroke.clampToGround,
      },
    });
    const auxiliary = [
      ...this.labelFactory.createVertexMarkerEntities(positions, theme),
      ...this.labelFactory.createDistanceLabelEntities(positions, theme),
    ];
    return { primary, auxiliary };
  }

  createFinalPolygon(positions: Cartesian3[], theme: ResolvedMeasurementTheme): DrawArtifacts {
    const primary = this.previewFactory.createPolygonFillEntity(positions, theme.fill.color, theme.stroke.clampToGround);
    const auxiliary: Entity[] = [
      ...this.labelFactory.createVertexMarkerEntities(positions, theme),
      this.previewFactory.createPolylineEntity(positions, theme.stroke.color, theme.stroke.width, theme.stroke.clampToGround, true),
    ];
    const areaLabel = this.labelFactory.createAreaLabelEntity(positions, calculatePolygonArea(positions), 'final', theme);
    if (areaLabel) {
      auxiliary.push(areaLabel);
    }
    return { primary, auxiliary };
  }

  createFinalRectangle(positions: Cartesian3[], theme: ResolvedMeasurementTheme): DrawArtifacts | null {
    if (positions.length < 2) {
      return null;
    }

    const corners = getRectangleCornerPositions(positions[0], positions[1]);
    if (corners.length < 4) {
      return null;
    }

    const primary = this.previewFactory.createPolygonFillEntity(corners, theme.fill.color, theme.stroke.clampToGround);
    const auxiliary: Entity[] = [
      this.previewFactory.createPolylineEntity(corners, theme.stroke.color, theme.stroke.width, theme.stroke.clampToGround, true),
    ];
    const areaLabel = this.labelFactory.createAreaLabelEntity(corners, calculatePolygonArea(corners), 'final', theme);
    if (areaLabel) {
      auxiliary.push(areaLabel);
    }

    return { primary, auxiliary };
  }

  createFinalCircle(positions: Cartesian3[], theme: ResolvedMeasurementTheme): DrawArtifacts | null {
    if (positions.length < 2) {
      return null;
    }

    const centerCarto = toCartographic(positions[0]);
    const edgeCarto = toCartographic(positions[1]);
    if (!centerCarto || !edgeCarto) {
      return null;
    }

    const radius = calculateDistance(centerCarto, edgeCarto);
    if (!Number.isFinite(radius) || radius <= 0) {
      return null;
    }

    const heightReference = theme.stroke.clampToGround
      ? Cesium.HeightReference.RELATIVE_TO_GROUND
      : Cesium.HeightReference.NONE;
    const primary = this.viewer.entities.add({
      position: positions[0],
      ellipse: {
        semiMajorAxis: radius,
        semiMinorAxis: radius,
        material: theme.fill.color,
        outline: false,
        heightReference,
        height: theme.stroke.clampToGround ? 0.1 : (centerCarto.height ?? 0),
      },
    });

    const auxiliary: Entity[] = [];
    const areaLabel = this.labelFactory.createAreaLabelEntity(
      generateCirclePositions(centerCarto, radius),
      Math.PI * radius * radius,
      'final',
      theme,
    );
    if (areaLabel) {
      auxiliary.push(areaLabel);
    }

    return { primary, auxiliary };
  }
}