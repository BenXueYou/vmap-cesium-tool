import * as Cesium from 'cesium';
import type { Cartesian3 } from 'cesium';
export declare function isValidCartesian3(position: Cartesian3 | null | undefined): position is Cartesian3;
export declare function sanitizePositions(positions: Cartesian3[]): Cartesian3[];
export declare function toCartographic(position: Cartesian3): Cesium.Cartographic | null;
export declare function clonePositions(positions: Cartesian3[]): Cartesian3[];
