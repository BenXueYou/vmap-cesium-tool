export function getViteTdToken() {
    const VITE_TD_TOKEN = (
      import.meta as any
    ).env.VITE_TD_TOKEN;
    const tokens = VITE_TD_TOKEN.split(',');
    const randomIndex = Math.floor(Math.random() * tokens.length);
    return tokens[randomIndex];
  }

/**
 * 将相机高度转换为地图层级
 * @param height 相机高度（米）
 * @returns 地图层级（1-18）
 */
export function heightToZoomLevel(height: number): number {
  // Cesium中层级和高度的关系
  // 层级越高，高度越小（越近）
  // 基于瓦片地图的层级系统，使用更精确的公式
  
  // 地球半径（米）
  const earthRadius = 6378137;
  // 地球周长（米）
  const earthCircumference = 2 * Math.PI * earthRadius;
  
  // 限制高度范围，避免无效值
  const clampedHeight = Math.max(10, Math.min(earthCircumference, Math.abs(height)));
  
  // 计算层级：基于瓦片地图的层级公式
  // 层级 = log2(地球周长 / (高度 * 2 * Math.PI)) + 1
  // 调整公式使其更符合实际的地图层级范围
  const zoomLevel = Math.log2(earthCircumference / (clampedHeight * 2)) + 1;
  
  // 限制在1-18之间，并四舍五入
  return Math.max(1, Math.min(18, Math.round(zoomLevel)));
}

/**
 * 将地图层级转换为相机高度
 * @param zoomLevel 地图层级（1-18）
 * @returns 相机高度（米）
 */
export function zoomLevelToHeight(zoomLevel: number): number {
  // 限制层级范围
  const clampedLevel = Math.max(1, Math.min(18, Math.round(zoomLevel)));
  
  // 地球半径（米）
  const earthRadius = 6378137;
  // 地球周长（米）
  const earthCircumference = 2 * Math.PI * earthRadius;
  
  // 使用与heightToZoomLevel相反的公式
  // 高度 = 地球周长 / (2 * 2^(层级-1))
  const height = earthCircumference / (2 * Math.pow(2, clampedLevel - 1));
  
  return height;
}