export declare function getViteTdToken(): any;
export declare function getViteCesiumToken(): any;
/**
 * 将相机高度转换为地图层级
 * @param height 相机高度（米）
 * @returns 地图层级（1-18）
 */
export declare function heightToZoomLevel(height: number): number;
/**
 * 将地图层级转换为相机高度
 * @param zoomLevel 地图层级（1-18）
 * @returns 相机高度（米）
 */
export declare function zoomLevelToHeight(zoomLevel: number): number;
/**
  * 深度合并对象
  */
export declare function deepMerge<T>(target: T, source: Partial<T>): T;
