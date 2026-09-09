---
title: Overlay Selection
---

# Overlay Selection 与重叠拾取

这份说明对应 1.x 当前已经落地的 overlay selection 行为。它补齐了 research guide 里的最终产品语义，适合直接给业务接入方看。

## 当前行为摘要

- hover 和 selected 是两个独立状态，最多各存在一个 root overlay。
- 同一位置命中多个 overlay 时，系统只会处理排序第一的候选。
- 点击不会循环候选，也不会弹出候选菜单。
- 选中态先提交，再触发 `onSelectionChange`，最后才调用 overlay 自身的 `onClick`。
- 程序化 `selectOverlay` / `clearSelection` 不会触发 overlay 的 `onClick`。

## 候选排序

当前实现的候选排序固定为：

1. `pickPriority` 越大越优先
2. `drillPick` 结果里视觉顺序更靠前者优先
3. 创建顺序更早者优先
4. root overlay id 仅作为最终兜底

fill、border、inner、primitive parts 命中后都会先归一化到 root overlay，再参与排序。

## grouped picking 配置

推荐用 grouped `picking` 配置，而不是继续依赖旧的平铺字段：

```ts
const mapPlugin = createMapPlugin("cesiumContainer", {
  services: {
    overlay: {
      enabled: true,
      picking: {
        enabled: true,
        hover: true,
        selection: true,
        pickWidth: 3,
        pickHeight: 3,
        drillLimit: 16,
        clickDebounceMs: 250,
      },
    },
  },
});
```

字段含义：

- `enabled`: pointer hover 和 pointer selection 的总开关
- `hover`: pointer hover 开关
- `selection`: pointer click selection 开关
- `pickWidth` / `pickHeight`: 每次 drill pick 的像素窗口，默认 `3 x 3`
- `drillLimit`: 每次 drill pick 的最大原始命中数，默认 `16`
- `clickDebounceMs`: 点击防抖，默认 `250`

兼容说明：

- `enableHoverHandler` 仍可作为迁移别名使用
- `clickPickMinIntervalMs` 仍可作为 `clickDebounceMs` 的迁移别名使用

## 公开 selection API

`OverlayService` 当前对外提供：

```ts
getSelectedOverlay(): OverlayEntity | null
getSelectedOverlayId(): string | null
selectOverlay(entityOrId): boolean
clearSelection(): boolean
setOverlaySelectable(entityOrId, selectable): boolean
setOverlayPickPriority(entityOrId, pickPriority): boolean
setSelectionEnabled(enabled): void
refreshHover(): boolean
onSelectionChange(listener): () => void
```

其中：

- `selectOverlay` 幂等；重复选中同一对象返回 `true`，但不会重复发事件
- 无效、隐藏或不可选对象会返回 `false`，且不会扰动当前 selection
- `setSelectionEnabled(false)` 只关闭 pointer click selection，不会清空现有 selected
- `refreshHover()` 会基于最近一次有效鼠标位置立即重算 hover
- `setOverlayPickPriority()` 在 hover 可用时会立即触发一次 hover 重算

## `clickHighlight` 到 `selectionHighlight` 的迁移

2.x 语义上推荐把“点击后持续存在的高亮”理解为 selected，而不是 click highlight。

因此：

- 新代码优先使用 `selectionHighlight`
- `clickHighlight` 继续保留为兼容别名
- 当两者同时传入时，以 `selectionHighlight` 为准

示例：

```ts
overlayService.addPolygon({
  positions,
  hoverHighlight: true,
  selectionHighlight: {
    color: "#00E5FF",
    fillAlpha: 0.4,
  },
});
```

默认样式：

- hover: `#FFD54F`，面透明度 `0.25`
- selected: `#00E5FF`，面透明度 `0.40`

优先级规则：

- 同一对象同时 hover + selected 时，selected 样式优先
- 若显式设置 `selectionHighlight: false`，则该对象仍然可以 selected，只是不改外观；此时若它同时 hovered，会继续显示 hover 样式

## selectable 规则

overlay 是否可选由以下规则决定：

- 显式传入 `selectable` 时，以该值为准
- 未传 `selectable` 时，若配置了 legacy `clickHighlight` 或 `onClick`，会被兼容推断为 selectable
- 仅 hoverHighlight 不会自动推断为 selectable

运行时：

- `setOverlaySelectable(id, false)` 会让该对象退出 pointer / API selection
- 若它正处于 selected，且当前不是 edit target owned selection，会发出 `disabled` reason 并清空 selection

## pointer 行为

pointer click 只处理排序第一的 selectable candidate：

- 点击未选中的 candidate: `pointer-select`
- 点击当前已选中的 candidate: `pointer-toggle-off`
- 点击空白区域且当前存在 selected: `empty-click`
- 点击空白区域且当前没有 selected: 不发事件

双击行为：

- 第一次 click 的 selection 结果会保留
- 第二次 click 由 `clickDebounceMs` 抑制，不会立刻 toggle off

## callback 顺序

pointer click 的顺序固定为：

1. 提交 selection 状态
2. 发出 `onSelectionChange`
3. 调用 overlay 自身的 `onClick`

程序化 selection 的顺序固定为：

1. 提交 selection 状态
2. 发出 `onSelectionChange`
3. 不调用 overlay `onClick`

异常隔离：

- `onSelectionChange` 抛错不会回滚状态
- overlay `onClick` 抛错不会影响 selection 已提交的结果
- 两类回调互相隔离

## selection reasons

当前 reason 集合固定为：

- `pointer-select`
- `pointer-toggle-off`
- `empty-click`
- `api-select`
- `api-clear`
- `hidden`
- `removed`
- `disabled`
- `edit-start`

常见触发场景：

- `hidden`: 已选中的 overlay 被 `setOverlayVisible(id, false)`
- `removed`: 已选中的 overlay 在销毁前被 `removeOverlay(id)`
- `disabled`: 已选中的 overlay 被 `setOverlaySelectable(id, false)`
- `edit-start`: 编辑开始时强制把 edit target 放入 selected

## 生命周期协同

- 相机移动时：清 hover，保留 selected；相机停止后按最后一次有效鼠标位置重算 hover
- drawing 中：暂停 hover 和 pointer selection，保留 selected
- editing 中：暂停正常 hover / selection；edit target 会被强制 selected
- service destroy：静默清空 selection，不发晚到事件

## Playground 与性能

playground 已提供：

- 基础 selection 验证场景
- 重叠优先级验证场景
- `12,000 Entity / 12,000 Primitive / 6,000+6,000 Mixed` benchmark 生成器

性能验收步骤与当前记录见：

- [12,000 Overlay 性能验收](/guide/Overlay_Selection_Performance_Acceptance)
