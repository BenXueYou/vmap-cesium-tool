# MapInfoWindow API 文档

## 概述

`MapInfoWindow` 用于创建和管理基于 HTML 的信息窗。

## 导入方式

```ts
import { MapInfoWindow } from '@xingm/vmap-cesium-toolbar';
```

```ts
const container = viewer.container;
const infoTool = new MapInfoWindow(viewer, container);
const win = infoTool.add({
  position: [116.3974, 39.9093],
  content: '北京',
});
```

## 构造函数

```ts
constructor(viewer: Cesium.Viewer, container: HTMLElement)
```

`container` 需要是有效的 DOM 容器，通常与 `viewer.canvas` 同级或包裹，并具备 `position: relative`。

## InfoWindowOptions

- `position`: OverlayPosition（必填）
- `content`: string | HTMLElement（必填）
- `width`: number
- `height`: number
- `pixelOffset`: Cesium.Cartesian2（x 向右，y 向上，单位 CSS 像素）
- `show`: boolean，默认 true
- `onClick`: (entity: Entity) => void
- `id`: string
- `closable`: boolean
- `onClose`: (entity: Entity) => void
- `backgroundColor`: string
- `color`: string
- `font`: string
- `className`: string（自定义 class）
- `style`: Partial<CSSStyleDeclaration />
- `showArrow`: boolean，默认 false
- `arrowSize`: number，默认 8
- `positionOffset`: 位置方向，默认 top
- `hideWhenOutOfView`: boolean，默认 true
- `anchorHeight`: number，默认 10
- `anchorPixel`: number
- `tailGap`: number，默认 8
- `updateInterval`: number，默认 0

> OverlayPosition 说明见 [CesiumOverlayService API](/api/CesiumOverlayService_API)。

## 方法

### setDefaultUpdateInterval

```ts
setDefaultUpdateInterval(ms: number): void
```

设置未指定 `updateInterval` 时的默认节流间隔。

### forceUpdateAll

```ts
forceUpdateAll(): void
```

强制刷新全部信息窗位置。

### bringToFront

```ts
bringToFront(entity: Entity): void
```

将指定信息窗置于最上层。

### add

```ts
add(options: InfoWindowOptions): Entity
```

创建信息窗并返回实体。

### updatePosition

```ts
updatePosition(entity: Entity, position: OverlayPosition): void
```

更新位置。

### updateContent

```ts
updateContent(entity: Entity, content: string | HTMLElement): void
```

更新内容。

### setVisible

```ts
setVisible(entity: Entity, visible: boolean): void
```

设置显隐。

### show / hide

```ts
show(entity: Entity): void
hide(entity: Entity): void
```

显示或隐藏信息窗。

### remove

```ts
remove(entity: Entity): void
```

移除信息窗。

### destroy

```ts
destroy(): void
```

销毁管理器并清理资源。

## 示例

```ts
const win = overlay.infoWindow.add({
  position: [116.3974, 39.9093],
  content: '北京',
  showArrow: true,
});

overlay.infoWindow.updateContent(win, '上海');
```

## 常见用法组合示例

### 1) 创建 + 更新内容 + 显隐控制

```ts
const win = overlay.infoWindow.add({
  position: [116.3974, 39.9093],
  content: '北京',
  showArrow: true,
});

overlay.infoWindow.updateContent(win, '上海');
overlay.infoWindow.setVisible(win, false);
overlay.infoWindow.setVisible(win, true);
```

### 2) 自定义样式 + 关闭按钮

```ts
const win = overlay.infoWindow.add({
  position: [116.4, 39.9],
  content: '<b>自定义样式</b>',
  closable: true,
  className: 'custom-info-window',
  style: { padding: '8px 10px', borderRadius: '6px' },
});
```
