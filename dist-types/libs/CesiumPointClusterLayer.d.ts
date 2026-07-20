import * as Cesium from 'cesium';
import type { Viewer, Entity } from 'cesium';
export interface ClusterPoint {
    /** 业务 id（可选，建议传以便稳定更新） */
    id?: string;
    /** 经度（度） */
    lon: number;
    /** 纬度（度） */
    lat: number;
    /** 高度（米，默认 0） */
    height?: number;
    /** 可选：权重/热度值（暂未参与聚类，仅透传给回调） */
    value?: number;
    /** 任意业务属性 */
    properties?: Record<string, unknown>;
}
export interface ClusterStyleStep {
    /** 当 count >= minCount 时命中该样式（按 minCount 从大到小匹配更直观） */
    minCount: number;
    color: Cesium.Color | string;
    /** 聚合点圆点大小（像素），不填则使用 options.clusterPixelSize */
    pixelSize?: number;
}
export interface PointClusterLayerOptions {
    /** 图层 id（用于 Cesium.DataSourceCollection 里区分） */
    id?: string;
    /** 单点渲染：像素大小 */
    pointPixelSize?: number;
    /** 单点渲染：颜色 */
    pointColor?: Cesium.Color | string;
    /** 单点渲染：是否贴地（height=0 时等价贴地效果更明显） */
    clampToGround?: boolean;
    /** 聚类开关（默认 true） */
    clusteringEnabled?: boolean;
    /** 聚类像素范围（越大越容易聚合），默认 50 */
    pixelRange?: number;
    /** 最小聚类数量，默认 2 */
    minimumClusterSize?: number;
    /** 聚合点默认大小（像素） */
    clusterPixelSize?: number;
    /** 聚合点样式分段：用 count 决定颜色/大小 */
    clusterStyleSteps?: ClusterStyleStep[];
    /** 自定义聚合点渲染（直接修改 cluster entity） */
    renderCluster?: (args: {
        cluster: Entity;
        clusteredEntities: Entity[];
        count: number;
    }) => void;
    /** 自定义单点渲染（直接修改 point entity） */
    renderSinglePoint?: (args: {
        entity: Entity;
        point: ClusterPoint;
    }) => void;
    /** 点击聚合点回调：返回该聚合内的原始点 */
    onClusterClick?: (points: ClusterPoint[], ctx: {
        screenPosition: Cesium.Cartesian2;
        worldPosition?: Cesium.Cartesian3;
    }) => void;
    /** 点击单点回调 */
    onPointClick?: (point: ClusterPoint, ctx: {
        screenPosition: Cesium.Cartesian2;
        worldPosition?: Cesium.Cartesian3;
    }) => void;
    /** entity id 前缀（用于避免与外部实体冲突） */
    idPrefix?: string;
}
export default class CesiumPointClusterLayer {
    private static readonly CLUSTER_STYLE_MIN_INTERVAL_MS;
    private static readonly CLICK_PICK_MIN_INTERVAL_MS;
    private viewer;
    private readonly options;
    private dataSource;
    private entityIdToPoint;
    private clickHandler;
    private readonly layerId;
    private pendingClusterStyles;
    private clusterStyleRAF;
    private clusterStyleTimer;
    private lastClusterStyleFlushTime;
    private readonly pickGovernor;
    constructor(viewer: Viewer, options?: PointClusterLayerOptions);
    /** 设置/替换点数据（经纬度单位：度） */
    setData(points: ClusterPoint[]): void;
    setVisible(visible: boolean): void;
    setClusteringEnabled(enabled: boolean): void;
    destroy(): void;
    private enqueueClusterStyle;
    private flushClusterStyles;
    private applyClusterStyle;
    private pickStyle;
    private installClickHandler;
}
export { CesiumPointClusterLayer };
