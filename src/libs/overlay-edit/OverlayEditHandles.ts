import * as Cesium from "cesium";

/**
 * 句柄样式（颜色/描边/像素大小）
 */
export type HandleStyle = { color: Cesium.Color; outlineColor: Cesium.Color; pixelSize: number };

/**
 * 创建编辑句柄实体
 */
export type CreateHandle = (position: Cesium.Cartesian3, style: HandleStyle, meta: any) => Cesium.Entity;

/**
 * 构建/更新句柄所需的依赖函数集合
 */
export interface HandleHelpers {
  createHandle: CreateHandle;
  computePolygonCenterCartesian: (positions: Cesium.Cartesian3[]) => Cesium.Cartesian3;
  computePolylineHandleRadius: (positions: Cesium.Cartesian3[], center: Cesium.Cartesian3) => number;
  offsetByMeters: (center: Cesium.Cartesian3, meters: number, bearingDeg: number) => Cesium.Cartesian3;
  circleRadiusHandlePosition: (center: Cesium.Cartesian3, radiusMeters: number) => Cesium.Cartesian3;
}

/**
 * 构建多边形编辑句柄（顶点/中点/整体移动）
 */
export function buildPolygonHandles(verts: Cesium.Cartesian3[], helpers: HandleHelpers): Cesium.Entity[] {
  if (!verts || verts.length < 3) return [];

  const handles: Cesium.Entity[] = [];
  const vertexStyle = { color: Cesium.Color.fromCssColorString("#1e88e5"), outlineColor: Cesium.Color.WHITE, pixelSize: 10 };
  const midStyle = { color: Cesium.Color.fromCssColorString("#ec407a"), outlineColor: Cesium.Color.WHITE, pixelSize: 8 };
  const moveStyle = { color: Cesium.Color.fromCssColorString("#43a047"), outlineColor: Cesium.Color.WHITE, pixelSize: 11 };

  for (let i = 0; i < verts.length; i++) {
    const h = helpers.createHandle(verts[i], vertexStyle, { type: "vertex", index: i });
    handles.push(h);
  }

  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const mid = Cesium.Cartesian3.midpoint(a, b, new Cesium.Cartesian3());
    const h = helpers.createHandle(mid, midStyle, { type: "mid", index: i });
    handles.push(h);
  }

  const center = helpers.computePolygonCenterCartesian(verts);
  const moveHandle = helpers.createHandle(center, moveStyle, { type: "move" });
  handles.push(moveHandle);

  return handles;
}

/**
 * 构建矩形编辑句柄（顶点/边中点/整体移动）
 */
export function buildRectangleHandles(verts: Cesium.Cartesian3[], helpers: HandleHelpers): Cesium.Entity[] {
  if (!verts || verts.length !== 4) return [];

  const handles: Cesium.Entity[] = [];
  const vertexStyle = { color: Cesium.Color.fromCssColorString("#1e88e5"), outlineColor: Cesium.Color.WHITE, pixelSize: 10 };
  const moveStyle = { color: Cesium.Color.fromCssColorString("#43a047"), outlineColor: Cesium.Color.WHITE, pixelSize: 11 };

  for (let i = 0; i < verts.length; i++) {
    const h = helpers.createHandle(verts[i], vertexStyle, { type: "vertex", index: i });
    handles.push(h);
  }

  const center = helpers.computePolygonCenterCartesian(verts);
  const moveHandle = helpers.createHandle(center, moveStyle, { type: "move" });
  handles.push(moveHandle);

  return handles;
}

/**
 * 构建折线编辑句柄（顶点/中点/整体移动/旋转/缩放）
 */
