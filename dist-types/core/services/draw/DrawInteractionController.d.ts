import * as Cesium from 'cesium';
import type { Cartesian3, Viewer } from 'cesium';
export declare class DrawInteractionController {
    private readonly viewer;
    private screenSpaceEventHandler;
    constructor(viewer: Viewer);
    activate(handlers: {
        onLeftClick(position: Cartesian3): void;
        onRightClick(): void;
        onMouseMove(position: Cartesian3): void;
        onDoubleClick(position: Cartesian3): void;
    }): void;
    deactivate(): void;
    pickGlobePosition(windowPosition: Cesium.Cartesian2): Cartesian3 | null;
    destroy(): void;
}
