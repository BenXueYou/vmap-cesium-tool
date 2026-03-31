# MapPolyline API 文档

## 概述

`MapPolyline` 用于创建和管理折线覆盖物（Cesium `Entity.polyline`）。

## 导入方式

```ts
import { MapPolyline } from '@xingm/vmap-cesium-toolbar';
```

```ts
const polylineTool = new MapPolyline(viewer);
const line = polylineTool.add({
  positions: [[116.3, 39.9], [116.4, 39.95]],
});
```

## 构造函数

```ts
constructor(viewer: Cesium.Viewer)
```

## PolylineOptions

- `positions`: OverlayPosition[]（必填）
- `width`: number，默认 2
- `material`: Cesium.MaterialProperty | Color | string，默认 yellow
- `clampToGround`: boolean，默认 false
- `clickHighlight`: boolean | { color?: Color | string; fillAlpha?: number }，默认 false
- `hoverHighlight`: boolean | { color?: Color | string; fillAlpha?: number }，默认 false
- `onClick`: (entity: Entity) => void
- `id`: string

> OverlayPosition 说明见 [CesiumOverlayService API](/api/CesiumOverlayService_API)。

## 方法

### add

```ts
add(options: PolylineOptions): Cesium.Entity
```

创建折线并返回实体。

### updatePositions

```ts
updatePositions(entity: Entity, positions: OverlayPosition[]): void
```

更新折线坐标点。

### updateStyle

```ts
updateStyle(entity: Entity, options: Partial<Pick<PolylineOptions, 'width' | 'material'>>): void
```

更新折线样式。

### remove

```ts
remove(entityOrId: Entity | string): boolean
```

移除折线。

## 示例

```ts
const line = overlay.polyline.add({
  positions: [[116.3, 39.9], [116.4, 39.95]],
  width: 3,
  material: '#00a2ff',
});

overlay.polyline.updatePositions(line, [[116.3, 39.9], [116.5, 40.0]]);
```

## 常见用法组合示例

### 1) 贴地折线 + 更新点

```ts
const line = overlay.polyline.add({
  positions: [[116.3, 39.9], [116.4, 40.0], [116.5, 40.1]],
  clampToGround: true,
  material: '#00a2ff',
});

overlay.polyline.updatePositions(line, [[116.3, 39.9], [116.6, 40.1]]);
```

### 2) 更新样式

```ts
overlay.polyline.updateStyle(line, {
  width: 4,
  material: '#ff3b30',
});
```
