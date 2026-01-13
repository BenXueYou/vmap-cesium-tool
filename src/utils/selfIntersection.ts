import * as Cesium from "cesium";
import type { Cartesian3 } from "cesium";

type Vec2 = { x: number; y: number };

type IntersectionKind = "none" | "touch" | "cross" | "overlap";

const DEFAULT_EPS = 1e-9;

function toLocal2D(points: Cartesian3[]): Vec2[] {
  // Use a stable local tangent plane (ENU) to do robust 2D segment checks.
  const center = Cesium.BoundingSphere.fromPoints(points).center;
  const enu = Cesium.Transforms.eastNorthUpToFixedFrame(center);
  const inv = Cesium.Matrix4.inverseTransformation(enu, new Cesium.Matrix4());

  return points.map((p) => {
    const local = Cesium.Matrix4.multiplyByPoint(inv, p, new Cesium.Cartesian3());
    return { x: local.x, y: local.y };
  });
}

function cross(a: Vec2, b: Vec2, c: Vec2): number {
  // (b-a) x (c-a)
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function dot(a: Vec2, b: Vec2, c: Vec2): number {
  // (b-a) · (c-a)
  return (b.x - a.x) * (c.x - a.x) + (b.y - a.y) * (c.y - a.y);
}

function nearlyZero(v: number, eps: number): boolean {
  return Math.abs(v) <= eps;
}

function inRange(v: number, a: number, b: number, eps: number): boolean {
  return v >= Math.min(a, b) - eps && v <= Math.max(a, b) + eps;
}

function pointOnSegment(p: Vec2, a: Vec2, b: Vec2, eps: number): boolean {
  if (!nearlyZero(cross(a, b, p), eps)) return false;
  return inRange(p.x, a.x, b.x, eps) && inRange(p.y, a.y, b.y, eps);
}

function bboxOverlap(a: Vec2, b: Vec2, c: Vec2, d: Vec2, eps: number): boolean {
  const minAx = Math.min(a.x, b.x);
  const maxAx = Math.max(a.x, b.x);
  const minAy = Math.min(a.y, b.y);
  const maxAy = Math.max(a.y, b.y);

  const minCx = Math.min(c.x, d.x);
  const maxCx = Math.max(c.x, d.x);
  const minCy = Math.min(c.y, d.y);
  const maxCy = Math.max(c.y, d.y);

  return !(maxAx < minCx - eps || maxCx < minAx - eps || maxAy < minCy - eps || maxCy < minAy - eps);
}

function segmentIntersectionKind(a: Vec2, b: Vec2, c: Vec2, d: Vec2, eps = DEFAULT_EPS): IntersectionKind {
  if (!bboxOverlap(a, b, c, d, eps)) return "none";

  const ab_c = cross(a, b, c);
  const ab_d = cross(a, b, d);
  const cd_a = cross(c, d, a);
  const cd_b = cross(c, d, b);

  const ab_c0 = nearlyZero(ab_c, eps);
  const ab_d0 = nearlyZero(ab_d, eps);
  const cd_a0 = nearlyZero(cd_a, eps);
  const cd_b0 = nearlyZero(cd_b, eps);

  // Collinear case
  if (ab_c0 && ab_d0 && cd_a0 && cd_b0) {
    // Determine whether they overlap more than a single point.
    // Use projection on the dominant axis.
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    const useX = dx >= dy;

    const a1 = useX ? a.x : a.y;
    const b1 = useX ? b.x : b.y;
    const c1 = useX ? c.x : c.y;
    const d1 = useX ? d.x : d.y;

    const min1 = Math.min(a1, b1);
    const max1 = Math.max(a1, b1);
    const min2 = Math.min(c1, d1);
    const max2 = Math.max(c1, d1);

    const overlapMin = Math.max(min1, min2);
    const overlapMax = Math.min(max1, max2);

    if (overlapMax < overlapMin - eps) return "none";

    // If overlap length is effectively 0 => touching at a point
    if (Math.abs(overlapMax - overlapMin) <= eps) return "touch";

    return "overlap";
  }

  // General intersection test
  const abStraddle = (ab_c > eps && ab_d < -eps) || (ab_c < -eps && ab_d > eps);
  const cdStraddle = (cd_a > eps && cd_b < -eps) || (cd_a < -eps && cd_b > eps);

  if (abStraddle && cdStraddle) return "cross";

  // Touching cases: endpoint lies on the other segment
  if (ab_c0 && pointOnSegment(c, a, b, eps)) return "touch";
  if (ab_d0 && pointOnSegment(d, a, b, eps)) return "touch";
  if (cd_a0 && pointOnSegment(a, c, d, eps)) return "touch";
  if (cd_b0 && pointOnSegment(b, c, d, eps)) return "touch";

  return "none";
}

function isSelfIntersectionBlocking(kind: IntersectionKind, allowTouch: boolean): boolean {
  if (kind === "none") return false;
  if (kind === "overlap") return true;
  if (kind === "cross") return true;
  if (kind === "touch") return !allowTouch;
  return true;
}

function openPolylineWouldSelfIntersect2D(points: Vec2[], allowTouch: boolean): boolean {
  // points represent the polyline vertices in order.
  // Check whether the newest segment (n-2 -> n-1) intersects any earlier non-adjacent segment.
  const n = points.length;
  if (n < 4) return false;

  const a = points[n - 2];
  const b = points[n - 1];

  for (let i = 0; i <= n - 4; i++) {
    const c = points[i];
    const d = points[i + 1];

    const kind = segmentIntersectionKind(a, b, c, d);
    if (isSelfIntersectionBlocking(kind, allowTouch)) return true;
  }

  return false;
}

function closedPolygonIsSelfIntersecting2D(points: Vec2[], allowTouch: boolean): boolean {
  // points are polygon vertices in order (not repeating first at end)
  const n = points.length;
  if (n < 4) return false;

  // Build edges (i -> i+1), plus closing edge (n-1 -> 0)
  const edges: Array<{ a: Vec2; b: Vec2; i: number; j: number }> = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    edges.push({ a: points[i], b: points[j], i, j });
  }

  for (let e1 = 0; e1 < edges.length; e1++) {
    for (let e2 = e1 + 1; e2 < edges.length; e2++) {
      const s1 = edges[e1];
      const s2 = edges[e2];

      // Skip adjacent edges sharing a vertex (they always meet at endpoints)
      const shareVertex =
        s1.i === s2.i ||
        s1.i === s2.j ||
        s1.j === s2.i ||
        s1.j === s2.j;
      if (shareVertex) continue;

      const kind = segmentIntersectionKind(s1.a, s1.b, s2.a, s2.b);
      if (isSelfIntersectionBlocking(kind, allowTouch)) return true;
    }
  }

  return false;
}

/**
 * Returns true if adding `nextPoint` to an open polygon polyline would create a self-intersection.
 */
export function wouldCreatePolygonSelfIntersection(
  existingPoints: Cartesian3[],
  nextPoint: Cartesian3,
  opts?: { allowTouch?: boolean }
): boolean {
  const allowTouch = !!opts?.allowTouch;
  const points = [...existingPoints, nextPoint];
  if (points.length < 4) return false;
  const pts2d = toLocal2D(points);
  return openPolylineWouldSelfIntersect2D(pts2d, allowTouch);
}

/**
 * Returns true if the closed polygon described by `points` is self-intersecting.
 */
export function isClosedPolygonSelfIntersecting(
  points: Cartesian3[],
  opts?: { allowTouch?: boolean }
): boolean {
  const allowTouch = !!opts?.allowTouch;
  if (points.length < 4) return false;
  const pts2d = toLocal2D(points);
  return closedPolygonIsSelfIntersecting2D(pts2d, allowTouch);
}
