# MapSVG API 文档

## 概述

`MapSVG` 用于创建和管理 SVG 覆盖物（内部将 SVG 转为 data URL，使用 `Entity.billboard`）。

## 导入方式

```ts
import { MapSVG } from '@xingm/vmap-cesium-toolbar';
```

```ts
const svgTool = new MapSVG(viewer);
const svg = svgTool.add({
  position: [116.3974, 39.9093],
  svg: '<svg viewBox="0 0 24 24">...</svg>',
});
```

## 构造函数

```ts
constructor(viewer: Cesium.Viewer)
```

## SvgOptions

- `position`: OverlayPosition（必填）
- `svg`: string（必填，SVG 字符串）
- `width`: number
- `height`: number
- `scale`: number，默认 1.0
- `rotation`: number
- `pixelOffset`: Cesium.Cartesian2
- `eyeOffset`: Cesium.Cartesian3
- `horizontalOrigin`: Cesium.HorizontalOrigin，默认 CENTER
- `verticalOrigin`: Cesium.VerticalOrigin，默认 BOTTOM
- `heightReference`: Cesium.HeightReference，默认 NONE
- `disableDepthTestDistance`: number，默认 Infinity
- `color`: Color | string
- `clickHighlight`: boolean | { color?: Color | string; fillAlpha?: number }，默认 false
- `hoverHighlight`: boolean | { color?: Color | string; fillAlpha?: number }，默认 false
- `onClick`: (entity: Entity) => void
- `id`: string

> OverlayPosition 说明见 [CesiumOverlayService API](/api/CesiumOverlayService_API)。

## 方法

### add

```ts
add(options: SvgOptions): Cesium.Entity
```

创建 SVG 覆盖物并返回实体。

### updatePosition

```ts
updatePosition(entity: Entity, position: OverlayPosition): void
```

更新位置。

### updateSvg

```ts
updateSvg(entity: Entity, svg: string): void
```

更新 SVG 内容。

### updateStyle

```ts
updateStyle(entity: Entity, options: Partial<Pick<SvgOptions, 'scale' | 'rotation' | 'color'>>): void
```

更新样式。

### remove

```ts
remove(entityOrId: Entity | string): boolean
```

移除覆盖物。

## 示例

```ts
const svg = overlay.svg.add({
  position: [116.3974, 39.9093],
  svg: '<svg viewBox="0 0 24 24">...</svg>',
  scale: 1.1,
});

overlay.svg.updateSvg(svg, '<svg viewBox="0 0 24 24">...</svg>');
```

## 常见用法组合示例

### 1) 创建 + 更新 SVG + 更新位置

```ts
const svg = overlay.svg.add({
  position: [116.3974, 39.9093],
  svg: '<svg viewBox="0 0 24 24">...</svg>',
  scale: 1.1,
});

overlay.svg.updateSvg(svg, '<svg viewBox="0 0 24 24">...</svg>');
overlay.svg.updatePosition(svg, [121.4737, 31.2304]);
```

### 2) 更新样式（缩放/旋转/着色）

```ts
overlay.svg.updateStyle(svg, {
  scale: 1.2,
  rotation: Math.PI / 8,
  color: '#ffcc00',
});
```
