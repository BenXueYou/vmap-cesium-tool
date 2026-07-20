import * as Cesium from 'cesium';
import type { Cartesian3, Entity, Viewer } from 'cesium';
import type { DrawMode, ResolvedMeasurementLabelStyle } from '../types/drawTypes';
export interface DrawHintTextOptions {
    t?: (key: string) => string;
}
export declare function buildHintText(mode: DrawMode, pointCount: number, options?: DrawHintTextOptions): string;
export declare class DrawHintController {
    private readonly viewer;
    constructor(viewer: Viewer);
    createHintBillboardGraphics(text: string, style: ResolvedMeasurementLabelStyle): Cesium.BillboardGraphics;
    createHintBubbleCanvas(text: string, style: ResolvedMeasurementLabelStyle): HTMLCanvasElement;
    show(position: Cartesian3, text: string, style: ResolvedMeasurementLabelStyle): Entity;
    update(entity: Entity, position: Cartesian3, text: string, style: ResolvedMeasurementLabelStyle): void;
    remove(entity: Entity | null): null;
}
