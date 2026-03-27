# OverlayService API 文档

## 概述

`OverlayService` 是新架构下的覆盖物公开服务，负责统一管理点、线、面、信息窗等覆盖物的创建、查询、显示控制、高亮交互和销毁。

它的定位是“覆盖物服务层”，而不是旧版 `CesiumOverlayService` 的直接别名。新项目推荐通过 `MapPlugin` 获取它。

顶层导出：

```ts
import {
  OverlayService,
  type OverlayServiceOptions,
  Marker,
  Label,
  Icon,
  SVG,
  InfoWindow,
  Polyline,
  Polygon,
  Rectangle,
  Circle,
  Ring,
} from '@xingm/vmap-cesium-toolbar';
```

## 推荐接入方式

### 1. 通过 MapPlugin 获取

这是推荐方式。

```ts
import { createMapPlugin } from '@xingm/vmap-cesium-toolbar';

const mapPlugin = createMapPlugin('cesiumContainer', {
  services: {
    overlay: true,
  },
});

await mapPlugin.initialize();

const overlayService = mapPlugin.getOverlayService();
const marker = overlayService.addMarker({
  position: [116.3974, 39.9093],
  pixelSize: 12,
  color: '#ff4d4f',
});
```

### 2. 手动创建

适合不走 `MapPlugin` 统一装配、但仍想复用新覆盖物服务的场景。

```ts
import { OverlayService } from '@xingm/vmap-cesium-toolbar';

const overlayService = new OverlayService(viewer, {
  enableHoverHandler: true,
  clickPickMinIntervalMs: 120,
});
```

## 类定义

```ts
class OverlayService
```

## 构造函数

```ts
constructor(viewer: Viewer, options?: OverlayServiceOptions)
```

### OverlayServiceOptions

```ts
interface OverlayServiceOptions {
  enableHoverHandler?: boolean;
  clickPickMinIntervalMs?: number;
}
```

字段说明：

- `enableHoverHandler`: 是否启用 hover 高亮处理，默认 `true`
- `clickPickMinIntervalMs`: 点击拾取节流间隔，默认 `120ms`

## 返回覆盖物实例

`OverlayService` 的添加方法会返回具体覆盖物实例，例如 `Marker`、`Polygon`、`InfoWindow`。

这些实例都继承自 `BaseOverlay`，因此至少具备这些公共能力：

```ts
getEntity(): Entity
getId(): string
setVisible(show: boolean): void
isVisible(): boolean
update(options): void
remove(): void
destroy(): void
isDestroyed(): boolean
```

## 公开方法

### 查询方法

#### getOverlay

```ts
getOverlay(id: string): OverlayInstance | undefined
```

根据覆盖物 ID 获取实例。

#### getAllOverlayIds

```ts
getAllOverlayIds(): string[]
```

获取当前服务中所有覆盖物的 ID 列表。

### 添加覆盖物

#### addMarker

```ts
addMarker(options: MarkerOptions): Marker
```

#### addLabel

```ts
addLabel(options: LabelOptions): Label
```

#### addIcon

```ts
addIcon(options: IconOptions): Icon
```

#### addSvg

```ts
addSvg(options: SvgOptions): SVG
```

#### addInfoWindow

```ts
addInfoWindow(options: InfoWindowOptions): InfoWindow
```

#### addPolyline

```ts
addPolyline(options: PolylineOptions): Polyline
```

#### addPolygon

```ts
addPolygon(options: PolygonOptions): Polygon
```

#### addRectangle

```ts
addRectangle(options: RectangleOptions): Rectangle
```

#### addCircle

```ts
addCircle(options: CircleOptions): Circle
```

#### addRing

```ts
addRing(options: RingOptions): Ring
```

说明：

- 如果 `options.id` 未传，服务会自动生成唯一 ID
- 创建后会自动加入 `viewer.entities`
- 服务会建立内部 `id -> overlay` 映射和 `entity -> overlay` 映射，供点击/hover 交互使用

### 删除与显隐

#### removeOverlay

```ts
removeOverlay(id: string): boolean
```

根据 ID 删除覆盖物。成功删除返回 `true`，不存在时返回 `false`。

#### removeAllOverlays

```ts
removeAllOverlays(): void
```

删除所有覆盖物。

#### setOverlayVisible