export function buildPolylineHandles(verts: Cesium.Cartesian3[], helpers: HandleHelpers): Cesium.Entity[] {
  if (!verts || verts.length < 2) return [];

  const handles: Cesium.Entity[] = [];
  const vertexStyle = { color: Cesium.Color.fromCssColorString("#1e88e5"), outlineColor: Cesium.Color.WHITE, pixelSize: 10 };
  const midStyle = { color: Cesium.Color.fromCssColorString("#ec407a"), outlineColor: Cesium.Color.WHITE, pixelSize: 8 };
  const moveStyle = { color: Cesium.Color.fromCssColorString("#43a047"), outlineColor: Cesium.Color.WHITE, pixelSize: 11 };
  const rotateStyle = { color: Cesium.Color.fromCssColorString("#6d4c41"), outlineColor: Cesium.Color.WHITE, pixelSize: 9 };
  const scaleStyle = { color: Cesium.Color.fromCssColorString("#8e24aa"), outlineColor: Cesium.Color.WHITE, pixelSize: 9 };

  for (let i = 0; i < verts.length; i++) {
    const h = helpers.createHandle(verts[i], vertexStyle, { type: "vertex", index: i });
    handles.push(h);
  }

  for (let i = 0; i < verts.length - 1; i++) {
    const a = verts[i];
    const b = verts[i + 1];
    const mid = Cesium.Cartesian3.midpoint(a, b, new Cesium.Cartesian3());
    const h = helpers.createHandle(mid, midStyle, { type: "mid", index: i });
    handles.push(h);
  }

  const center = helpers.computePolygonCenterCartesian(verts);
  const moveHandle = helpers.createHandle(center, moveStyle, { type: "move" });
  handles.push(moveHandle);

  const handleRadius = helpers.computePolylineHandleRadius(verts, center);
  const rotateHandlePos = helpers.offsetByMeters(center, handleRadius, 0);
  const scaleHandlePos = helpers.offsetByMeters(center, handleRadius, 90);
  const rotateHandle = helpers.createHandle(rotateHandlePos, rotateStyle, { type: "rotate" });
  const scaleHandle = helpers.createHandle(scaleHandlePos, scaleStyle, { type: "scale" });
  handles.push(rotateHandle, scaleHandle);

  return handles;
}

/**
 * 构建点编辑句柄
 */
export function buildPointHandles(pos: Cesium.Cartesian3 | null, helpers: HandleHelpers): Cesium.Entity[] {
  if (!pos) return [];
  const centerStyle = { color: Cesium.Color.fromCssColorString("#43a047"), outlineColor: Cesium.Color.WHITE, pixelSize: 11 };
  const h = helpers.createHandle(pos, centerStyle, { type: "point" });
  return [h];
}

/**
 * 构建圆形编辑句柄（圆心/半径）
 */
export function buildCircleHandles(
  center: Cesium.Cartesian3 | null,
  radiusMeters: number,
  helpers: HandleHelpers
): Cesium.Entity[] {
  if (!center) return [];

  const centerStyle = { color: Cesium.Color.fromCssColorString("#1e88e5"), outlineColor: Cesium.Color.WHITE, pixelSize: 10 };
  const radiusStyle = { color: Cesium.Color.fromCssColorString("#ec407a"), outlineColor: Cesium.Color.WHITE, pixelSize: 9 };

  const centerHandle = helpers.createHandle(center, centerStyle, { type: "center" });
  const radiusHandlePos = helpers.circleRadiusHandlePosition(center, radiusMeters);
  const radiusHandle = helpers.createHandle(radiusHandlePos, radiusStyle, { type: "radius" });

  return [centerHandle, radiusHandle];
}

/**
 * 更新多边形句柄位置
 * @returns false 表示句柄数量不匹配，需重建
 */
