# CesiumPointClusterLayer（PointClusterLayer）API 文档

## 概述

`CesiumPointClusterLayer`（对外导出名：`PointClusterLayer`）用于在 Cesium 场景中展示“海量点位的聚合效果”：

- 当点位很密集时，自动将屏幕空间相近的点合并为一个“聚合点”，避免重叠、难点选、性能下降
- 聚合点可显示数量（label）
- 可按聚合数量（count）做“热度分段”（例如：数量越大颜色越红、圆越大）
- 支持点击回调：
  - 点击聚合点 → 回调返回该聚合内的原始点列表
  - 点击单点 → 回调返回单点数据

实现基于 `Cesium.CustomDataSource + dataSource.clustering`，属于 Cesium 原生聚类能力的轻量封装。

源码位于：`src/libs/CesiumPointClusterLayer.ts`。

## 安装与导入

```ts
import { PointClusterLayer } from '@xingm/vmap-cesium-toolbar';
import type { ClusterPoint, PointClusterLayerOptions, ClusterStyleStep } from '@xingm/vmap-cesium-toolbar';
```

## 基本用法

```ts
import * as Cesium from 'cesium';
import { PointClusterLayer } from '@xingm/vmap-cesium-toolbar';

const layer = new PointClusterLayer(viewer, {
  pixelRange: 60,
  minimumClusterSize: 2,
  // 颜色/大小分段：count 越大越“热”
  clusterStyleSteps: [
    { minCount: 200, color: Cesium.Color.RED, pixelSize: 30 },
    { minCount: 80, color: Cesium.Color.ORANGE, pixelSize: 26 },
    { minCount: 20, color: Cesium.Color.YELLOW, pixelSize: 22 },
    { minCount: 2, color: Cesium.Color.DODGERBLUE, pixelSize: 18 },
  ],
  onClusterClick: (points) => {
    console.log('cluster size=', points.length);
    // points 是聚合内的原始点数组
  },
  onPointClick: (point) => {
    console.log('single point', point);
  },
});

layer.setData([
  { id: 'a', lon: 120.2, lat: 30.25, properties: { name: '设备A' } },
  { id: 'b', lon: 120.2003, lat: 30.2502, properties: { name: '设备B' } },
]);

layer.setVisible(true);

// 清空数据（保留图层对象）
layer.setData([]);

// 彻底销毁
layer.destroy();
```

## 数据类型

### ClusterPoint

```ts
export interface ClusterPoint {
  id?: string;
  lon: number;
  lat: number;
  height?: number;
  value?: number;
  properties?: Record<string, unknown>;
}
```

- `lon/lat`：经纬度（单位：度）
- `height`：高度（米），不传默认 `0`
- `id`：建议传入业务 id，便于稳定更新（内部会作为 entity id 的一部分）
- `properties`：透传到 Cesium entity.properties，点击回调中也会带回来

## 构造函数

```ts
constructor(viewer: Cesium.Viewer, options?: PointClusterLayerOptions)
```

创建时会：

- `viewer.dataSources.add(customDataSource)`
- 根据 `options` 初始化 `dataSource.clustering`
- 若提供点击回调（`onClusterClick/onPointClick`），会注册 `ScreenSpaceEventHandler(LEFT_CLICK)`

## 配置参数

### PointClusterLayerOptions

```ts
export interface PointClusterLayerOptions {
  id?: string;

  pointPixelSize?: number;
  pointColor?: Cesium.Color | string;
  clampToGround?: boolean;

  clusteringEnabled?: boolean;
  pixelRange?: number;
  minimumClusterSize?: number;

  clusterPixelSize?: number;
  clusterStyleSteps?: ClusterStyleStep[];

  renderCluster?: (args: { cluster: Entity; clusteredEntities: Entity[]; count: number }) => void;
  renderSinglePoint?: (args: { entity: Entity; point: ClusterPoint }) => void;

  onClusterClick?: (
    points: ClusterPoint[],
    ctx: { screenPosition: Cesium.Cartesian2; worldPosition?: Cesium.Cartesian3 }
  ) => void;

  onPointClick?: (
    point: ClusterPoint,
    ctx: { screenPosition: Cesium.Cartesian2; worldPosition?: Cesium.Cartesian3 }
  ) => void;

  idPrefix?: string;
}
```

#### 聚类相关

- `clusteringEnabled`：是否启用聚类，默认 `true`
- `pixelRange`：聚类半径（像素），越大越容易聚合，默认 `50`
- `minimumClusterSize`：聚合成簇的最小点数，默认 `2`

#### 单点样式

