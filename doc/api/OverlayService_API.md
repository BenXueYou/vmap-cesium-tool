# OverlayService API 文档

## 概述

`OverlayService` 是 1.x 新架构下的覆盖物公开服务，负责：

- 创建和管理点、线、面、圆、矩形、圆环、信息窗等 overlay
- 统一处理 hover / selected 两套交互状态
- 提供重叠拾取排序、selection 事件、显隐和销毁生命周期协同

推荐通过 `MapPlugin` 获取它：

```ts
const mapPlugin = createMapPlugin("cesiumContainer", {
  services: {
    overlay: {
      enabled: true,
    },
  },
});

await mapPlugin.initialize();

const overlayService = mapPlugin.getOverlayService();
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
  picking?: OverlayPickingOptions;
  onOverlayEditChange?: (entity: Entity) => void;
  onOverlayEditEnd?: (entity: Entity | null) => void;
}
```

### OverlayPickingOptions

```ts
interface OverlayPickingOptions {
  enabled?: boolean;
  hover?: boolean;
  selection?: boolean;
  pickWidth?: number;
  pickHeight?: number;
  drillLimit?: number;
  clickDebounceMs?: number;
}
```

当前默认值：

- `enabled: true`
- `hover: true`
- `selection: true`
- `pickWidth: 3`
- `pickHeight: 3`
- `drillLimit: 16`
- `clickDebounceMs: 250`

兼容说明：

- `enableHoverHandler` 是 `picking.hover` 的迁移别名
- `clickPickMinIntervalMs` 是 `picking.clickDebounceMs` 的迁移别名

## BaseOverlayOptions

大多数 overlay 创建方法都继承自 `BaseOverlayOptions`：

```ts
interface BaseOverlayOptions {
  id?: string;
  position?: OverlayPosition;
  show?: boolean;
  onClick?: (entity: Entity) => void;
  clickHighlight?: boolean | OverlayClickHighlightOptions;
  selectionHighlight?: boolean | OverlayClickHighlightOptions;
  hoverHighlight?: boolean | OverlayHoverHighlightOptions;
  selectable?: boolean;
  pickPriority?: number;
  metadata?: Record<string, any>;
  layerKey?: string;
}
```

重点字段：

- `selectionHighlight`: 2.x 语义下的 selected 样式
- `clickHighlight`: 兼容别名；和 `selectionHighlight` 同时传入时，以 `selectionHighlight` 为准
- `hoverHighlight`: hover 样式
- `selectable`: 是否允许参与 pointer / API selection
 - `pickPriority`: 重叠拾取优先级，数值越大越优先

默认样式：

- hover: `#FFD54F`，面透明度 `0.25`
- selected: `#00E5FF`，面透明度 `0.40`

## Editing

`OverlayService` 是统一编辑内核，`MarkService` 和 `CesiumOverlayService` 只负责编排/兼容转发，不维护独立编辑器。

默认编辑句柄语义：

- `point`: `move`
- `polyline`: `vertex + mid`，`rotate / scale` 仅在显式开启时出现
- `polygon`: `vertex + mid + move`
- `rectangle`: `vertex + move`
- `circle`: `center + radius`

编辑回调语义：

- `onOverlayEditChange`：每次有效拖拽更新后触发
- `onOverlayEditEnd`：停止编辑时触发
- 编辑开始时会强制接管 selected，reason 为 `edit-start`

## 创建方法

```ts
addMarker(options: MarkerOptions): Marker
addLabel(options: LabelOptions): Label
addIcon(options: IconOptions): Icon
addSvg(options: SvgOptions): SVG
addInfoWindow(options: InfoWindowOptions): InfoWindow
addPolyline(options: PolylineOptions): Polyline
addPolygon(options: PolygonOptions): Polygon
addRectangle(options: RectangleOptions): Rectangle
addCircle(options: CircleOptions): Circle
addRing(options: RingOptions): Ring
```

所有创建方法都会：

- 自动注册 root overlay id
- 自动绑定复合图形的 `_highlightEntities`
- 自动纳入 hover / selection 拾取体系

## 查询与销毁

```ts
getOverlay(id: string): OverlayInstance | undefined
getAllOverlayIds(): string[]
removeOverlay(id: string): boolean
removeAllOverlays(): void
setOverlayVisible(id: string, visible: boolean): boolean
destroy(): void
```

selection 生命周期说明：

- 隐藏当前 selected overlay 会发出 `hidden`
- 删除当前 selected overlay 会在销毁前发出 `removed`
- `destroy()` 会静默清空 selection，不发晚到事件

## Selection API

```ts
getSelectedOverlay(): OverlayEntity | null
getSelectedOverlayId(): string | null
selectOverlay(entityOrId): boolean
clearSelection(): boolean
setOverlaySelectable(entityOrId, selectable): boolean
setOverlayPickPriority(entityOrId, pickPriority): boolean
setSelectionEnabled(enabled): void
isSelectionEnabled(): boolean
refreshHover(): boolean
onSelectionChange(listener): () => void
```

### `selectOverlay`

