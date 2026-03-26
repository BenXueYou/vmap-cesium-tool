import type { Cartesian3, Viewer } from 'cesium';

import { MeasurementLabelFactory } from '../labels/measurementLabelFactory';
import type { DrawArtifacts, DrawMode, ResolvedMeasurementTheme } from '../types/drawTypes';
import { DrawFinalFactory } from './drawFinalFactory';
import { DrawPreviewFactory } from './drawPreviewFactory';

export class DrawEntityFactory {
  private readonly previewFactory: DrawPreviewFactory;
  private readonly finalFactory: DrawFinalFactory;

  constructor(viewer: Viewer, labelFactory: MeasurementLabelFactory) {
    this.previewFactory = new DrawPreviewFactory(viewer, labelFactory);
    this.finalFactory = new DrawFinalFactory(viewer, labelFactory, this.previewFactory);
  }

  createPreview(
    mode: DrawMode,
    positions: Cartesian3[],
    previewPoint: Cartesian3 | undefined,
    theme: ResolvedMeasurementTheme,
  ) {
    switch (mode) {
      case 'line':
        return this.previewFactory.createPreviewLine(previewPoint ? [...positions, previewPoint] : positions, theme);
      case 'polygon':
        return this.previewFactory.createPreviewPolygon(positions, previewPoint, theme);
      case 'rectangle':
        if (positions.length === 0 || !previewPoint) {
          return [];
        }
        return this.previewFactory.createPreviewRectangle(positions[0], previewPoint, theme);
      case 'circle':
        if (positions.length === 0 || !previewPoint) {
          return [];
        }
        return this.previewFactory.createPreviewCircle(positions[0], previewPoint, theme);
      default:
        return [];
    }
  }

  createFinal(mode: DrawMode, positions: Cartesian3[], theme: ResolvedMeasurementTheme): DrawArtifacts | null {
    switch (mode) {
      case 'line':
        return this.finalFactory.createFinalLine(positions, theme);
      case 'polygon':
        return this.finalFactory.createFinalPolygon(positions, theme);
      case 'rectangle':
        return this.finalFactory.createFinalRectangle(positions, theme);
      case 'circle':
        return this.finalFactory.createFinalCircle(positions, theme);
      default:
        return null;
    }
  }
}