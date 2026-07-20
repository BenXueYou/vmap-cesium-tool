import * as Cesium from 'cesium';
import type { Viewer, Entity } from 'cesium';
export interface CirclePrimitiveParts {
    outer: Entity;
    inner: Entity;
}
export declare class CirclePrimitiveBatch {
    private viewer;
    private ringCollection;
    private fillCollection;
    private ownsCollections;
    private ownedRootCollection;
    private ringPrimitive;
    private fillPrimitive;
    private records;
    private rebuildScheduled;
    private colorApplyScheduled;
    private pendingColorApplyIds;
    constructor(viewer: Viewer, options?: {
        ringCollection?: Cesium.PrimitiveCollection;
        fillCollection?: Cesium.PrimitiveCollection;
    });
    destroy(): void;
    has(circleId: string): boolean;
    upsertGeometry(args: {
        circleId: string;
        parts: CirclePrimitiveParts;
        ringPositions: Cesium.Cartesian3[];
        fillPositions: Cesium.Cartesian3[];
        ringColor: Cesium.Color;
        fillColor: Cesium.Color;
        visible: boolean;
    }): void;
    remove(circleId: string): void;
    setVisible(circleId: string, visible: boolean): void;
    setColors(circleId: string, ringColor: Cesium.Color, fillColor: Cesium.Color): void;
    private scheduleApplyColors;
    private scheduleRebuild;
    private assertCloneableInstanceId;
    private rebuild;
    private applyCurrentColors;
}
