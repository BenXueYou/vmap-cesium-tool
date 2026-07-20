import type { Cartesian3, Viewer } from 'cesium';
import { MeasurementLabelFactory } from '../labels/measurementLabelFactory';
import type { DrawArtifacts, DrawMode, ResolvedMeasurementTheme } from '../types/drawTypes';
export declare class DrawEntityFactory {
    private readonly previewFactory;
    private readonly finalFactory;
    constructor(viewer: Viewer, labelFactory: MeasurementLabelFactory);
    createPreview(mode: DrawMode, positions: Cartesian3[], previewPoint: Cartesian3 | undefined, theme: ResolvedMeasurementTheme): import("cesium").Entity[];
    createFinal(mode: DrawMode, positions: Cartesian3[], theme: ResolvedMeasurementTheme): DrawArtifacts | null;
}
