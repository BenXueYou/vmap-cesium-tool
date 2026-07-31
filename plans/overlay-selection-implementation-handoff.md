# Overlay 重叠拾取与选中功能 Handoff

更新时间：2026-07-29（Asia/Shanghai）

## 1. 工作区与当前状态

- 仓库：`C:\WORKCODE\组件开发\vmap-cesium-tool\vmap-cesium-tool_1.x`
- 当前分支：`develop/2.2.0`
- 当前 HEAD：`a9ca6ea feat: 完成了部分overlay的API`
- 远端跟踪：`origin/develop/2.2.0`
- 工作树：生成本文档前为 clean。
- 版本发布、版本号修改和远端推送不属于当前功能实现范围。

## 2. 当前有效 Git 历史

提交历史已经完成重排。新会话必须使用下面的新 SHA，不要再把旧的
`205c07e`、`6e437b9`、`3076930` 当作当前开发线上的固定点。

```text
a9ca6ea  feat: 完成了部分overlay的API
78f3848  feat: 添加确定性覆盖物悬停拾取功能 (#4)
2ebb9d1  feat: 添加确定性覆盖物拾取解析器 (#3)
f942cf6  feat: 接入多厂商地图并恢复兼容 API
54cb78b  feat: 提交playground的测试代码
```

关键关系：

- `54cb78b`：本轮 Overlay spec 实现前的基础节点。
- `f942cf6`：多厂商地图、坐标转换、1.x 与 0.x API 兼容等原有重要功能的独立提交。
- `v1.0.7`：当前指向 `f942cf6`；`develop/2.1.0` 也停在该节点。
- `2ebb9d1`：重排后的 Ticket #3。
- `78f3848`：重排后的 Ticket #4。
- `a9ca6ea`：在 Ticket #4 之后新增的部分 selection API，目前尚未完成整份 spec。

历史重排前的安全标签仍保留：

```text
vmap-1x-before-history-rewrite-20260720              -> 3076930
vmap-1x-before-message-update-20260720               -> e536430
vmap-1x-before-chinese-message-20260720               -> a911d41
vmap-1x-before-followup-chinese-message-20260720      -> 49dddeb
```

除非恢复旧历史，否则不要移动或删除这些备份 tag。

## 3. 需求与参考文档

实现前必须完整阅读：

1. `plans/overlay-overlap-picking-selection-spec.md`
2. `doc/guide/Overlay_Overlap_Picking_Guide.md`
3. 本 handoff 文件

最终产品语义以 spec 为准；研究 guide 中早期提出的候选缓存、click 循环等建议，若与
spec 冲突，应以 spec 的最终确认结论为准。

## 4. 已确认的产品语义

### 4.1 Hover 与 selected

- Hover 和 selected 是两个独立、单值状态。
- 最多一个 hovered 根覆盖物和一个 selected 根覆盖物。
- Hover 与 selected 可以同时存在于不同对象上。
- 同一对象同时 hovered/selected 时，selected 样式优先；若 selected 样式显式关闭，保留 hover 样式。
- Hover 始终只高亮排序第一的合格覆盖物。

### 4.2 候选排序

排序顺序固定为：

1. `pickPriority` 较高者。
2. Cesium drill-pick 结果中视觉上更靠前者。
3. 稳定创建顺序更早者。
4. 根覆盖物 ID，仅作为防御性最终 tie-breaker。

复合图形的 root、fill、border、inner 和 Primitive 命中必须归一化并去重到根覆盖物。
非 OverlayService 管理的场景对象不参与排序，也不阻塞覆盖物候选。

### 4.3 Pointer selection

- 点击只处理排序第一的 selectable 候选，不循环候选，也不弹菜单。
- 点击当前 selected 对象：取消选中，reason 为 `pointer-toggle-off`。
- 点击其他 selectable 对象：切换选中，reason 为 `pointer-select`。
- 点击空白：有选中时清空，reason 为 `empty-click`；无选中时不发事件。
- 状态先提交，再调用 `onSelectionChange`，最后调用覆盖物自己的 `onClick`。
- listener 和 `onClick` 异常必须隔离。
- 程序化 selection 不调用覆盖物 `onClick`。

