# MapMarker API 文档

## 概述

`MapMarker` 用于创建和管理点标记（Cesium `Entity.point`）。

## 导入方式

```ts
import { MapMarker } from '@xingm/vmap-cesium-toolbar';
```

```ts
const markerTool = new MapMarker(viewer);
const marker = markerTool.add({
  position: [116.3974, 39.9093],
  pixelSize: 10,
});
```

## 构造函数

```ts
constructor(viewer: Cesium.Viewer)
```

## MarkerOptions

- `position`: OverlayPosition（必填）
- `pixelSize`: number，默认 10
- `color`: Cesium.Color | string，默认 red
- `outlineColor`: Cesium.Color | string，默认 white
- `outlineWidth`: number，默认 2
- `heightReference`: Cesium.HeightReference，默认 NONE
- `scaleByDistance`: Cesium.NearFarScalar
- `disableDepthTestDistance`: number，默认 Infinity
- `clickHighlight`: boolean | { color?: Color | string; fillAlpha?: number }，默认 false
- `hoverHighlight`: boolean | { color?: Color | string; fillAlpha?: number }，默认 false
- `onClick`: (entity: Entity) => void
- `id`: string

> OverlayPosition 说明见 [CesiumOverlayService API](/api/CesiumOverlayService_API)。

## 方法

### add

```ts
add(options: MarkerOptions): Cesium.Entity
```

创建点标记并返回实体。若未提供 `id`，内部会生成唯一 id。

### updatePosition

```ts
updatePosition(entity: Entity, position: OverlayPosition): void
```

更新点位置。

### updateStyle

```ts
updateStyle(entity: Entity, options: Partial<Pick<MarkerOptions, 'color' | 'outlineColor' | 'outlineWidth' | 'pixelSize'>>): void
```

更新点样式。

### remove

```ts
remove(entityOrId: Entity | string): boolean
```

移除点标记。

## 示例

```ts
const marker = overlay.marker.add({
  position: [116.3974, 39.9093],
  pixelSize: 12,
  color: '#ff3b30',
  clickHighlight: true,
});

overlay.marker.updatePosition(marker, [121.4737, 31.2304]);
```

## 常见用法组合示例

### 1) 创建 + 点击高亮 + 更新位置

```ts
const marker = overlay.marker.add({
  position: [116.3974, 39.9093],
  color: '#ff3b30',
  clickHighlight: true,
  onClick: (entity) => console.log('marker', entity.id),
});

overlay.marker.updatePosition(marker, [121.4737, 31.2304]);
```

### 2) 更新样式

```ts
overlay.marker.updateStyle(marker, {
  pixelSize: 14,
  outlineColor: '#ffffff',
  outlineWidth: 3,
});
```
