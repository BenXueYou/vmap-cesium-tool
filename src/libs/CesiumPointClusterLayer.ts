import * as Cesium from 'cesium';
import type { Viewer, CustomDataSource, Entity, ScreenSpaceEventHandler } from 'cesium';
import { PickGovernor } from './PickGovernor';

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
  renderCluster?: (args: { cluster: Entity; clusteredEntities: Entity[]; count: number }) => void;
  /** 自定义单点渲染（直接修改 point entity） */
  renderSinglePoint?: (args: { entity: Entity; point: ClusterPoint }) => void;

  /** 点击聚合点回调：返回该聚合内的原始点 */
  onClusterClick?: (points: ClusterPoint[], ctx: { screenPosition: Cesium.Cartesian2; worldPosition?: Cesium.Cartesian3 }) => void;
  /** 点击单点回调 */
  onPointClick?: (point: ClusterPoint, ctx: { screenPosition: Cesium.Cartesian2; worldPosition?: Cesium.Cartesian3 }) => void;

  /** entity id 前缀（用于避免与外部实体冲突） */
  idPrefix?: string;
}

type InternalEntity = Entity & {
  __vmapClusterLayerId?: string;
  __vmapClusteredEntityIds?: string[];
};

function toCesiumColor(c: Cesium.Color | string): Cesium.Color {
  if (typeof c === 'string') return Cesium.Color.fromCssColorString(c);
  return c;
}

export default class CesiumPointClusterLayer {
  private static readonly CLUSTER_STYLE_MIN_INTERVAL_MS = 33; // ~30fps
  private static readonly CLICK_PICK_MIN_INTERVAL_MS = 120;

  private viewer: Viewer;
  private readonly options: Required<Omit<PointClusterLayerOptions, 'onClusterClick' | 'onPointClick' | 'clusterStyleSteps' | 'renderCluster' | 'renderSinglePoint'>> & {
    clusterStyleSteps: ClusterStyleStep[];
    onClusterClick?: PointClusterLayerOptions['onClusterClick'];
    onPointClick?: PointClusterLayerOptions['onPointClick'];
    renderCluster?: PointClusterLayerOptions['renderCluster'];
    renderSinglePoint?: PointClusterLayerOptions['renderSinglePoint'];
  };

  private dataSource: CustomDataSource;
  private entityIdToPoint: Map<string, ClusterPoint> = new Map();

  private clickHandler: ScreenSpaceEventHandler | null = null;
  private readonly layerId: string;
  private pendingClusterStyles: Map<Entity, Entity[]> = new Map();
  private clusterStyleRAF: number | null = null;
  private clusterStyleTimer: number | null = null;
  private lastClusterStyleFlushTime = 0;
  private readonly pickGovernor: PickGovernor;

  constructor(viewer: Viewer, options: PointClusterLayerOptions = {}) {
    this.viewer = viewer;

    const layerId = options.id || `vmap-point-cluster-${Math.random().toString(36).slice(2)}`;
    this.layerId = layerId;
    this.pickGovernor = new PickGovernor({
      profiles: {
        cluster: { minIntervalMs: CesiumPointClusterLayer.CLICK_PICK_MIN_INTERVAL_MS, minMovePx: 0 },
      },
    });

    this.options = {
      id: layerId,
      pointPixelSize: options.pointPixelSize ?? 8,
      pointColor: options.pointColor ?? Cesium.Color.CYAN,
      clampToGround: options.clampToGround ?? true,

      clusteringEnabled: options.clusteringEnabled ?? true,
      pixelRange: options.pixelRange ?? 50,
      minimumClusterSize: options.minimumClusterSize ?? 2,

      clusterPixelSize: options.clusterPixelSize ?? 18,
      clusterStyleSteps:
        options.clusterStyleSteps ??
        [
          { minCount: 100, color: Cesium.Color.RED, pixelSize: 28 },
          { minCount: 50, color: Cesium.Color.ORANGE, pixelSize: 24 },
          { minCount: 20, color: Cesium.Color.YELLOW, pixelSize: 20 },
          { minCount: 2, color: Cesium.Color.DODGERBLUE, pixelSize: 18 },
        ],

      idPrefix: options.idPrefix ?? `${layerId}:`,
      onClusterClick: options.onClusterClick,
      onPointClick: options.onPointClick,
      renderCluster: options.renderCluster,
      renderSinglePoint: options.renderSinglePoint,
    };

    this.dataSource = new Cesium.CustomDataSource(layerId);
    (this.dataSource as any).show = true;

    // clustering
    const clustering: any = (this.dataSource as any).clustering;
    if (clustering) {
      clustering.enabled = this.options.clusteringEnabled;
      clustering.pixelRange = this.options.pixelRange;
      clustering.minimumClusterSize = this.options.minimumClusterSize;
      clustering.clusterPoints = true;
      clustering.clusterLabels = true;
      clustering.clusterBillboards = true;

      // 每次聚类更新时，定制 cluster 的外观
      clustering.clusterEvent.addEventListener((clusteredEntities: Entity[], cluster: Entity) => {
        this.enqueueClusterStyle(clusteredEntities, cluster);
      });
    }

    // 加入 viewer
    this.viewer.dataSources.add(this.dataSource);

    // click
    this.installClickHandler();
  }

