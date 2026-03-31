# MapLabel API 文档

## 概述

`MapLabel` 用于创建和管理文本标签（Cesium `Entity.label`）。

## 导入方式

```ts
import { MapLabel } from '@xingm/vmap-cesium-toolbar';
```

```ts
const labelTool = new MapLabel(viewer);
const label = labelTool.add({
  position: [116.3974, 39.9093],
  text: '北京',
});
```

## 构造函数

```ts
constructor(viewer: Cesium.Viewer)
```

## LabelOptions

- `position`: OverlayPosition（必填）
- `text`: string（必填）
- `font`: string，默认 `14px sans-serif`
- `fillColor`: Color | string，默认 white
- `outlineColor`: Color | string，默认 black
- `outlineWidth`: number，默认 2
- `style`: Cesium.LabelStyle，默认 FILL_AND_OUTLINE
- `pixelOffset`: Cesium.Cartesian2
- `eyeOffset`: Cesium.Cartesian3
- `horizontalOrigin`: Cesium.HorizontalOrigin，默认 CENTER
- `verticalOrigin`: Cesium.VerticalOrigin，默认 BOTTOM
- `heightReference`: Cesium.HeightReference，默认 NONE
- `scale`: number，默认 1.0
- `showBackground`: boolean，默认 false
- `backgroundColor`: Color | string
- `backgroundPadding`: Cesium.Cartesian2
- `disableDepthTestDistance`: number，默认 Infinity
- `clickHighlight`: boolean | { color?: Color | string; fillAlpha?: number }，默认 false
- `hoverHighlight`: boolean | { color?: Color | string; fillAlpha?: number }，默认 false
- `onClick`: (entity: Entity) => void
- `id`: string

> OverlayPosition 说明见 [CesiumOverlayService API](/api/CesiumOverlayService_API)。

## 方法

### add

```ts
add(options: LabelOptions): Cesium.Entity
```

创建文本标签并返回实体。

### updatePosition

```ts
updatePosition(entity: Entity, position: OverlayPosition): void
```

更新标签位置。

### updateText

```ts
updateText(entity: Entity, text: string): void
```

更新文本内容。

### updateStyle

```ts
updateStyle(entity: Entity, options: Partial<Pick<LabelOptions, 'fillColor' | 'outlineColor' | 'outlineWidth' | 'font' | 'scale'>>): void
```

更新标签样式。

### remove

```ts
remove(entityOrId: Entity | string): boolean
```

移除标签。

## 示例

```ts
const label = overlay.label.add({
  position: [116.3974, 39.9093],
  text: '北京',
  font: '16px sans-serif',
  showBackground: true,
});

overlay.label.updateText(label, '上海');
```

## 常见用法组合示例

### 1) 创建 + 更新文本 + 更新位置

```ts
const label = overlay.label.add({
  position: [116.3974, 39.9093],
  text: '北京',
  showBackground: true,
});

overlay.label.updateText(label, '上海');
overlay.label.updatePosition(label, [121.4737, 31.2304]);
```

### 2) 更新样式

```ts
overlay.label.updateStyle(label, {
  font: '16px sans-serif',
  outlineWidth: 3,
  scale: 1.1,
});
```
