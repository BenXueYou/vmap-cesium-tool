# MapRing API 文档

## 概述

`MapRing` 用于创建和管理发光圆环（polyline + glow）。

## 导入方式

```ts
import { MapRing } from '@xingm/vmap-cesium-toolbar';
```

```ts
const ringTool = new MapRing(viewer);
const ring = ringTool.add({
  position: [116.3974, 39.9093],
  radius: 1000,
});
```

## 构造函数

```ts
constructor(viewer: Cesium.Viewer)
```

## RingOptions

- `position`: OverlayPosition（必填）
- `radius`: number（必填，米）
- `color`: Color | string（发光颜色）
- `showInnerLine`: boolean，默认 true
- `lineColor`: Color | string
- `lineStyle`: 'solid' | 'dashed'，默认 solid
- `lineMaterialMode`: 'stripe' | 'dash'，默认 stripe
- `stripeRepeat`: number，默认 32
- `dashLength`: number，默认 16
- `dashPattern`: number
- `gapColor`: Color | string
- `width`: number（外层线宽）
- `glowWidth`: number（外层发光线宽，优先于 width）
- `lineWidth`: number（内层实线线宽）
- `glowPower`: number（0-1）
- `clampToGround`: boolean，默认 true
- `segments`: number，默认 128
- `onClick`: (entity: Entity) => void
- `clickHighlight`: boolean | { color?: Color | string; fillAlpha?: number }，默认 false
- `hoverHighlight`: boolean | { color?: Color | string; fillAlpha?: number }，默认 false
- `id`: string

## 方法

### add

```ts
add(options: RingOptions): Cesium.Entity
```

创建圆环并返回实体。

### updatePosition

```ts
updatePosition(entity: Entity, position: OverlayPosition): void
```

更新圆心位置。

### updateRadius

```ts
updateRadius(entity: Entity, radius: number): void
```

更新半径（米）。

### updateStyle

```ts
updateStyle(entity: Entity, options: Partial<RingOptions>): void
```

更新圆环样式（颜色/线型/发光/宽度等）。

### setVisible

```ts
setVisible(entity: Entity, visible: boolean): void
```

切换圆环可见性。

### remove

```ts
remove(entityOrId: Entity | string): boolean
```

移除圆环。

## 示例

```ts
const ring = overlay.ring.add({
  position: [116.3974, 39.9093],
  radius: 1000,
  color: '#00f5ff',
  glowPower: 0.3,
});

overlay.ring.updateRadius(ring, 1500);
```

## 常见用法组合示例

### 1) 发光圆环 + 贴地

```ts
const ring = overlay.ring.add({
  position: [116.3974, 39.9093],
  radius: 1000,
  color: '#00f5ff',
  glowPower: 0.3,
  clampToGround: true,
});
```

### 2) 虚线内层 + 样式调整

```ts
overlay.ring.updateStyle(ring, {
  lineStyle: 'dashed',
  lineMaterialMode: 'dash',
  dashLength: 12,
  lineColor: '#ffffff',
  glowWidth: 6,
});
```
