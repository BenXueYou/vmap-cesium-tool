import * as Cesium from 'cesium';
import type { Viewer, CustomDataSource, Entity, ScreenSpaceEventHandler } from 'cesium';

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

function toCesiumColor(c: Cesium.Color | string): Cesium.Color {
  if (typeof c === 'string') return Cesium.Color.fromCssColorString(c);
  return c;
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
export class PointClusterLayer {
  private viewer: Viewer;
  private options: Required<Omit<PointClusterLayerOptions, 'onClusterClick' | 'onPointClick' | 'clusterStyleSteps'>> & {
    clusterStyleSteps: ClusterStyleStep[];
    onClusterClick?: PointClusterLayerOptions['onClusterClick'];
    onPointClick?: PointClusterLayerOptions['onPointClick'];
  };

  private dataSource: CustomDataSource;
  private entityIdToPoint: Map<string, ClusterPoint> = new Map();
  private clickHandler: ScreenSpaceEventHandler | null = null;
  private readonly layerId: string;

  constructor(viewer: Viewer, options: PointClusterLayerOptions = {}) {
    this.viewer = viewer;

    const layerId = options.id || `vmap-cluster-${Math.random().toString(36).slice(2)}`;
    this.layerId = layerId;

    this.options = {
      id: layerId,
      pointPixelSize: options.pointPixelSize ?? 8,
      pointColor: options.pointColor ?? Cesium.Color.CYAN,
      clampToGround: options.clampToGround ?? true,
      clusteringEnabled: options.clusteringEnabled ?? true,
      pixelRange: options.pixelRange ?? 50,
      minimumClusterSize: options.minimumClusterSize ?? 2,
      clusterPixelSize: options.clusterPixelSize ?? 18,
      clusterStyleSteps: options.clusterStyleSteps ?? [
        { minCount: 100, color: Cesium.Color.RED, pixelSize: 28 },
        { minCount: 50, color: Cesium.Color.ORANGE, pixelSize: 24 },
        { minCount: 20, color: Cesium.Color.YELLOW, pixelSize: 20 },
        { minCount: 2, color: Cesium.Color.DODGERBLUE, pixelSize: 18 },
      ],
      idPrefix: options.idPrefix ?? `${layerId}:`,
      onClusterClick: options.onClusterClick,
      onPointClick: options.onPointClick,
    };

    this.dataSource = new Cesium.CustomDataSource(layerId);
    (this.dataSource as any).show = true;

    // 配置聚类
    const clustering: any = (this.dataSource as any).clustering;
    if (clustering) {
      clustering.enabled = this.options.clusteringEnabled;
      clustering.pixelRange = this.options.pixelRange;
      clustering.minimumClusterSize = this.options.minimumClusterSize;
      clustering.clusterPoints = true;
      clustering.clusterLabels = true;
      clustering.clusterBillboards = true;

      // 监听聚类事件
      clustering.clusterEvent.addEventListener((clusteredEntities: Entity[], cluster: Entity) => {
        this.applyClusterStyle(clusteredEntities, cluster);
      });
    }

    // 添加到 viewer
    this.viewer.dataSources.add(this.dataSource);

    // 安装点击处理器
    this.installClickHandler();
  }

  /**
   * 设置点数据
   */
  setData(points: ClusterPoint[]): void {
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

      this.dataSource.entities.add({
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
      });
    }

    // 触发重新聚类
    try {
      const clustering: any = (this.dataSource as any).clustering;
      if (clustering && clustering.enabled) {
        clustering._cluster();
      }
    } catch { /* ignore */ }
  }

  /**
   * 应用聚类样式
   */
  private applyClusterStyle(clusteredEntities: Entity[], cluster: Entity): void {
    const count = clusteredEntities.length;
    const style = this.pickStyle(count);

    // 隐藏 billboard
    (cluster as any).billboard && ((cluster as any).billboard.show = false);

    // 设置点样式
    if ((cluster as any).point) {
      (cluster as any).point.show = true;
      (cluster as any).point.pixelSize = style.pixelSize ?? this.options.clusterPixelSize;
      (cluster as any).point.color = toCesiumColor(style.color);
      (cluster as any).point.outlineColor = Cesium.Color.WHITE.withAlpha(0.85);
      (cluster as any).point.outlineWidth = 2;
      (cluster as any).point.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    }

    // 设置标签样式
    if ((cluster as any).label) {
      (cluster as any).label.show = true;
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

    // 存储聚合点信息供点击时使用
    (cluster as any).__vmapClusterLayerId = this.layerId;
    (cluster as any).__vmapClusteredEntityIds = clusteredEntities.map(e => String((e as any).id));
  }

  /**
   * 选择样式
   */
  private pickStyle(count: number): ClusterStyleStep {
    const steps = this.options.clusterStyleSteps;
    if (!steps || steps.length === 0) {
      return { minCount: 2, color: Cesium.Color.DODGERBLUE, pixelSize: this.options.clusterPixelSize };
    }

    const sorted = steps.slice().sort((a, b) => b.minCount - a.minCount);
    for (const s of sorted) {
      if (count >= s.minCount) return s;
    }
    return sorted[sorted.length - 1];
  }

  /**
   * 安装点击处理器
   */
  private installClickHandler(): void {
    if (!this.options.onClusterClick && !this.options.onPointClick) return;

    this.clickHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    this.clickHandler.setInputAction((movement: any) => {
      const pos: Cesium.Cartesian2 = movement?.position;
      if (!pos) return;

      const picked = this.viewer.scene.pick(pos);
      if (!picked) return;

      const pickedId: any = (picked as any).id;
      if (!pickedId) return;

      const entity = pickedId as Entity & {
        __vmapClusterLayerId?: string;
        __vmapClusteredEntityIds?: string[];
      };

      if (entity.__vmapClusterLayerId !== this.layerId) return;

      const clusteredIds = entity.__vmapClusteredEntityIds;
      const worldPos = (entity as any).position?.getValue?.(Cesium.JulianDate.now());

      if (Array.isArray(clusteredIds) && clusteredIds.length > 1) {
        if (!this.options.onClusterClick) return;
        const points: ClusterPoint[] = [];
        for (const id of clusteredIds) {
          const p = this.entityIdToPoint.get(String(id));
          if (p) points.push(p);
        }
        this.options.onClusterClick(points);
        return;
      }

      // 单点
      if (!this.options.onPointClick) return;
      const id = String((entity as any).id);
      const p = this.entityIdToPoint.get(id);
      if (!p) return;
      this.options.onPointClick(p);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  /**
   * 设置可见性
   */
  setVisible(visible: boolean): void {
    (this.dataSource as any).show = visible;
  }

  /**
   * 设置聚类开关
   */
  setClusteringEnabled(enabled: boolean): void {
    const clustering: any = (this.dataSource as any).clustering;
    if (clustering) clustering.enabled = enabled;
  }

  /**
   * 销毁图层
   */
  destroy(): void {
    try {
      if (this.clickHandler) {
        this.clickHandler.destroy();
        this.clickHandler = null;
      }
    } catch { /* ignore */ }

    try {
      this.viewer.dataSources.remove(this.dataSource, true);
    } catch { /* ignore */ }

    this.entityIdToPoint.clear();
  }
}