- 幂等：重复选中同一对象返回 `true`
- 不会触发 overlay 自身的 `onClick`
- 对无效、隐藏或不可选对象返回 `false`

### `clearSelection`

- 有 selected 时返回 `true`
- 已经为空时返回 `false`

### `setOverlaySelectable`

- 运行时切换某个 overlay 是否可选
- 若当前 selected overlay 被切为不可选，会发出 `disabled`
- 若它正处于 edit-owned selection，则不会因为这个切换立刻清空

### `setOverlayPickPriority`

- 动态修改重叠拾取优先级
- 当 hover 交互可用时，会立即触发一次 hover 重算

### `setSelectionEnabled`

- 只关闭 pointer click selection
- 不清空当前 selected
- 不影响程序化 `selectOverlay` / `clearSelection`

### `refreshHover`

- 以最近一次有效鼠标位置立即重算 hover
- 若当前没有可复用的鼠标位置，返回 `false`

## `onSelectionChange`

```ts
type OverlaySelectionChangeReason =
  | "pointer-select"
  | "pointer-toggle-off"
  | "empty-click"
  | "api-select"
  | "api-clear"
  | "hidden"
  | "removed"
  | "disabled"
  | "edit-start";

interface OverlaySelectionChangeEvent {
  current: OverlayEntity | null;
  previous: OverlayEntity | null;
  currentId: string | null;
  previousId: string | null;
  reason: OverlaySelectionChangeReason;
}
```

```ts
const unsubscribe = overlayService.onSelectionChange((event) => {
  console.log(event.currentId, event.previousId, event.reason);
});
```

callback 顺序：

1. 提交 selection 状态
2. 触发 `onSelectionChange`
3. pointer click 场景下，再调用 overlay 自身的 `onClick`

异常隔离：

- `onSelectionChange` 抛错不会回滚状态
- overlay `onClick` 抛错不会阻断已提交的 selection

## Pointer 行为

当前 pointer click 只处理排序第一的 selectable candidate：

- 点击未选中的 candidate: `pointer-select`
- 点击已选中的 candidate: `pointer-toggle-off`
- 点击空白且当前有 selected: `empty-click`
- 点击空白且当前没有 selected: 不发事件

hover / selected 关系：

- hover 和 selected 是独立状态
- 同一对象同时 hover + selected 时，selected 样式优先
- 若 `selectionHighlight: false`，同一对象 selected 时不改外观；若同时 hovered，则继续显示 hover 样式

## 候选排序

重叠拾取排序固定为：

1. `pickPriority` 越大越优先
2. `drillPick` 视觉顺序越靠前越优先
3. 创建顺序越早越优先
4. root overlay id 作为最终兜底

复合图形去重规则：

- fill / border / inner / primitive parts 先归一化到 root overlay
- 同一个 root overlay 只会作为一个 candidate 参与排序

## 高亮 API

```ts
toggleOverlayHighlight(entityOrId, reason?: "click" | "hover"): boolean
setOverlayHighlight(entityOrId, enabled: boolean, reason?: "click" | "hover"): boolean
setHoverEnabled(enabled: boolean): void
isHoverEnabled(): boolean
```

说明：

- `reason: "click"` 走 selected 样式逻辑
- `reason: "hover"` 走 hover 样式逻辑
- 高亮关闭后会恢复到最新 base style，而不是旧快照

## 生命周期协同

### Camera

- 相机移动开始：清 hover，保留 selected
- 相机移动结束：按最后有效鼠标位置重算一次 hover

### Drawing

- drawing 期间暂停 hover 和 pointer selection
- drawing 结束后恢复 hover

### Editing

- 编辑开始时强制把 edit target 设为 selected，reason 为 `edit-start`
- 编辑期间暂停正常 hover / pointer selection
- 编辑中程序化 `selectOverlay` / `clearSelection` 会先结束编辑，再只提交最终一次 selection 变更

## 示例

### 推荐配置

```ts
const overlayService = new OverlayService(viewer, {
  picking: {
    enabled: true,
    hover: true,
    selection: true,
    pickWidth: 3,
    pickHeight: 3,
    drillLimit: 16,
    clickDebounceMs: 250,
  },
});
```

### 创建一个支持 hover + selected 的 polygon

```ts
const polygon = overlayService.addPolygon({
  id: "zone-a",
  positions: [
    [116.38, 39.90],
    [116.40, 39.90],
    [116.39, 39.92],
  ],
  material: "rgba(22, 119, 255, 0.25)",
  hoverHighlight: true,
  selectionHighlight: {
    color: "#00E5FF",
    fillAlpha: 0.4,
  },
  selectable: true,
  pickPriority: 10,
});
```

### 监听 selection 并动态调整优先级

```ts
overlayService.onSelectionChange((event) => {
  console.log(event.reason, event.currentId, event.previousId);
});

overlayService.setOverlayPickPriority("zone-a", 20);
overlayService.refreshHover();
```

## 相关文档

- [Overlay Selection 与重叠拾取](/guide/Overlay_Selection_Guide)
- [12,000 Overlay 性能验收](/guide/Overlay_Selection_Performance_Acceptance)
- [迁移指南](/guide/Migration_Guide)
