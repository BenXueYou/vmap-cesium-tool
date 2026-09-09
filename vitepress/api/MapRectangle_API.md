# MapRectangle API 文档

## 概述

`MapRectangle` 用于创建和管理矩形覆盖物，支持 `entity` 与 `primitive` 模式。

## 导入方式

```ts
import { MapRectangle } from '@xingm/vmap-cesium-toolbar';
```

```ts
const rectTool = new MapRectangle(viewer);
const rect = rectTool.add({
  coordinates: Cesium.Rectangle.fromDegrees(116.3, 39.9, 116.6, 40.1),
});
```

## 构造函数

```ts
constructor(viewer: Cesium.Viewer)
```

## RectangleOptions

- `coordinates`: Cesium.Rectangle（必填）
- `renderMode`: 'auto' | 'entity' | 'primitive'，默认 auto
- `material`: Cesium.MaterialProperty | Color | string，默认 BLUE(0.5)
- `outline`: boolean，默认 true
- `outlineColor`: Color | string，默认 black
- `outlineWidth`: number，默认 1
- `clampToGround`: boolean，默认 true（粗边框模式下默认贴地）
- `height`: number（clampToGround=false 时基准高度）
- `heightReference`: Cesium.HeightReference
- `extrudedHeight`: number
- `heightEpsilon`: number（高度容差，避免共面深度冲突）
- `clickHighlight`: boolean | { color?: Color | string; fillAlpha?: number }，默认 false
- `hoverHighlight`: boolean | { color?: Color | string; fillAlpha?: number }，默认 false
- `onClick`: (entity: Entity) => void
- `layerKey`: string（primitive 分层渲染 key）
- `id`: string

### renderMode 说明

- `auto`：在“粗边框 + 贴地 + 纯色材质”场景下自动使用 primitive。
- `primitive`：适用于大批量静态贴地；不支持 extrudedHeight 或复杂材质。

## 方法

### add

```ts
add(options: RectangleOptions): Cesium.Entity
```

创建矩形并返回实体。

### updateCoordinates

```ts
updateCoordinates(entity: Entity, coordinates: Cesium.Rectangle): void
```

更新矩形范围。

### updateStyle

```ts
updateStyle(entity: Entity, options: Partial<Pick<RectangleOptions, 'material' | 'outline' | 'outlineColor' | 'outlineWidth'>>): void
```

更新样式。

### remove

```ts
remove(entityOrId: Entity | string): boolean
```

移除矩形。

### setPrimitiveVisible

```ts
setPrimitiveVisible(entity: Entity, visible: boolean): void
```

仅对 primitive 矩形生效，切换可见性。

### applyPrimitiveHighlight

```ts
applyPrimitiveHighlight(entity: OverlayEntity, hlColor: Cesium.Color, fillAlpha: number): void
```

对 primitive 矩形应用高亮样式。

### restorePrimitiveHighlight

```ts
restorePrimitiveHighlight(entity: OverlayEntity): void
```

恢复 primitive 高亮样式。

## 示例

```ts
const rect = overlay.rectangle.add({
  coordinates: Cesium.Rectangle.fromDegrees(116.3, 39.9, 116.6, 40.1),
  outlineWidth: 2,
});

overlay.rectangle.updateCoordinates(rect, Cesium.Rectangle.fromDegrees(116.2, 39.8, 116.7, 40.2));
```

## 常见用法组合示例

### 1) 粗边框 + 贴地（适配 primitive）

```ts
const rect = overlay.rectangle.add({
  coordinates: Cesium.Rectangle.fromDegrees(116.3, 39.9, 116.6, 40.1),
  outlineWidth: 4,
  outlineColor: '#00f5ff',
  material: '#0a84ff',
  clampToGround: true,
  renderMode: 'auto',
});
```

### 2) 更新范围 + 更新样式

```ts
overlay.rectangle.updateCoordinates(rect, Cesium.Rectangle.fromDegrees(116.2, 39.8, 116.7, 40.2));
overlay.rectangle.updateStyle(rect, { outlineWidth: 2, outlineColor: '#ffcc00' });
```
