import type { Entity, Viewer } from 'cesium';
export declare class DrawEntityRegistry {
    private readonly groups;
    bindAuxiliary(primary: Entity, auxiliary: Entity[]): void;
    getAuxiliary(primary: Entity): Entity[];
    removeGroup(viewer: Viewer, primary: Entity): Entity[];
    clear(viewer: Viewer, entities: Entity[], auxiliaryEntities: Entity[]): void;
}
