import CoreHeatmapLayer, { type HeatPoint, type HeatmapAutoUpdateOptions, type HeatmapGradient, type HeatmapOptions } from '../libs/CesiumHeatmapLayer';
/**
 * 兼容旧 0.x API 的热力图图层。
 *
 * 直接继承当前核心实现，保留旧业务依赖的方法签名与自动更新能力，
 * 让 package 顶层导出继续可用而不强迫业务迁移到新的 core 命名。
 */
export declare class HeatmapLayer extends CoreHeatmapLayer {
}
export default HeatmapLayer;
export type { HeatPoint, HeatmapAutoUpdateOptions, HeatmapGradient, HeatmapOptions, };
