# MapCircle API 文档

## 概述

`MapCircle` 用于创建和管理圆形覆盖物，支持 `entity` 与 `primitive` 模式，并支持粗边框模式。

## 导入方式

```ts
import { MapCircle } from '@xingm/vmap-cesium-toolbar';
```

```ts
const circleTool = new MapCircle(viewer);
const circle = circleTool.add({
  position: [116.3974, 39.9093],
  radius: 800,
});
```

## 构造函数

```ts
constructor(viewer: Cesium.Viewer)
```

## CircleOptions

- `position`: OverlayPosition（必填）
- `radius`: number（必填，米）
- `renderMode`: 'auto' | 'entity' | 'primitive'，默认 auto
- `material`: Cesium.MaterialProperty | Color | string，默认 BLUE(0.5)
- `outline`: boolean
- `outlineColor`: Color | string，默认 black
- `outlineWidth`: number
- `segments`: number（粗边框模式分段数，默认 256）
- `clampToGround`: boolean，默认 true（粗边框模式下默认贴地）
- `heightReference`: Cesium.HeightReference
- `extrudedHeight`: number
- `heightEpsilon`: number（粗边框模式高度容差）
- `clickHighlight`: boolean | { color?: Color | string; fillAlpha?: number }，默认 false
- `hoverHighlight`: boolean | { color?: Color | string; fillAlpha?: number }，默认 false
- `onClick`: (entity: Entity) => void
- `layerKey`: string（primitive 分层渲染 key）
- `id`: string

### renderMode 说明

- `auto`：当前行为等同 entity，但在满足条件时可能切换到 primitive。
- `primitive`：适用于大批量静态贴地；要求粗边框 + 纯色材质。

## 方法

### add

```ts
add(options: CircleOptions): Cesium.Entity
```

创建圆并返回实体。

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
updateStyle(entity: Entity, options: Partial<Pick<CircleOptions, 'material' | 'outline' | 'outlineColor' | 'outlineWidth'>>): void
```

更新样式。

### remove

```ts
remove(entityOrId: Entity | string): boolean
```

移除圆。

### setPrimitiveVisible

```ts
setPrimitiveVisible(entity: Entity, visible: boolean): void
```

仅对 primitive 圆生效，切换可见性。

### applyPrimitiveHighlight

```ts
applyPrimitiveHighlight(entity: OverlayEntity, hlColor: Cesium.Color, fillAlpha: number): void
```

对 primitive 圆应用高亮样式。

### restorePrimitiveHighlight

```ts
restorePrimitiveHighlight(entity: OverlayEntity): void
```

恢复 primitive 高亮样式。

## 示例

```ts
const circle = overlay.circle.add({
  position: [116.3974, 39.9093],
  radius: 800,
  outlineWidth: 2,
});

overlay.circle.updateRadius(circle, 1200);
```

## 常见用法组合示例

### 1) 创建 + 更新 + 点击高亮

```ts
const circle = overlay.circle.add({
  position: [116.3974, 39.9093],
  radius: 800,
  outlineWidth: 2,
  clickHighlight: true,
  onClick: (entity) => {
    console.log('circle clicked', entity.id);
  },
});

overlay.circle.updatePosition(circle, [116.40, 39.90]);
overlay.circle.updateRadius(circle, 1200);
```

### 2) 贴地粗边框 + 纯色材质（适配 primitive）

```ts
const circle = overlay.circle.add({
  position: [116.3974, 39.9093],
  radius: 1500,
  outlineWidth: 6,
  outlineColor: '#00f5ff',
  material: '#0a84ff',
  clampToGround: true,
  renderMode: 'auto',
});
```

### 3) 悬空圆（非贴地）

```ts
const circle = overlay.circle.add({
  position: [116.3974, 39.9093, 200],
  radius: 1000,
  clampToGround: false,
  heightReference: Cesium.HeightReference.NONE,
});
```
