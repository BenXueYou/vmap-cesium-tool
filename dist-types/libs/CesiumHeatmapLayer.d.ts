import * as Cesium from "cesium";
export interface HeatPoint {
    /** 经度（度） */
    lon: number;
    /** 纬度（度） */
    lat: number;
    /** 强度值，用于控制热度（0~maxValue） */
    value: number;
}
export interface HeatmapGradient {
    /**
     * 0~1 的比例到颜色字符串的映射，例如：
     * { 0.0: "#0000ff", 0.5: "#ffff00", 1.0: "#ff0000" }
     */
    [stop: number]: string;
}
export interface HeatmapOptions {
    /** Canvas 分辨率，越大越清晰但开销越大 */
    width?: number;
    height?: number;
    /** 渲染模式：heat 为热力渐变（默认）；discrete 为严格分段纯色 */
    mode?: "heat" | "discrete";
    /** 单个点的影响半径（像素） */
    radius?: number;
    /** 低强度提升（伽马矫正），< 1 可增强边缘，默认 0.7 */
    gamma?: number;
    /** 最小可见 alpha（0~1），用于避免外圈完全消失，默认 0.03 */
    minAlpha?: number;
    /** 最小/最大值，用于归一化 value，如果不传则自动根据数据计算 */
    minValue?: number;
    maxValue?: number;
    /** 全局不透明度 0~1 */
    opacity?: number;
    /** 颜色梯度 */
    gradient?: HeatmapGradient;
    /**
     * 严格分段（仅 mode=discrete 生效）：
     * thresholds.length + 1 必须等于 colors.length。
     * 例如 thresholds=[40,60,90,110] colors=[蓝,青,绿,黄,红]
     * - value < 40 -> colors[0]
     * - 40 <= value < 60 -> colors[1]
     * - 60 <= value < 90 -> colors[2]
     * - 90 <= value < 110 -> colors[3]
     * - value >= 110 -> colors[4]
     */
    discreteThresholds?: number[];
    discreteColors?: string[];
    /** 重叠像素的决策：max=取更高分段（默认）；last=后绘制覆盖 */
    discreteOverlap?: "max" | "last";
}
export interface HeatmapAutoUpdateOptions {
    /** 是否启用随视角变化自动重绘（默认 true） */
    enabled?: boolean;
    /** 视域范围 padding（比例，默认 0.15） */
    viewPaddingRatio?: number;
    /** 聚合网格边长（米）。不传则根据相机高度自动估算 */
    cellSizeMeters?: number;
    /** 根据相机高度（米）动态返回网格边长（米）。优先级高于 cellSizeMeters */
    cellSizeMetersByHeight?: (cameraHeightMeters: number) => number;
}
/**
 * Cesium 热力图图层封装
 * - 使用离屏 Canvas 绘制热力图
 * - 通过 SingleTileImageryProvider 叠加到地球上
 */
export default class CesiumHeatmapLayer {
    private viewer;
    private imageryLayer;
    private rectangle;
    private fullDataRectangle;
    private canvas;
    private ctx;
    private options;
    private data;
    private gradientLUT;
    private autoUpdateEnabled;
    private autoUpdateOptions;
    private removeMoveEndListener;
    private aggregateWorker;
    private workerReady;
    private pendingUpdate;
    private lastUpdateKey;
    private handleWorkerFault;
    constructor(viewer: Cesium.Viewer, options?: HeatmapOptions);
    private parseColorToRGBA;
    /**
     * 获取离散桶的索引
     * @param value - 需要确定桶索引的数值
     * @return 返回对应的桶索引，如果阈值无效则返回0
     */
    private getDiscreteBucketIndex;
    /**
     * 渲染离散热力图
     * @param points 热力点数据数组
     */
    private renderDiscrete;
    /**
     * 设置/替换热力图数据（度为单位）
     */
    setData(points: HeatPoint[]): void;
    /**
     * 更新调色板
     */
    setGradient(gradient: HeatmapGradient): void;
    /**
     * 设置透明度
     */
    setOpacity(opacity: number): void;
    /**
     * 显隐控制
     */
    setVisible(visible: boolean): void;
    /**
     * 销毁并移除图层
     */
    destroy(): void;
    /**
     * 启用/关闭基于视域与缩放的自动聚合重绘（方格聚合 + moveEnd + WebWorker）。
     * - 启用后：热力图仅渲染当前视域范围内的聚合结果，缩放/平移后自动更新。
     * - 关闭后：回退为 setData() 时按全量范围绘制一张 SingleTile。
     */
    setAutoUpdate(options?: HeatmapAutoUpdateOptions): void;
    stopAutoUpdate(): void;
    private clearLayer;
    private startAutoUpdateInternal;
    private requestAutoUpdate;
    private getPaddedViewRectangleDegrees;
    private ensureWorker;
    private pushDataToWorker;
    /**
     * 构建颜色查找表（0-255 -> RGBA）
     */
    private buildGradientLUT;
    /**
     * 在离屏 canvas 上绘制热力图，并更新到 Cesium 图层
     */
    private renderHeatmap;
    /**
     * 将当前 canvas 映射为 Cesium 影像图层
     */
    private updateImageryLayer;
}
export { CesiumHeatmapLayer };
