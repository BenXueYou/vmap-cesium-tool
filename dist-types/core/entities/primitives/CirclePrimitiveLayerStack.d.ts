import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';
export interface CirclePrimitiveLayerCollections {
    fillCollection: Cesium.PrimitiveCollection;
    ringCollection: Cesium.PrimitiveCollection;
}
export declare class CirclePrimitiveLayerStack {
    private viewer;
    private fillsRoot;
    private ringsRoot;
    private layers;
    constructor(viewer: Viewer);
    getLayerCollections(layerKey: string): CirclePrimitiveLayerCollections;
    destroy(): void;
}
