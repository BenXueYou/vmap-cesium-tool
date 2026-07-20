import * as Cesium from 'cesium';
/**
 * 热力点数据
 */
export interface HeatPoint {
    /** 经度（度） */
    lon: number;
    /** 纬度（度） */
    lat: number;
    /** 强度值 */
    value: number;
}
/**
 * 热力图渐变配置
 */
export interface HeatmapGradient {
    [stop: number]: string;
}
/**
 * 热力图选项
 */
export interface HeatmapOptions {
    /** Canvas 宽度（默认 512） */
    width?: number;
    /** Canvas 高度（默认 512） */
    height?: number;
    /** 渲染模式：heat=热力渐变，discrete=分段纯色 */
    mode?: 'heat' | 'discrete';
    /** 点影响半径（像素，默认 30） */
    radius?: number;
    /** 伽马校正值（默认 0.7） */
    gamma?: number;
    /** 最小透明度（默认 0.03） */
    minAlpha?: number;
    /** 最小值（用于归一化） */
    minValue?: number;
    /** 最大值（用于归一化） */
    maxValue?: number;
    /** 全局不透明度（0-1） */
    opacity?: number;
    /** 颜色梯度 */
    gradient?: HeatmapGradient;
    /** 离散模式阈值数组 */
    discreteThresholds?: number[];
    /** 离散模式颜色数组 */
    discreteColors?: string[];
    /** 重叠处理方式：max=取高分段，last=后绘制覆盖 */
    discreteOverlap?: 'max' | 'last';
}
/**
 * Cesium 热力图图层
 *
 * 使用离屏 Canvas 渲染热力图，通过 SingleTileImageryProvider 叠加到地球。
 *
 * @example
 * ```typescript
 * const heatmap = new HeatmapLayer(viewer, {
 *   radius: 30,
 *   gradient: {
 *     0.0: '#0000ff',
 *     0.5: '#00ffff',
 *     1.0: '#ff0000'
 *   }
 * });
 * heatmap.setData([
 *   { lon: 120.1, lat: 30.2, value: 50 },
 *   { lon: 120.2, lat: 30.3, value: 80 }
 * ]);
 * ```
 */
export declare class HeatmapLayer {
    private viewer;
    private imageryLayer;
    private rectangle;
    private fullDataRectangle;
    private canvas;
    private ctx;
    private options;
    private data;
    private gradientLUT;
    constructor(viewer: Cesium.Viewer, options?: HeatmapOptions);
    /**
     * 解析颜色为 RGBA
     */
    private parseColorToRGBA;
    /**
     * 构建颜色查找表
     */
    private buildGradientLUT;
    /**
     * 设置热力图数据
     */
    setData(points: HeatPoint[]): void;
    /**
     * 渲染热力图
     */
    private renderHeatmap;
    /**
     * 更新影像图层
     */
    private updateImageryLayer;
    /**
     * 设置透明度
     */
    setOpacity(opacity: number): void;
    /**
     * 设置可见性
     */
    setVisible(visible: boolean): void;
    /**
     * 清除图层
     */
    clearLayer(): void;
    /**
     * 销毁图层
     */
    destroy(): void;
}
