# Cesium 覆盖物重叠拾取与消歧指南

> 研究范围限定为 Cesium 官方 `Scene.pick`、`Scene.drillPick`、`Scene.pickPosition`、`ScreenSpaceEventHandler`，以及本仓库 `OverlayService.ts` 第 1059—1260 行和 `BaseOverlay.ts`。本项目当前锁定 CesiumJS 1.134.1；下文官方源码链接固定到 1.143 便于长期复核，涉及的 API 签名与前后视觉顺序语义也已在本地 1.134.1 源码中核对。核对日期：2026-07-17。

## 核心结论

当同一屏幕坐标（实际拾取区域还可能是默认的 3×3 像素矩形）同时命中两个覆盖物时，**仅靠鼠标坐标无法推断用户意图**。坐标说明“用户指向这里”，并不包含“用户想选前面的对象、业务优先级更高的对象，还是后面的对象”等信息。

Cesium 能提供单个最前命中或一组按视觉顺序排列的命中，但最终选择规则必须由业务层明确规定。推荐默认规则如下：

- hover：按 `pickPriority` 降序 → 视觉上层优先 → 稳定创建序升序，始终只高亮一个根覆盖物。
- click：复用同一候选排序；候选超过一个时允许连续点击循环，或交给候选菜单选择。
- `pickPosition` 只用于取得命中位置，不参与“选中哪个覆盖物”的消歧。

这里的“稳定创建序升序”表示较早创建者优先，避免新加入的同优先级覆盖物无意中抢走既有交互；如果产品希望“后创建者在上”，可以反转最后一项，但必须全局固定。

## 官方事实与链接

以下事实只来自本研究范围内的四项 Cesium 官方 API 和对应官方源码。

### 1. `Scene.pick`

- 接收窗口坐标，可选拾取矩形宽高，宽高默认均为 3。
- 返回一个拾取对象；无命中时返回 `undefined`。
- CesiumJS 1.143 源码调用内部 picking，并将结果限制为 1，然后返回数组第一个元素。因此它适合作为“只需最前命中”的快速路径，但无法证明下面没有其他候选。

