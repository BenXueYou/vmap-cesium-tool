import * as Cesium from 'cesium';
import type { Cartesian3, Entity, Viewer } from 'cesium';
import { MeasurementLabelFactory } from '../labels/measurementLabelFactory';
import type { ResolvedMeasurementTheme } from '../types/drawTypes';
export declare class DrawPreviewFactory {
    private readonly viewer;
    private readonly labelFactory;
    constructor(viewer: Viewer, labelFactory: MeasurementLabelFactory);
    createPreviewLine(positions: Cartesian3[], theme: ResolvedMeasurementTheme): Entity[];
    createPreviewPolygon(basePositions: Cartesian3[], previewPoint: Cartesian3 | undefined, theme: ResolvedMeasurementTheme): Entity[];
    createPreviewRectangle(start: Cartesian3, end: Cartesian3, theme: ResolvedMeasurementTheme): Entity[];
    createPreviewCircle(center: Cartesian3, edge: Cartesian3, theme: ResolvedMeasurementTheme): Entity[];
    createPolylineEntity(positions: Cartesian3[], color: Cesium.Color, width: number, clampToGround: boolean, closeLoop: boolean): Entity;
    createPolygonFillEntity(positions: Cartesian3[], fill: Cesium.Color, clampToGround: boolean): Entity;
    createRectangleEntity(start: Cartesian3, end: Cartesian3, theme: ResolvedMeasurementTheme): Entity;
}
