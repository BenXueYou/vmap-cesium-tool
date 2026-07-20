import type { Cartesian3 } from "cesium";
export type IntersectionKind = "none" | "touch" | "cross" | "overlap";
/**
 * Returns true if adding `nextPoint` to an open polygon polyline would create a self-intersection.
 */
export declare function wouldCreatePolygonSelfIntersection(existingPoints: Cartesian3[], nextPoint: Cartesian3, opts?: {
    allowTouch?: boolean;
}): boolean;
export declare function wouldCreatePolygonSelfIntersectionKind(existingPoints: Cartesian3[], nextPoint: Cartesian3): IntersectionKind;
/**
 * Returns true if the closed polygon described by `points` is self-intersecting.
 */
export declare function isClosedPolygonSelfIntersecting(points: Cartesian3[], opts?: {
    allowTouch?: boolean;
}): boolean;