链接：[官方 API](https://cesium.com/learn/cesiumjs/ref-doc/Scene.html#pick)；[官方源码](https://github.com/CesiumGS/cesium/blob/1.143/packages/engine/Source/Scene/Scene.js#L4519-L4558)

### 2. `Scene.drillPick`

- 返回指定窗口位置处的一组拾取对象，每项包含 `primitive`，并可能包含用于进一步识别对象的其他属性。
- 官方说明返回列表按场景视觉顺序从前到后排列。
- `limit` 可限制收集数量；宽高默认均为 3。
- 它提供“有哪些对象重叠”和“谁在视觉前面”的证据，但不会提供业务优先级，也不会推断用户意图。

链接：[官方 API](https://cesium.com/learn/cesiumjs/ref-doc/Scene.html#drillPick)；[官方源码](https://github.com/CesiumGS/cesium/blob/1.143/packages/engine/Source/Scene/Scene.js#L4792-L4813)

### 3. `Scene.pickPosition`

- 根据窗口坐标和深度缓冲重建笛卡尔坐标。
- 2D 与 3D/Columbus View 因投影和深度值分布不同，重建位置可能略有差异。
- 默认不计入半透明图元深度；若要计入，需要启用 `scene.pickTranslucentDepth`。
- 不支持深度缓冲拾取时会抛出异常，应先检查 `scene.pickPositionSupported`。
- 返回值是空间位置，不是覆盖物候选列表，因此不能替代 `pick`/`drillPick` 进行重叠消歧。

链接：[官方 API](https://cesium.com/learn/cesiumjs/ref-doc/Scene.html#pickPosition)；[官方源码](https://github.com/CesiumGS/cesium/blob/1.143/packages/engine/Source/Scene/Scene.js#L4770-L4790)

### 4. `ScreenSpaceEventHandler`

- 在指定 HTML canvas 上接收输入，并通过 `setInputAction(action, type, modifiers?)` 为事件类型注册回调。
- 本仓库使用 `MOUSE_MOVE` 的 `endPosition` 和 `LEFT_CLICK` 的 `position` 作为窗口坐标。
- 它只负责输入事件分发，不定义重叠对象的选择规则。
- `destroy()` 会移除监听器；触摸事件后默认忽略 800ms 内的模拟鼠标事件，触摸长按默认延迟为 1500ms。

链接：[官方 API](https://cesium.com/learn/cesiumjs/ref-doc/ScreenSpaceEventHandler.html)；[官方源码：注册回调](https://github.com/CesiumGS/cesium/blob/1.143/packages/engine/Source/Core/ScreenSpaceEventHandler.js#L977-L1047)；[官方源码：销毁及触摸默认值](https://github.com/CesiumGS/cesium/blob/1.143/packages/engine/Source/Core/ScreenSpaceEventHandler.js#L1111-L1145)

## 当前代码评估

### 已有能力

`OverlayService.ts` 第 1059—1260 行已经具备完整的输入、归一化和高亮基础：

- 第 1059—1115 行创建 hover `ScreenSpaceEventHandler`，用 `requestAnimationFrame` 合并同一帧内的鼠标移动，并在目标变化时清除旧高亮、设置新高亮。
- 第 1120—1150 行处理左键点击；`clickPickMinIntervalMs` 默认 120ms，限制点击拾取频率，并维护互斥的 click 高亮。
- 第 1152—1179 行把根 Entity、边框 Entity、内层 Entity 绑定到同一个覆盖物，并设置 `_highlightEntities`，支持复合对象联动高亮。
- 第 1181—1204 行调用 `drillPick`，过滤不可见或不支持当前交互的覆盖物，再返回第一个合格根 Entity。
- 第 1206—1213 行对 `drillPick` 异常做安全降级。
- 第 1215—1243 行已处理 `pickedObject.id` 为 Entity、`pickedObject.primitive` 为 Entity，以及 `id`/`primitive.id` 为字符串或数字的情况。
- 第 1245—1260 行能将直接 ID 以及 `__fill`、`__border`、`__outer` 后缀归一到根覆盖物。
- `BaseOverlay.ts` 已定义 click/hover 高亮、点击回调、复合实体、高亮状态和 `_overlayId` 等元数据。

### 缺口

当前 `pickOverlayEntity` 始终调用 `drillPick`，随后直接返回第一个合格结果。由于 Cesium 的结果是视觉从前到后排列，这等价于一个隐式的“视觉最前且可交互者优先”规则，但代码没有把它声明为稳定的产品策略。

明确缺少：

- `pickPriority` 业务优先级。
- 同优先级、同视觉层级时的稳定创建序。
- 对复合对象和多条 raw pick 结果先去重、再排序的候选模型。
- click 重复点击循环或候选菜单。
- `Scene.pick` 快路径；当前 hover 每次有效 RAF 都执行完整 `drillPick`。
- 候选缓存、循环状态失效条件和最大 drill 数量。

仓库已有可复用的 `src/utils/PickGovernor.ts`，但当前 `OverlayService` 并未导入或实例化它。现状只有 click 的 120ms 最小间隔和 hover 的 RAF 合帧；实现新消歧逻辑时，建议把 `PickGovernor` 接入 `OverlayService`，继续复用现有 RAF，而不是再创建一套节流器或高频事件循环。

## 推荐默认策略

### 候选排序

每条 raw pick 先归一到根覆盖物并去重，然后按以下键排序：

1. `pickPriority` 降序，默认 `0`。
2. `visualRank` 升序；取该根覆盖物在 `drillPick` 结果中第一次出现的索引，索引越小越靠前。
3. `creationOrder` 升序；由 `OverlayService` 注册覆盖物时分配单调递增序号，不使用时间戳或随机 ID 推导。
4. 根覆盖物 ID 字典序仅作为防御性最终兜底，不作为产品层级含义。

### hover

- 只高亮排序后的一个根覆盖物，不在移动过程中循环。
- 先执行 `scene.pick`。无命中时立即清理，不执行 `drillPick`。
- 若当前位置/最前命中与有效候选缓存一致，直接复用已决议目标。
- 首次进入新的拾取单元、最前命中变化、缓存过期或场景/相机变化时，再执行一次有上限的 `drillPick`，完成去重和排序。
- 为避免“先高亮最前对象，下一帧又跳到高优先级对象”，需要完整消歧时应等本次 `drillPick` 完成后再提交高亮。

严格执行跨重叠对象的 `pickPriority` 时，不能只依赖 `scene.pick`：高优先级对象可能被另一个对象遮在后面。快路径的含义是复用已知无歧义或已缓存的决议，不是放弃优先级语义。

### click

- 首次点击默认选中排序后的第一个候选。
- 在同一位置容差、同一候选签名和限定时间窗内重复点击时，按排序结果循环；索引为 `(previousIndex + 1) % candidates.length`。
- 鼠标位置超出容差、候选集合变化、相机/场景变化或超时后，循环状态重置。
- 候选较多、名称需要辨认或操作不可逆时，通过 `onPickCandidates` 打开候选菜单；菜单最终仍以根覆盖物 ID 回传选择。

## API 草案

以下是设计草案，不表示本研究已修改运行时代码。

```ts
export interface BaseOverlayOptions {
  // 已有字段省略
  /** 重叠拾取业务优先级；越大越优先，默认 0 */
  pickPriority?: number;
}

export interface OverlayPickingOptions {
  hoverStrategy?: 'priority';
  clickStrategy?: 'cycle' | 'menu' | 'priority';
  /** drillPick 最大原始命中数，建议默认 16 */
  maxDrillPicks?: number;
  /** hover 候选缓存的位置容差，建议默认 3px */
  positionTolerancePx?: number;
  /** click 循环状态有效期，建议默认 800ms */
  clickCycleTimeoutMs?: number;
  onPickCandidates?: (
    candidates: readonly OverlayPickCandidate[],
    context: OverlayPickContext,
  ) => void;
}

export interface OverlayPickCandidate {
  overlayId: string;
  entity: OverlayEntity;
  pickPriority: number;
  visualRank: number;
  creationOrder: number;
  rawPicks: readonly unknown[];
}

export interface OverlayPickContext {
  reason: 'hover' | 'click';
  windowPosition: Cesium.Cartesian2;
  /** 仅在支持且确有需要时调用 pickPosition 后设置 */
  worldPosition?: Cesium.Cartesian3;
}
```

建议把 `creationOrder` 保存在 `OverlayService` 私有 `WeakMap<OverlayInstance, number>` 中；`pickPriority` 来自公开 options，并在根 `OverlayEntity` 上保存内部快照。不要要求所有复合子 Entity 分别维护优先级。

## TypeScript 伪代码

```ts
private pickOne(
  position: Cesium.Cartesian2,
  reason: 'hover' | 'click',
): OverlayPickCandidate | null {
  // 由接入后的 PickGovernor 与既有 RAF 保证调用频率。
  const topRaw = this.viewer.scene.pick(position);
  if (!topRaw) {
    this.invalidatePickCache();
    return null;
  }

  const topKey = this.rawPickIdentity(topRaw);
  const cached = this.readValidPickCache(position, topKey);
  if (cached) {
    return reason === 'click'
      ? this.resolveClickChoice(cached, position)
      : cached[0] ?? null;
  }

  // 新位置或最前命中变化时才向下钻取；limit 防止无界扫描。
  const rawPicks = this.safeDrillPick(
    position,
    this.options.maxDrillPicks ?? 16,
  );
  const candidates = this.normalizeDeduplicateAndSort(rawPicks, reason);
  this.writePickCache(position, topKey, candidates);

  if (reason === 'hover') {
    return candidates[0] ?? null;
  }
  return this.resolveClickChoice(candidates, position);
}

private normalizeDeduplicateAndSort(
  rawPicks: readonly unknown[],
  reason: 'hover' | 'click',
): OverlayPickCandidate[] {
  const byOverlayId = new Map<string, OverlayPickCandidate>();

  rawPicks.forEach((rawPick, visualRank) => {
    const root = this.resolvePickedOverlayEntity(rawPick);
    if (!root || root.show === false || !this.isEligible(root, reason)) return;

    const overlayId = root._overlayId ?? root.id;
    const current = byOverlayId.get(overlayId);
    if (current) {
      // fill、border、inner 或 Primitive 的多条命中只保留一个候选。
      current.rawPicks.push(rawPick);
      current.visualRank = Math.min(current.visualRank, visualRank);
      return;
    }

    byOverlayId.set(overlayId, {
      overlayId,
      entity: root,
      pickPriority: root._pickPriority ?? 0,
      visualRank,
      creationOrder: this.creationOrderOf(root),
      rawPicks: [rawPick],
    });
  });

  return [...byOverlayId.values()].sort((a, b) =>
    b.pickPriority - a.pickPriority ||
    a.visualRank - b.visualRank ||
    a.creationOrder - b.creationOrder ||
    a.overlayId.localeCompare(b.overlayId),
  );
}
```

伪代码中的 `rawPicks` 在正式类型中可先用可变数组构建，再暴露为只读数组；此处重点是流程而非可直接编译的实现。

## Entity、Primitive 与复合对象去重

去重必须发生在排序和 click 循环之前，否则同一个圆环的填充、边框和内层可能占据多个循环位置。

推荐统一归一化链：

1. `pickedObject.id instanceof Cesium.Entity`：通过 `entityOverlayMap` 找覆盖物实例，再取根 Entity。
2. `pickedObject.primitive instanceof Cesium.Entity`：执行相同映射。
3. `pickedObject.id` 为字符串或数字：调用现有 `resolveOverlayByPickId`。
4. `pickedObject.primitive.id` 为字符串或数字：调用相同解析。
5. 对 `__fill`、`__border`、`__outer` 后缀及 `_overlayId` 统一还原根 ID。
6. 以根覆盖物 ID 作为候选键；同键只保留一个候选，`visualRank` 取所有 raw pick 中的最小值，`rawPicks` 合并保存供诊断。

若后续 Primitive 使用对象型自定义 ID，而不是 Entity/字符串/数字，应增加一个显式 resolver 扩展点；不要退回对象字符串化，因为 `[object Object]` 会造成碰撞。

高亮仍调用现有 `getHighlightTargets`/`setHighlightTargets`，对候选根覆盖物的 `_highlightEntities` 整组处理。消歧层只决定“哪个根覆盖物”，不复制图形高亮实现。

## 性能约束

- 接入仓库已有但尚未被 `OverlayService` 使用的 `PickGovernor`：click 可沿用现有最小间隔；hover 由 governor 限频，并继续用单个 RAF 合并同帧事件，销毁时取消待执行 RAF。
- `scene.pick` 是 limit=1 的快速路径。无命中直接返回；缓存有效时不执行 `drillPick`。
- `drillPick` 只在首次进入、新的最前命中、缓存失效、click 需要候选列表或显式菜单时执行，并始终传入 `limit`，建议默认 16。
- 候选缓存至少绑定：量化后的窗口位置、最前 raw pick 身份、相机/场景版本和短 TTL。任何覆盖物增删、可见性变化、优先级变化、相机变化都应使缓存失效。
- 不要在每个 raw pick 上调用 `pickPosition`。只有回调或候选菜单确实需要世界坐标时，才在最终决议后调用一次，并先检查 `pickPositionSupported`。
- 不要为 hover 和 click 分别维护两套归一化/排序代码；共用候选管线，减少行为漂移和重复分配。
- 性能优化不得改变排序语义。无法证明无歧义时，应按需 drill，而不是用 `pick` 猜测隐藏候选。

## 边界条件

- **完全同屏位置、相同优先级**：按视觉顺序，再按创建序；无法从坐标恢复更多意图。
- **高优先级对象位于后方**：按推荐策略仍由 `pickPriority` 胜出；这也是需要 `drillPick` 的主要场景。
- **非覆盖物位于最前面**：为兼容当前代码，可从 drill 结果中过滤非覆盖物并继续寻找覆盖物；若产品要求严格遮挡，应另设 `front-most-object` 策略，不能暗中改变。
- **复合对象多命中**：fill、border、inner、outer、Entity 和 Primitive 结果必须折叠为一个根候选。
- **相同业务 ID 或对象型 Primitive ID**：应拒绝重复根 ID或由 resolver 明确解析，不能静默合并无关对象。
- **隐藏或禁用交互**：`show === false`、hover 未启用、click 既无高亮也无回调的对象不得进入候选。
- **半透明对象**：对象拾取与深度位置重建不是同一问题；`pickPosition` 是否穿透半透明对象受 `pickTranslucentDepth` 影响。
- **深度拾取不支持**：对象选择仍可工作，只是不提供 `worldPosition`。
- **`drillPick` 被 limit 截断**：候选菜单应能标识结果可能不完整；业务若存在超高重叠密度，应提高上限或采用空间索引，而不是无界 drill。
- **相机或场景改变**：旧视觉顺序、候选缓存和 click 循环索引全部失效。
- **鼠标轻微抖动**：用小像素容差保持 click 循环；超出容差立即重置，避免在相邻对象间误循环。
- **触摸与模拟鼠标事件**：依赖 `ScreenSpaceEventHandler` 的默认抑制机制，业务层不要额外触发一次模拟 click。
- **销毁**：继续销毁两个事件处理器、取消 RAF，并清空缓存与循环状态，避免持有 Entity。

## 验收标准

1. 同一窗口位置有两个可交互覆盖物时，文档化且可测试的排序结果为：`pickPriority` 高者 → 视觉更前者 → 创建更早者。
2. 两个覆盖物的优先级互换后，hover 目标随之确定性互换；连续运行结果一致，不依赖 Map 偶然迭代顺序或随机 ID。
3. 同一根覆盖物的 Entity、Primitive、fill、border、inner、outer 即使产生多条 drill 结果，也只出现一个候选和一个 click 循环位置。
4. hover 始终最多高亮一个根覆盖物；目标不变时不重复清除和重设高亮。
5. 无命中时仅执行 `scene.pick` 并清理高亮；缓存有效时不调用 `drillPick`；需要重新消歧时每个有效 RAF 最多调用一次有上限的 `drillPick`。
6. 首次 click 选择排序第一项；在位置容差、超时和候选签名均满足时重复 click 可按稳定顺序循环，任一条件变化即重置。
7. `clickStrategy: 'menu'` 时，多候选能通过回调完整提供根 ID、优先级和视觉序，菜单选择后只触发所选根覆盖物的高亮与 `_onClick`。
8. `pickPositionSupported === false` 或深度重建失败时，不影响对象选择；只省略 `worldPosition`。
9. `drillPick` 抛错时沿用安全降级，不遗留旧 hover/click 高亮状态。
10. 相机移动、覆盖物增删/显隐、`pickPriority` 更新后，候选缓存和 click 循环状态正确失效。
11. 现有 click 最小间隔、hover RAF、mouseleave 清理和 handler destroy 行为保持不变。
12. 对“同一像素两个对象都可命中”的测试，系统不会声称从坐标推断用户意图，而是明确执行上述业务消歧策略。
