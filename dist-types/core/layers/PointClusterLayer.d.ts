import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';
/**
 * 聚类点数据
 */
export interface ClusterPoint {
    /** 业务 id */
    id?: string;
    /** 经度（度） */
    lon: number;
    /** 纬度（度） */
    lat: number;
    /** 高度（米） */
    height?: number;
    /** 权重值 */
    value?: number;
    /** 业务属性 */
    properties?: Record<string, unknown>;
}
/**
 * 聚类样式分段
 */
export interface ClusterStyleStep {
    /** 最小聚合数量 */
    minCount: number;
    /** 颜色 */
    color: Cesium.Color | string;
    /** 像素大小 */
    pixelSize?: number;
}
/**
 * 点聚合图层选项
 */
export interface PointClusterLayerOptions {
    /** 图层 id */
    id?: string;
    /** 单点像素大小（默认 8） */
    pointPixelSize?: number;
    /** 单点颜色（默认青色） */
    pointColor?: Cesium.Color | string;
    /** 是否贴地（默认 true） */
    clampToGround?: boolean;
    /** 启用聚类（默认 true） */
    clusteringEnabled?: boolean;
    /** 聚类像素范围（默认 50） */
    pixelRange?: number;
    /** 最小聚类数量（默认 2） */
    minimumClusterSize?: number;
    /** 聚合点默认大小（默认 18） */
    clusterPixelSize?: number;
    /** 聚合点样式分段 */
    clusterStyleSteps?: ClusterStyleStep[];
    /** 点击聚合点回调 */
    onClusterClick?: (points: ClusterPoint[]) => void;
    /** 点击单点回调 */
    onPointClick?: (point: ClusterPoint) => void;
    /** 实体 ID 前缀 */
    idPrefix?: string;
}
/**
 * 点聚合图层
 *
 * 用于在地图上创建点聚合效果，将密集的点聚合成簇显示。
 *
 * @example
 * ```typescript
 * const clusterLayer = new PointClusterLayer(viewer, {
 *   pixelRange: 50,
 *   minimumClusterSize: 2,
 *   clusterStyleSteps: [
 *     { minCount: 100, color: Cesium.Color.RED, pixelSize: 28 },
 *     { minCount: 50, color: Cesium.Color.ORANGE, pixelSize: 24 },
 *     { minCount: 20, color: Cesium.Color.YELLOW, pixelSize: 20 },
 *     { minCount: 2, color: Cesium.Color.DODGERBLUE, pixelSize: 18 }
 *   ]
 * });
 * clusterLayer.setData([
 *   { lon: 120.1, lat: 30.2 },
 *   { lon: 120.2, lat: 30.3 }
 * ]);
 * ```
 */
export declare class PointClusterLayer {
    private viewer;
    private options;
    private dataSource;
    private entityIdToPoint;
    private clickHandler;
    private readonly layerId;
    constructor(viewer: Viewer, options?: PointClusterLayerOptions);
    /**
     * 设置点数据
     */
    setData(points: ClusterPoint[]): void;
    /**
     * 应用聚类样式
     */
    private applyClusterStyle;
    /**
     * 选择样式
     */
    private pickStyle;
    /**
     * 安装点击处理器
     */
    private installClickHandler;
    /**
     * 设置可见性
     */
    setVisible(visible: boolean): void;
    /**
     * 设置聚类开关
     */
    setClusteringEnabled(enabled: boolean): void;
    /**
     * 销毁图层
     */
    destroy(): void;
}
