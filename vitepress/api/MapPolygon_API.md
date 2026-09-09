# MapPolygon API 文档

## 概述

`MapPolygon` 用于创建和管理多边形覆盖物，支持 `entity` 与 `primitive` 模式。

## 导入方式

```ts
import { MapPolygon } from '@xingm/vmap-cesium-toolbar';
```

```ts
const polygonTool = new MapPolygon(viewer);
const poly = polygonTool.add({
  positions: [[116.3, 39.9], [116.5, 39.9], [116.4, 40.1]],
});
```

## 构造函数

```ts
constructor(viewer: Cesium.Viewer)
```

## PolygonOptions

- `positions`: OverlayPosition[]（必填）
- `renderMode`: 'auto' | 'entity' | 'primitive'，默认 auto
- `material`: Cesium.MaterialProperty | Color | string，默认 ORANGE(0.5)
- `outline`: boolean，默认 true
- `outlineColor`: Color | string，默认 black
- `outlineWidth`: number，默认 1
- `clampToGround`: boolean，默认 true（粗边框模式下默认贴地）
- `heightReference`: Cesium.HeightReference
- `extrudedHeight`: number
- `clickHighlight`: boolean | { color?: Color | string; fillAlpha?: number }，默认 false
- `hoverHighlight`: boolean | { color?: Color | string; fillAlpha?: number }，默认 false
- `onClick`: (entity: Entity) => void
- `layerKey`: string（primitive 分层渲染 key）
- `id`: string

> OverlayPosition 说明见 [CesiumOverlayService API](/api/CesiumOverlayService_API)。

### renderMode 说明

- `auto`：在“粗边框 + 贴地 + 纯色材质”场景下自动使用 primitive；否则使用 entity。
- `primitive`：适用于大批量静态贴地；不支持 extrudedHeight 或复杂材质。

## 方法

### add

```ts
add(options: PolygonOptions): Cesium.Entity
```

创建多边形并返回实体。

### updatePositions

```ts
updatePositions(entity: Entity, positions: OverlayPosition[]): void
```

更新多边形顶点。

### updateStyle

```ts
updateStyle(entity: Entity, options: Partial<Pick<PolygonOptions, 'material' | 'outline' | 'outlineColor' | 'outlineWidth'>>): void
```

更新样式。

### remove

```ts
remove(entityOrId: Entity | string): boolean
```

移除多边形。

### setPrimitiveVisible

```ts
setPrimitiveVisible(entity: Entity, visible: boolean): void
```

仅对 primitive 多边形生效，切换可见性。

### applyPrimitiveHighlight

```ts
applyPrimitiveHighlight(entity: OverlayEntity, hlColor: Cesium.Color, fillAlpha: number): void
```

对 primitive 多边形应用高亮样式。

### restorePrimitiveHighlight

```ts
restorePrimitiveHighlight(entity: OverlayEntity): void
```

恢复 primitive 高亮样式。

## 示例

```ts
const poly = overlay.polygon.add({
  positions: [[116.3, 39.9], [116.5, 39.9], [116.4, 40.1]],
  material: '#ffcc00',
  outlineWidth: 2,
});

overlay.polygon.updatePositions(poly, [[116.3, 39.9], [116.6, 39.9], [116.4, 40.1]]);
```

## 常见用法组合示例

### 1) 粗边框 + 贴地（适配 primitive）

```ts
const poly = overlay.polygon.add({
  positions: [[116.3, 39.9], [116.6, 39.9], [116.5, 40.1]],
  outlineWidth: 4,
  outlineColor: '#00f5ff',
  material: '#0a84ff',
  clampToGround: true,
  renderMode: 'auto',
});
```

### 2) 更新坐标 + 更新样式

```ts
overlay.polygon.updatePositions(poly, [[116.2, 39.9], [116.7, 39.9], [116.4, 40.2]]);
overlay.polygon.updateStyle(poly, { outlineWidth: 2, outlineColor: '#ffcc00' });
```