### 4.4 公开 API 目标

必须最终提供：

```text
getSelectedOverlay
selectOverlay
clearSelection
setOverlayPickPriority
setOverlaySelectable
refreshHover
setSelectionEnabled
```

`selectOverlay` 必须幂等；无效、隐藏或不可选对象返回 `false` 且不改变状态。
关闭 pointer selection 后，程序化 selection 仍可使用。

`onSelectionChange` payload 必须包含 current、previous、对应 ID 和 reason。
完整 reason 集合：

```text
pointer-select
pointer-toggle-off
empty-click
api-select
api-clear
hidden
removed
disabled
edit-start
```

### 4.5 配置与性能

- grouped `picking` 配置包含 master、hover、selection、拾取尺寸、drill limit、click debounce 和 governor profiles。
- 旧的平铺 hover/click interval 配置保留为迁移别名。
- 默认拾取区域：`3 × 3` px。
- 默认 drill limit：`16`。
- 默认 click debounce：`250ms`。
- 每次有效决议只执行一次有上限的 `drillPick`；不先执行 `scene.pick`，首版不引入候选缓存。
- 复用 RAF 合帧和 `PickGovernor`：非 Mac hover 默认 `66ms/2px`，Mac 默认 `100ms/6px`。
- 性能验收环境：Windows、4 核 CPU、16GB 内存、集成显卡、12,000 个同时可见且可拾取覆盖物。
- 指标：移动平均至少 30 FPS，hover 响应 P95 不超过 100ms，pick + resolution 主线程 P95 不超过 16ms。

### 4.6 生命周期

- 相机移动：清除并暂停 hover，保留 selected；移动结束后在最后有效鼠标位置重算一次 hover。
- Canvas leave：清除 hover 并忘记最后鼠标位置，保留 selected。
- 绘制：清除/暂停 hover 和 pointer selection，保留 selected；结束后恢复并按最后位置重算 hover。
- 编辑开始：强制 edit target selected，reason 为 `edit-start`，即使对象本来不可选；暂停正常 hover/selection。
- 编辑结束后保留 edit target selected。
- 编辑中程序化 selection/clear：先结束编辑，再只提交最终一次 selection transition。
- Touch 只使用 tap/click 语义，不提供 long-press 或 hover。
- Double click 保留第一次 click 的 selection 结果，第二次由 250ms debounce 抑制。
- 不改变 cursor。
- 隐藏 selected：reason `hidden`；删除 selected：必须在实体销毁前 reason `removed`；销毁整个 service 静默清空。
- 重复根 ID 必须报错，不能覆盖已有注册。

## 5. 已完成实现

### 5.1 Ticket #3 — `2ebb9d1`

- `OverlayPickResolver.ts` 纯候选解析器。
- 根候选归一化、去重和稳定排序。
- 排序规则：priority → visual rank → creation order → ID。
- resolver 类型与 package exports。
- `tests/OverlayPickResolver.test.ts`。

### 5.2 Ticket #4 — `78f3848`

- `OverlayService` 接入 resolver。
- grouped `picking` 配置和旧配置别名。
- 一次 bounded `drillPick(position, limit, width, height)`。
- 默认 `3 × 3`、limit `16`、click debounce `250ms`。
- RAF 合帧和 `PickGovernor`。
- 只高亮第一候选；同一目标不重复清除/应用样式。
- 无候选和 canvas leave 清除 hover。
- `MapPlugin`、公开类型和兼容 adapter 透传配置。
- `tests/OverlayServiceHover.test.ts`。

### 5.3 部分 selection API — `a9ca6ea`

目前已经有：