export function updatePolygonHandlePositions(
  verts: Cesium.Cartesian3[],
  handles: Cesium.Entity[],
  helpers: HandleHelpers
): boolean {
  const n = verts.length;
  if (handles.length !== n * 2 + 1) return false;

  for (let i = 0; i < n; i++) {
    const ent = handles[i];
    ent.position = new Cesium.ConstantPositionProperty(verts[i]);
    (ent as any).__vmapOverlayEditHandleMeta = { type: "vertex", index: i };
  }

  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    const mid = Cesium.Cartesian3.midpoint(a, b, new Cesium.Cartesian3());
    const ent = handles[n + i];
    ent.position = new Cesium.ConstantPositionProperty(mid);
    (ent as any).__vmapOverlayEditHandleMeta = { type: "mid", index: i };
  }

  const center = helpers.computePolygonCenterCartesian(verts);
  const ent = handles[n * 2];
  ent.position = new Cesium.ConstantPositionProperty(center);
  (ent as any).__vmapOverlayEditHandleMeta = { type: "move" };
  return true;
}

/**
 * 更新折线句柄位置
 * @returns false 表示句柄数量不匹配，需重建
 */
export function updatePolylineHandlePositions(
  verts: Cesium.Cartesian3[],
  handles: Cesium.Entity[],
  helpers: HandleHelpers
): boolean {
  const n = verts.length;
  const expected = n + Math.max(0, n - 1) + 3;
  if (handles.length !== expected) return false;

  for (let i = 0; i < n; i++) {
    const ent = handles[i];
    ent.position = new Cesium.ConstantPositionProperty(verts[i]);
    (ent as any).__vmapOverlayEditHandleMeta = { type: "vertex", index: i };
  }

  for (let i = 0; i < n - 1; i++) {
    const a = verts[i];
    const b = verts[i + 1];
    const mid = Cesium.Cartesian3.midpoint(a, b, new Cesium.Cartesian3());
    const ent = handles[n + i];
    ent.position = new Cesium.ConstantPositionProperty(mid);
    (ent as any).__vmapOverlayEditHandleMeta = { type: "mid", index: i };
  }

  const center = helpers.computePolygonCenterCartesian(verts);
  const moveEnt = handles[expected - 3];
  moveEnt.position = new Cesium.ConstantPositionProperty(center);
  (moveEnt as any).__vmapOverlayEditHandleMeta = { type: "move" };

  const handleRadius = helpers.computePolylineHandleRadius(verts, center);
  const rotatePos = helpers.offsetByMeters(center, handleRadius, 0);
  const scalePos = helpers.offsetByMeters(center, handleRadius, 90);

  const rotateEnt = handles[expected - 2];
  rotateEnt.position = new Cesium.ConstantPositionProperty(rotatePos);
  (rotateEnt as any).__vmapOverlayEditHandleMeta = { type: "rotate" };

  const scaleEnt = handles[expected - 1];
  scaleEnt.position = new Cesium.ConstantPositionProperty(scalePos);
  (scaleEnt as any).__vmapOverlayEditHandleMeta = { type: "scale" };

  return true;
}

/**
 * 更新点句柄位置
 * @returns false 表示句柄数量不匹配或参数为空
 */
export function updatePointHandlePositions(
  pos: Cesium.Cartesian3 | null,
  handles: Cesium.Entity[]
): boolean {
  if (!pos) return false;
  if (handles.length !== 1) return false;
  const ent = handles[0];
  ent.position = new Cesium.ConstantPositionProperty(pos);
  (ent as any).__vmapOverlayEditHandleMeta = { type: "point" };
  return true;
}

/**
 * 更新圆形句柄位置
 * @returns false 表示句柄数量不匹配或参数为空
 */
export function updateCircleHandlePositions(
  center: Cesium.Cartesian3 | null,
  radiusMeters: number,
  handles: Cesium.Entity[],
  helpers: HandleHelpers
): boolean {
  if (!center || handles.length < 2) return false;

  handles[0].position = new Cesium.ConstantPositionProperty(center);
  (handles[0] as any).__vmapOverlayEditHandleMeta = { type: "center" };

  const rPos = helpers.circleRadiusHandlePosition(center, radiusMeters);
  handles[1].position = new Cesium.ConstantPositionProperty(rPos);
  (handles[1] as any).__vmapOverlayEditHandleMeta = { type: "radius" };

  return true;
}
