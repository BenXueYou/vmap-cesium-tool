import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';
export interface PolygonPrimitiveLayerCollections {
    fillCollection: Cesium.PrimitiveCollection;
    borderCollection: Cesium.PrimitiveCollection;
}
export declare class PolygonPrimitiveLayerStack {
    private readonly viewer;
    private readonly fillsRoot;
    private readonly bordersRoot;
    private readonly layers;
    constructor(viewer: Viewer);
    getLayerCollections(layerKey: string): PolygonPrimitiveLayerCollections;
    destroy(): void;
}