  /** 设置/替换点数据（经纬度单位：度） */
  public setData(points: ClusterPoint[]): void {
    this.entityIdToPoint.clear();
    this.dataSource.entities.removeAll();

    if (!Array.isArray(points) || points.length === 0) return;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!Number.isFinite(p?.lon) || !Number.isFinite(p?.lat)) continue;

      const entityId = this.options.idPrefix + (p.id ?? String(i));
      this.entityIdToPoint.set(entityId, p);

      const height = Number.isFinite(p.height as any) ? (p.height as number) : 0;
      const position = Cesium.Cartesian3.fromDegrees(p.lon, p.lat, height);

      const entity = this.dataSource.entities.add({
        id: entityId,
        position,
        point: {
          pixelSize: this.options.pointPixelSize,
          color: toCesiumColor(this.options.pointColor),
          outlineColor: Cesium.Color.WHITE.withAlpha(0.65),
          outlineWidth: 1,
          heightReference: this.options.clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: p.properties ? new Cesium.PropertyBag(p.properties as any) : undefined,
      }) as InternalEntity;

      entity.__vmapClusterLayerId = this.layerId;

      if (this.options.renderSinglePoint) {
        try {
          this.options.renderSinglePoint({ entity, point: p });
        } catch {
          // ignore
        }
      }
    }

