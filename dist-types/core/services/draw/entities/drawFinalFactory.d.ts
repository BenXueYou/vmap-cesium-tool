import type { Cartesian3, Viewer } from 'cesium';
import { MeasurementLabelFactory } from '../labels/measurementLabelFactory';
import type { DrawArtifacts, ResolvedMeasurementTheme } from '../types/drawTypes';
import { DrawPreviewFactory } from './drawPreviewFactory';
export declare class DrawFinalFactory {
    private readonly viewer;
    private readonly labelFactory;
    private readonly previewFactory;
    constructor(viewer: Viewer, labelFactory: MeasurementLabelFactory, previewFactory: DrawPreviewFactory);
    createFinalLine(positions: Cartesian3[], theme: ResolvedMeasurementTheme): DrawArtifacts;
    createFinalPolygon(positions: Cartesian3[], theme: ResolvedMeasurementTheme): DrawArtifacts;
    createFinalRectangle(positions: Cartesian3[], theme: ResolvedMeasurementTheme): DrawArtifacts | null;
    createFinalCircle(positions: Cartesian3[], theme: ResolvedMeasurementTheme): DrawArtifacts | null;
}
