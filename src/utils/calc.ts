import * as Cesium from 'cesium';
import type { Cartesian3, Ellipsoid, Rectangle } from 'cesium';

/**
 * 判断一个 Cartesian3 是否为有效坐标（x/y/z 都是有限数字）
 */
export function isValidCartesian3(pos: Cartesian3 | null | undefined): pos is Cartesian3 {
  return !!pos &&
    Number.isFinite(pos.x) &&
    Number.isFinite(pos.y) &&
    Number.isFinite(pos.z);
}

/**
 * 格式化距离显示
 * 超过1000m时转换为km，保留两位小数
 * @param distance 距离（米）
 * @returns 格式化后的距离字符串
 */
export function formatDistance(distance: number): string {
  // 确保距离是有效数字
  if (!isFinite(distance) || isNaN(distance)) {
    return '0.00 m';
  }
  if (distance >= 1000) {
    const km = distance / 1000;
    return `${km.toFixed(2)} km`;
  } else {
    return `${distance.toFixed(2)} m`;
  }
}

/**
 * 格式化面积显示
 * @param areaKm2 面积（平方公里）
 * @returns 格式化后的面积字符串
 */
export function formatArea(areaKm2: number): string {
  if (!isFinite(areaKm2) || isNaN(areaKm2)) {
    return "0.00 m²";
  }
  if (areaKm2 >= 1) {
    return `${areaKm2.toFixed(2)} km²`;
  }
  const areaM2 = areaKm2 * 1e6;
  return `${areaM2.toFixed(2)} m²`;
}

/**
 * 计算矩形
 * @param p1 第一个点
 * @param p2 第二个点
 * @returns 矩形对象
 */
export function calculateRectangle(
  p1: Cartesian3,
  p2: Cartesian3
): Rectangle {
  const cartographic1 = Cesium.Cartographic.fromCartesian(p1);
  const cartographic2 = Cesium.Cartographic.fromCartesian(p2);
  const west = Math.min(cartographic1.longitude, cartographic2.longitude);
  const east = Math.max(cartographic1.longitude, cartographic2.longitude);
  const south = Math.min(cartographic1.latitude, cartographic2.latitude);
  const north = Math.max(cartographic1.latitude, cartographic2.latitude);
  return new Cesium.Rectangle(west, south, east, north);
}

/**
 * 计算矩形面积
 * @param rect 矩形对象
 * @returns 面积（平方公里）
 */
export function calculateRectangleArea(rect: Rectangle): number {
  const west = rect.west;
  const south = rect.south;
  const east = rect.east;
  const north = rect.north;

  const width = Cesium.Cartesian3.distance(
    Cesium.Cartesian3.fromRadians(west, south),
    Cesium.Cartesian3.fromRadians(east, south)
  );
  const height = Cesium.Cartesian3.distance(
    Cesium.Cartesian3.fromRadians(west, south),
    Cesium.Cartesian3.fromRadians(west, north)
  );

  return (width * height) / 1e6; // 转换为平方公里
}

/**
 * 计算多边形面积
 * @param positions 多边形顶点坐标数组
 * @param ellipsoid 椭球体对象（默认使用 WGS84）
 * @returns 面积（平方公里）
 */
export function calculatePolygonArea(
  positions: Cartesian3[],
  ellipsoid: Ellipsoid = Cesium.Ellipsoid.WGS84
): number {
  // 防御性检查：过滤掉无效坐标，避免 cartesianToCartographic 过程中产生 NaN
  const validPositions = positions.filter((p) => isValidCartesian3(p));
  if (validPositions.length < 3) return 0;

  let area = 0;
  const len = validPositions.length;
  for (let i = 0; i < len; i++) {
    const p1Cartesian = validPositions[i];
    const p2Cartesian = validPositions[(i + 1) % len];

    if (!isValidCartesian3(p1Cartesian) || !isValidCartesian3(p2Cartesian)) {
      return 0;
    }

    const p1 = ellipsoid.cartesianToCartographic(p1Cartesian);
    const p2 = ellipsoid.cartesianToCartographic(p2Cartesian);

    if (!p1 || !p2 ||
        !Number.isFinite(p1.longitude) || !Number.isFinite(p1.latitude) ||
        !Number.isFinite(p2.longitude) || !Number.isFinite(p2.latitude)) {
      return 0;
    }

    area +=
      (p2.longitude - p1.longitude) *
      (2 + Math.sin(p1.latitude) + Math.sin(p2.latitude));
  }
  area = Math.abs((area * 6378137.0 * 6378137.0) / 2.0); // WGS84半径
  return area / 1e6; // 转换为平方公里
}

/**
 * 计算多边形中心点
 * @param positions 多边形顶点坐标数组
 * @returns 中心点坐标
 */
export function calculatePolygonCenter(
  positions: Cartesian3[]
): Cartesian3 {
  // 仅使用有效的 Cartesian3 参与中心点计算
  const validPositions = positions.filter((p) => isValidCartesian3(p));
  if (validPositions.length === 0) return Cesium.Cartesian3.ZERO;

  let x = 0,
    y = 0,
    z = 0;
  for (let i = 0; i < validPositions.length; i++) {
    x += validPositions[i].x;
    y += validPositions[i].y;
    z += validPositions[i].z;
  }
  return new Cesium.Cartesian3(
    x / validPositions.length,
    y / validPositions.length,
    z / validPositions.length
  );
}

/**
 * 计算折线总长度
 * @param positions 折线顶点坐标数组
 * @returns 总长度（米）
 */
export function calculatePolylineDistance(positions: Cartesian3[]): number {
  if (!positions || positions.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const curr = positions[i];
    if (isValidCartesian3(prev) && isValidCartesian3(curr)) {
      totalDistance += Cesium.Cartesian3.distance(prev, curr);
    }
  }

  return totalDistance;
}