- `pointPixelSize`：单点圆点大小，默认 `8`
- `pointColor`：单点颜色，默认 `Cesium.Color.CYAN`
- `clampToGround`：是否贴地，默认 `true`

#### 聚合点样式

- `clusterPixelSize`：聚合点默认大小，默认 `18`
- `clusterStyleSteps`：按聚合数量 count 决定颜色/大小（见下方）
- `renderCluster`：自定义聚合点渲染（直接修改 cluster entity）
- `renderSinglePoint`：自定义单点渲染（直接修改 point entity）

### ClusterStyleStep

```ts
export interface ClusterStyleStep {
  minCount: number;
  color: Cesium.Color | string;
  pixelSize?: number;
}
```

匹配规则：按 `minCount` 从大到小匹配，命中第一个 `count >= minCount` 的样式。

## 自定义聚合点样式

当你需要更复杂的样式（例如使用 `billboard`、自定义 `label` 字体或特殊效果）时，可传入 `renderCluster`。该回调每次聚类更新都会触发，你可以直接修改 `cluster` 的 point/label/billboard。

```ts
import * as Cesium from 'cesium';
import { PointClusterLayer } from '@xingm/vmap-cesium-toolbar';

const layer = new PointClusterLayer(viewer, {
  renderCluster: ({ cluster, count }) => {
    // 关闭默认 point，改用 billboard + label
    if ((cluster as any).point) (cluster as any).point.show = false;

    if ((cluster as any).billboard) {
      (cluster as any).billboard.show = true;
      (cluster as any).billboard.image = '/img/cluster-pin.png';
      (cluster as any).billboard.scale = count > 100 ? 1.4 : 1.1;
      (cluster as any).billboard.verticalOrigin = Cesium.VerticalOrigin.BOTTOM;
      (cluster as any).billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    }

    if ((cluster as any).label) {
      (cluster as any).label.show = true;
      (cluster as any).label.text = String(count);
      (cluster as any).label.font = 'bold 14px sans-serif';
      (cluster as any).label.fillColor = Cesium.Color.WHITE;
      (cluster as any).label.outlineColor = Cesium.Color.BLACK.withAlpha(0.6);
      (cluster as any).label.outlineWidth = 3;
      (cluster as any).label.pixelOffset = new Cesium.Cartesian2(0, -14);
      (cluster as any).label.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    }
  },
});
```

如果需要自定义单点样式，可用 `renderSinglePoint`：

```ts
const layer = new PointClusterLayer(viewer, {
  renderSinglePoint: ({ entity }) => {
    if (!entity.point) return;
    entity.point.color = Cesium.Color.DEEPSKYBLUE.withAlpha(0.85);
    entity.point.outlineWidth = 2;
  },
});
```

## 方法

### setData

```ts
setData(points: ClusterPoint[]): void
```

- 替换当前图层数据
- 内部会 `removeAll()` 后重新添加 entities
- 传入空数组会清空数据并停止展示

### setVisible

```ts
setVisible(visible: boolean): void
```

控制整个 DataSource 显隐。

### setClusteringEnabled

```ts
setClusteringEnabled(enabled: boolean): void
```

动态开启/关闭 Cesium clustering。

### destroy

```ts
destroy(): void
```

- 移除点击 handler
- 从 `viewer.dataSources` 移除该图层并释放

## 点击回调说明

- 聚合点点击：`onClusterClick(points, ctx)`
  - `points` 是该簇内的原始点数组
  - `ctx.screenPosition` 为鼠标屏幕坐标
  - `ctx.worldPosition` 为 pick 到的世界坐标（若可获取）

- 单点点击：`onPointClick(point, ctx)`

## Vue3（示例项目）接入

仓库示例中提供了 composition hook：`src/hooks/usePointClusterHelper.ts`。

```ts
import { usePointClusterHelper } from './hooks/usePointClusterHelper';

const { initCluster, updateClusterData, setClusterVisible, destroyCluster } = usePointClusterHelper(viewer);

initCluster({
  pixelRange: 60,
  onClusterClick: (points) => console.log(points),
});

updateClusterData([{ lon: 120.2, lat: 30.25 }]);
setClusterVisible(true);

// onBeforeUnmount 时 destroyCluster() 即可
```

## 性能与建议

- **推荐点量级**：`< 1 万` 以内通常 `CustomDataSource + clustering` 足够好用
- 如果点位达到 `1 万~10 万`：建议按业务分页/视域加载，避免一次性 setData 全量
- 如果 `> 10 万`：建议考虑 primitive + worker 空间索引/瓦片化加载（当前封装未覆盖此场景）

> 说明：聚类是屏幕空间行为，缩放/平移会触发 Cesium 内部重新聚类。