    // 触发一次重新聚类
    try {
      const clustering: any = (this.dataSource as any).clustering;
      if (clustering && clustering.enabled) {
        clustering._cluster();
      }
    } catch {
      // ignore
    }
  }

  public setVisible(visible: boolean): void {
    (this.dataSource as any).show = visible;
  }

  public setClusteringEnabled(enabled: boolean): void {
    const clustering: any = (this.dataSource as any).clustering;
    if (clustering) clustering.enabled = enabled;
  }

  public destroy(): void {
    if (this.clusterStyleRAF !== null) {
      window.cancelAnimationFrame(this.clusterStyleRAF);
      this.clusterStyleRAF = null;
    }
    if (this.clusterStyleTimer !== null) {
      window.clearTimeout(this.clusterStyleTimer);
      this.clusterStyleTimer = null;
    }
    this.pendingClusterStyles.clear();

    try {
      if (this.clickHandler) {
        this.clickHandler.destroy();
        this.clickHandler = null;
      }
    } catch {
      // ignore
    }

    try {
      this.viewer.dataSources.remove(this.dataSource, true);
    } catch {
      // ignore
    }

    this.entityIdToPoint.clear();
  }

  private enqueueClusterStyle(clusteredEntities: Entity[], cluster: Entity): void {
    this.pendingClusterStyles.set(cluster, Array.isArray(clusteredEntities) ? clusteredEntities.slice() : []);

    if (this.clusterStyleRAF !== null || this.clusterStyleTimer !== null) {
      return;
    }

    const now = Date.now();
    const wait = Math.max(0, CesiumPointClusterLayer.CLUSTER_STYLE_MIN_INTERVAL_MS - (now - this.lastClusterStyleFlushTime));

    if (wait > 0) {
      this.clusterStyleTimer = window.setTimeout(() => {
        this.clusterStyleTimer = null;
        this.clusterStyleRAF = window.requestAnimationFrame(() => {
          this.clusterStyleRAF = null;
          this.flushClusterStyles();
        });
      }, wait);
      return;
    }

    this.clusterStyleRAF = window.requestAnimationFrame(() => {
      this.clusterStyleRAF = null;
      this.flushClusterStyles();
    });
  }

  private flushClusterStyles(): void {
    this.lastClusterStyleFlushTime = Date.now();
    const batch = Array.from(this.pendingClusterStyles.entries());
    this.pendingClusterStyles.clear();
    for (const [cluster, clusteredEntities] of batch) {
      this.applyClusterStyle(clusteredEntities, cluster);
    }
  }

  private applyClusterStyle(clusteredEntities: Entity[], cluster: Entity): void {
    const internalCluster = cluster as InternalEntity;
    internalCluster.__vmapClusterLayerId = this.layerId;
    internalCluster.__vmapClusteredEntityIds = clusteredEntities.map(e => String((e as any).id));

    const count = clusteredEntities.length;
    const style = this.pickStyle(count);

    // 兜底：为 cluster 相关 primitive 绑定 id，避免自定义 renderCluster 时 pick.id 丢失
    const anyCluster = cluster as any;
    if (anyCluster.point) anyCluster.point.id = cluster;
    if (anyCluster.label) anyCluster.label.id = cluster;
    if (anyCluster.billboard) anyCluster.billboard.id = cluster;

    if (this.options.renderCluster) {
      try {
        this.options.renderCluster({ cluster, clusteredEntities, count });
      } catch {
        // ignore
      }
      return;
    }

    // 统一用 point + label 展示（最轻量）
    (cluster as any).billboard && ((cluster as any).billboard.show = false);

    if ((cluster as any).point) {
      (cluster as any).point.show = true;
      (cluster as any).point.id = cluster;
      (cluster as any).point.pixelSize = style.pixelSize ?? this.options.clusterPixelSize;
      (cluster as any).point.color = toCesiumColor(style.color);
      (cluster as any).point.outlineColor = Cesium.Color.WHITE.withAlpha(0.85);
      (cluster as any).point.outlineWidth = 2;
      (cluster as any).point.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    }

    if ((cluster as any).label) {
      (cluster as any).label.show = true;
      (cluster as any).label.id = cluster;
      (cluster as any).label.text = String(count);
      (cluster as any).label.font = 'bold 14px sans-serif';
      (cluster as any).label.fillColor = Cesium.Color.WHITE;
      (cluster as any).label.outlineColor = Cesium.Color.BLACK.withAlpha(0.45);
      (cluster as any).label.outlineWidth = 2;
      (cluster as any).label.style = Cesium.LabelStyle.FILL_AND_OUTLINE;
      (cluster as any).label.verticalOrigin = Cesium.VerticalOrigin.CENTER;
      (cluster as any).label.horizontalOrigin = Cesium.HorizontalOrigin.CENTER;
      (cluster as any).label.pixelOffset = new Cesium.Cartesian2(0, 0);
      (cluster as any).label.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    }
  }

  private pickStyle(count: number): ClusterStyleStep {
    const steps = this.options.clusterStyleSteps;
    if (!steps || steps.length === 0) return { minCount: 2, color: Cesium.Color.DODGERBLUE, pixelSize: this.options.clusterPixelSize };

    // 按 minCount 从大到小匹配（更符合直觉）
    const sorted = steps.slice().sort((a, b) => b.minCount - a.minCount);
    for (const s of sorted) {
      if (count >= s.minCount) return s;
    }
    return sorted[sorted.length - 1];
  }

  private installClickHandler(): void {
    if (!this.options.onClusterClick && !this.options.onPointClick) return;

    this.clickHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    this.clickHandler.setInputAction((movement: any) => {
      const pos: Cesium.Cartesian2 = movement?.position;
      if (!pos) return;

      if (!this.pickGovernor.shouldPick('cluster', pos)) return;
      
      const picked = this.viewer.scene.pick(pos);
      if (!picked) return;

      const pickedId: any = (picked as any).id ?? (picked as any).primitive?.id;
      if (!pickedId) return;

      const entity = pickedId as InternalEntity;
      if (entity.__vmapClusterLayerId !== this.layerId) {
        // 有时 pick 到的是原始 entity（我们在 setData 里标了 layerId）
        const rawEntity = pickedId as any;
        if (rawEntity && rawEntity.__vmapClusterLayerId === this.layerId) {
          // ok
        } else {
          return;
        }
      }

      const clusteredIds = (entity as any).__vmapClusteredEntityIds as string[] | undefined;
      const worldPos = (entity as any).position?.getValue?.(Cesium.JulianDate.now()) ?? (entity as any).position;

      if (Array.isArray(clusteredIds) && clusteredIds.length > 1) {
        if (!this.options.onClusterClick) return;
        const points: ClusterPoint[] = [];
        for (const id of clusteredIds) {
          const p = this.entityIdToPoint.get(String(id));
          if (p) points.push(p);
        }
        this.options.onClusterClick(points, { screenPosition: pos, worldPosition: worldPos });
        return;
      }

      // 单点
      if (!this.options.onPointClick) return;
      const id = String((entity as any).id);
      const p = this.entityIdToPoint.get(id);
      if (!p) return;
      this.options.onPointClick(p, { screenPosition: pos, worldPosition: worldPos });
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }
}

// Named export
export { CesiumPointClusterLayer };