```ts
setOverlayVisible(id: string, visible: boolean): boolean
```

设置指定覆盖物显隐状态。

说明：

- 普通覆盖物会调用 `setVisible()`
- `InfoWindow` 会根据情况调用 `show()` / `hide()`
- 隐藏时会同步清理该覆盖物的高亮状态

### 高亮控制

#### toggleOverlayHighlight

```ts
toggleOverlayHighlight(
  entityOrId: OverlayEntity | Entity | string,
  reason?: 'click' | 'hover',
): boolean
```

切换指定覆盖物的高亮状态。

#### setOverlayHighlight

```ts
setOverlayHighlight(
  entityOrId: OverlayEntity | Entity | string,
  enabled: boolean,
  reason?: 'click' | 'hover',
): boolean
```

显式设置指定覆盖物的高亮状态。

说明：

- `reason='click'` 时使用点击高亮配置
- `reason='hover'` 时使用 hover 高亮配置
- 当前实现会维护 click 和 hover 两套高亮状态，并在状态清空时自动恢复原样式

### destroy

```ts
destroy(): void
```

销毁服务，包含：

- 清理 click / hover 高亮状态
- 销毁鼠标事件处理器
- 清空内部映射
- 删除当前服务创建的所有覆盖物

## 公共基础配置

大多数覆盖物类型都继承自 `BaseOverlayOptions`。

```ts
interface BaseOverlayOptions {
  id?: string;
  position?: OverlayPosition;
  show?: boolean;
  onClick?: (entity: Entity) => void;
  clickHighlight?: boolean | OverlayClickHighlightOptions;
  hoverHighlight?: boolean | OverlayHoverHighlightOptions;
  metadata?: Record<string, any>;
  layerKey?: string;
}
```

### OverlayPosition

```ts
type OverlayPosition = Cartesian3 | [number, number] | [number, number, number]
```

支持：

- `Cesium.Cartesian3`
- `[longitude, latitude]`
- `[longitude, latitude, height]`

### OverlayClickHighlightOptions

```ts
interface OverlayClickHighlightOptions {
  color?: Cesium.Color | string;
  fillAlpha?: number;
}
```

`OverlayHoverHighlightOptions` 与它使用同样结构。

## 交互行为说明

### 点击高亮

如果实体配置了：

- `clickHighlight`
- `onClick`

服务会在点击拾取时：

1. 查找当前命中的覆盖物
2. 按配置决定是否切换高亮
3. 回调实体上的 `_onClick`

### Hover 高亮

如果实体配置了 `hoverHighlight`，且 `enableHoverHandler !== false`，服务会在鼠标移动时自动处理 hover 高亮。

### 高亮恢复

服务会缓存 point、label、billboard、polyline、polygon、rectangle、ellipse 的原始样式，在高亮关闭时恢复。

## 示例

### 添加点、线、面

```ts
const overlayService = mapPlugin.getOverlayService();

const marker = overlayService.addMarker({
  position: [116.3974, 39.9093],
  pixelSize: 12,
  color: '#ff4d4f',
  clickHighlight: true,
});

const polyline = overlayService.addPolyline({
  positions: [
    [116.38, 39.90],
    [116.40, 39.91],
  ],
  width: 3,
  color: '#1677ff',
});

const polygon = overlayService.addPolygon({
  positions: [
    [116.38, 39.90],
    [116.40, 39.90],
    [116.39, 39.92],
  ],
  material: 'rgba(22, 119, 255, 0.25)',
  clickHighlight: {
    color: '#faad14',
    fillAlpha: 0.35,
  },
});
```

### 通过 ID 管理覆盖物

```ts
const marker = overlayService.addMarker({
  id: 'city-center',
  position: [116.3974, 39.9093],
});

overlayService.setOverlayVisible('city-center', false);
overlayService.removeOverlay('city-center');
```

### 手动控制高亮

```ts
overlayService.setOverlayHighlight('city-center', true, 'click');
overlayService.toggleOverlayHighlight('city-center', 'hover');
```

## 与 compat 层的关系

- `OverlayService` 是新架构的覆盖物服务
- `CesiumOverlayService` 是兼容适配层
- 新项目优先使用 `mapPlugin.getOverlayService()`
- 旧项目迁移时，可以先保留 compat 接口，再逐步切到新的实体类与服务层