- `getSelectedOverlay`
- 额外的 `getSelectedOverlayId`
- `selectOverlay`
- `clearSelection`
- `onSelectionChange` 订阅/取消订阅
- pointer select、toggle-off、empty-click 基础语义
- 基础 callback 顺序和异常隔离
- `selectionHighlight` 字段及 `clickHighlight` 兼容读取
- selected 样式优先于 hover 的基础状态逻辑
- adapter 层 selection API 代理
- `tests/OverlayServiceSelection.test.ts`
- playground 中的 selection 验证入口

该提交信息明确写的是“部分 API”，不能把它视为 selection ticket 已完成。

## 6. 当前已知缺口

继续实现前，应先针对 `a9ca6ea` 做一次 spec audit。至少有以下缺口：

- 没有 `selectable` 创建配置和内部元数据。
- 没有 `setOverlaySelectable`。
- 没有 `setOverlayPickPriority` 和 priority 修改后的 hover 刷新。
- 没有公开 `refreshHover`。
- 没有公开 `setSelectionEnabled`。
- selection reason 目前只有 pointer/API 五种，缺少 `hidden`、`removed`、`disabled`、`edit-start`。
- `removeOverlay` 当前清除 selected 时没有按 `removed` 发事件。
- `setOverlayVisible(false)` 当前没有按 `hidden` 发 selection event。
- `selectOverlay` 尚未验证 selectable，因为 selectable 尚未实现。
- `registerOverlay` 尚未拒绝重复根 ID。
- 相机移动、绘制和编辑生命周期协调尚未完整接入。
- 编辑开始尚未以 `edit-start` 强制选中目标。
- pointer selection 开关与 master/selection 子开关的完整运行时语义仍需验证。
- 默认样式当前仍需按 spec 核验：hover 应为 `#FFD54F/0.25`，selected 应为 `#00E5FF/0.40`。
- 需要验证显式 `selectionHighlight: false` 时保持 selection 状态但不改外观，并在同对象 hovered 时显示 hover。
- 需要覆盖样式更新期间的 base-style 快照与恢复，避免恢复过期样式。
- 当前 service 单测通过 `Object.create` 注入内部字段，仍需补充受控场景/构造配置边界测试。
- 12,000 对象性能验收尚未执行。

## 7. 最近验证结果

在 `a9ca6ea` 上于 2026-07-29 执行：

```text
pnpm test       -> 3 test files, 12 tests passed
pnpm type-check -> passed
```

当前环境没有可执行的 `gh` 命令，因此本 handoff 未重新读取 GitHub issue 列表；Ticket 编号和验收边界应以
spec、本地提交以及新会话可访问的 issue tracker 为准。

## 8. 推荐的下一步

1. 以 `78f3848` 为 selection 增量的固定点，审查 `a9ca6ea` 对 spec 的覆盖情况。
2. 把缺口按独立切片实现，优先完成 selectable、完整 selection reasons、运行时公开 API。
3. 再接入 hide/remove、camera、draw、edit 生命周期。
4. 单独完成样式优先级和“最新 base style 恢复”测试。
5. 完成 12,000 对象性能基准后再考虑优化；没有数据前不增加 pick cache/fast path。
6. 每个切片执行 `pnpm test`、`pnpm type-check`、`pnpm build`，并保持版本发布排除在外。

## 9. 新会话启动提示词

```text
请继续实现 Cesium Overlay 重叠拾取与 selection 功能。

仓库：
C:\WORKCODE\组件开发\vmap-cesium-tool\vmap-cesium-tool_1.x

请先完整阅读：
- plans/overlay-overlap-picking-selection-spec.md
- plans/overlay-selection-implementation-handoff.md
- doc/guide/Overlay_Overlap_Picking_Guide.md

当前分支应为 develop/2.2.0，当前基线应包含：
- f942cf6 多厂商地图及兼容 API
- 2ebb9d1 Ticket #3
- 78f3848 Ticket #4
- a9ca6ea 部分 selection API

先检查 git status 和 git log，不要重复 Ticket #3/#4，也不要回到重排前的旧 SHA。
先审查 a9ca6ea 与 spec 的差距，再执行下一个最小开发切片。
保留已有改动，不推送远端，不修改版本号。
```
