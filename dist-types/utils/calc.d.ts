import type { Cartesian3, Ellipsoid, Rectangle } from 'cesium';
/**
 * 判断一个 Cartesian3 是否为有效坐标（x/y/z 都是有限数字）
 */
export declare function isValidCartesian3(pos: Cartesian3 | null | undefined): pos is Cartesian3;
/**
 * 格式化距离显示
 * 超过1000m时转换为km，保留两位小数
 * @param distance 距离（米）
 * @returns 格式化后的距离字符串
 */
export declare function formatDistance(distance: number): string;
/**
 * 格式化面积显示
 * @param areaKm2 面积（平方公里）
 * @returns 格式化后的面积字符串
 */
export declare function formatArea(areaKm2: number): string;
/**
 * 计算矩形
 * @param p1 第一个点
 * @param p2 第二个点
 * @returns 矩形对象
 */
export declare function calculateRectangle(p1: Cartesian3, p2: Cartesian3): Rectangle;
/**
 * 计算矩形面积
 * @param rect 矩形对象
 * @returns 面积（平方公里）
 */
export declare function calculateRectangleArea(rect: Rectangle): number;
/**
 * 计算多边形面积
 * @param positions 多边形顶点坐标数组
 * @param ellipsoid 椭球体对象（默认使用 WGS84）
 * @returns 面积（平方公里）
 */
export declare function calculatePolygonArea(positions: Cartesian3[], ellipsoid?: Ellipsoid): number;
/**
 * 计算多边形中心点
 * @param positions 多边形顶点坐标数组
 * @returns 中心点坐标
 */
export declare function calculatePolygonCenter(positions: Cartesian3[]): Cartesian3;
/**
 * 计算折线总长度
 * @param positions 折线顶点坐标数组
 * @returns 总长度（米）
 */
export declare function calculatePolylineDistance(positions: Cartesian3[]): number;
