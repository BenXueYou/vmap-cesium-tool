# MapIcon API 文档

## 概述

`MapIcon` 用于创建和管理图标覆盖物（Cesium `Entity.billboard`）。

## 导入方式

```ts
import { MapIcon } from '@xingm/vmap-cesium-toolbar';
```

```ts
const iconTool = new MapIcon(viewer);
const icon = iconTool.add({
  position: [116.3974, 39.9093],
  image: '/icons/pin.png',
});
```

## 构造函数

```ts
constructor(viewer: Cesium.Viewer)
```

## IconOptions

- `position`: OverlayPosition（必填）
- `image`: string（必填，URL 或 base64）
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
add(options: IconOptions): Cesium.Entity
```

创建图标并返回实体。

### updatePosition

```ts
updatePosition(entity: Entity, position: OverlayPosition): void
```

更新图标位置。

### updateImage

```ts
updateImage(entity: Entity, image: string): void
```

更新图标图片。

### updateStyle

```ts
updateStyle(entity: Entity, options: Partial<Pick<IconOptions, 'scale' | 'rotation' | 'color'>>): void
```

更新图标样式。

### remove

```ts
remove(entityOrId: Entity | string): boolean
```

移除图标。

## 示例

```ts
const icon = overlay.icon.add({
  position: [116.3974, 39.9093],
  image: '/icons/pin.png',
  scale: 1.2,
});

overlay.icon.updateImage(icon, '/icons/pin-active.png');
```

## 常见用法组合示例

### 1) 创建 + 更新图片 + 更新位置

```ts
const icon = overlay.icon.add({
  position: [116.3974, 39.9093],
  image: '/icons/pin.png',
  scale: 1.1,
});

overlay.icon.updateImage(icon, '/icons/pin-active.png');
overlay.icon.updatePosition(icon, [121.4737, 31.2304]);
```

### 2) 更新样式（缩放/旋转/着色）

```ts
overlay.icon.updateStyle(icon, {
  scale: 1.3,
  rotation: Math.PI / 6,
  color: '#00a2ff',
});
```
