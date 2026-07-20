import * as Cesium from 'cesium';
import type { Viewer, Entity } from 'cesium';
export interface PolygonPrimitiveParts {
    fill: Entity;
    border: Entity;
}
export declare class PolygonPrimitiveBatch {
    private readonly viewer;
    private readonly fillCollection;
    private readonly borderCollection;
    private readonly ownsCollections;
    private ownedRootCollection;
    private fillPrimitive;
    private borderPrimitive;
    private readonly records;
    private rebuildScheduled;
    private colorApplyScheduled;
    private readonly pendingColorApplyIds;
    constructor(viewer: Viewer, options?: {
        fillCollection?: Cesium.PrimitiveCollection;
        borderCollection?: Cesium.PrimitiveCollection;
    });
    upsertGeometry(args: {
        polygonId: string;
        parts: PolygonPrimitiveParts;
        fillPositions: Cesium.Cartesian3[];
        borderPositions: Cesium.Cartesian3[];
        borderWidth: number;
        fillColor: Cesium.Color;
        borderColor: Cesium.Color;
        visible: boolean;
    }): void;
    remove(polygonId: string): void;
    setVisible(polygonId: string, visible: boolean): void;
    setColors(polygonId: string, borderColor: Cesium.Color, fillColor: Cesium.Color): void;
    setBorderWidth(polygonId: string, borderWidth: number): void;
    destroy(): void;
    private scheduleApplyColors;
    private scheduleRebuild;
    private assertCloneableInstanceId;
    private rebuild;
    private applyCurrentColors;
}
