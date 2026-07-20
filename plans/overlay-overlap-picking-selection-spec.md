# Spec: Cesium 重叠覆盖物拾取、悬停与选择

## Problem Statement

产品在 Cesium 地图上同时展示大量覆盖物。当两个或多个覆盖物在屏幕空间重叠时，用户需要获得稳定、可预测的悬停反馈，并且只能选中业务规则认定的第一候选对象。当前覆盖物服务已经能够通过 Cesium 的 drill picking 获取同一鼠标位置下的多个对象，也能将部分 Entity、Primitive 和复合图形映射回根覆盖物，但它只隐式返回第一个可交互结果，没有公开的业务优先级、完整的根对象去重规则、独立的悬停与选中状态、统一的选中变化事件，也没有覆盖绘制、编辑、相机移动、动态显隐和大规模场景的明确行为。

该功能需要在 12,000 个同时可见且可拾取的覆盖物场景下工作，覆盖点、图标、文字、线、面、圆、矩形、圆环以及 Entity/Primitive 两种渲染模式，并在普通办公 Windows 终端和集成显卡上达到约定的交互性能。

## Solution

覆盖物服务将建立一条统一的候选解析与选择管线：使用有上限的 drill picking 收集鼠标位置下的原始命中，把 Entity、Primitive、填充、边框和内部子对象归一化并去重为根覆盖物，再按照业务拾取优先级、Cesium 视觉前后顺序和稳定创建顺序选出唯一第一候选。

悬停与选中将成为两个独立状态。悬停只提供临时黄色反馈，鼠标移开即恢复；选中提供持久青色反馈，直到点击已选中对象、其他对象、空白处，或通过公开 API 和生命周期操作改变。两种状态可以同时存在于不同对象；位于同一对象时，存在 selected 视觉样式则 selected 优先。

服务将提供创建时和运行时的优先级、可选中状态、选择控制及选择变化事件，并与绘制、编辑、相机移动和销毁生命周期协调。第一版以正确性和可测试性优先，复用现有拾取限频器和 RAF 合帧，每次有效决议只执行一次有上限的 drill picking，不预先引入候选缓存。若 12,000 对象基准未达到性能门槛，则在保持排序语义的前提下，用实际数据驱动最小优化。

## User Stories

1. As a map user, I want only one overlay to be highlighted under the pointer, so that overlapping data does not flicker or appear ambiguous.
2. As a map user, I want hover highlighting to disappear when the pointer leaves an overlay, so that temporary focus is clearly distinguished from selection.
3. As a map user, I want a clicked overlay to remain selected after the pointer moves away, so that I can inspect related information without keeping the pointer stationary.
4. As a map user, I want clicking an already selected overlay to cancel its selection, so that selection can be toggled directly.
5. As a map user, I want clicking a different overlay to switch selection to it, so that only one persistent selection exists.
6. As a map user, I want clicking map space with no selectable overlay to clear selection, so that I can return to a neutral state.
7. As a map user, I want a selected overlay and a different hovered overlay to be visible at the same time, so that I can retain context while previewing another choice.
8. As a map user, I want selected and hovered overlays to use visibly different default styles, so that I can understand their different states immediately.
9. As a map user, I want important overlays to win when several overlays overlap, so that critical business information remains accessible.
10. As a map user, I want equal-priority overlaps to resolve consistently, so that repeated movement over the same location produces the same result.
11. As a map user, I want the first ranked overlay to be the only selectable result, so that clicking does not cycle unexpectedly or open an unwanted menu.
12. As a map user, I want thin lines and small symbols to remain easy to hit, so that precise interaction does not require pixel-perfect pointing.
13. As a map user, I want tapping on a touch device to follow the same selection rules as clicking, so that the feature works without hover or long-press gestures.
14. As a map user, I want double-clicking an overlay for camera interaction not to immediately deselect it, so that double-click behavior remains usable.
15. As a map user, I want hover cleared while the camera moves and recalculated when it stops, so that stale highlights do not remain at an incorrect screen position.
16. As a map user, I want existing selection preserved during camera movement, so that navigation does not discard my chosen object.
17. As a map user, I want drawing operations to suppress overlay hover and click selection, so that drawing input is not consumed twice.
18. As a map user, I want the current selection preserved while drawing, so that temporary tool use does not lose application context.
19. As a map user, I want an overlay being edited to become selected, so that the active edit target is visually explicit.
20. As a map user, I want normal hover and selection suppressed during editing, so that edit handles do not compete with overlay picking.
21. As a map user, I want the edited overlay to remain selected after editing ends, so that the result remains in context.
22. As an application developer, I want to assign a numeric picking priority when creating an overlay, so that business importance can override visual stacking.
23. As an application developer, I want to change picking priority at runtime, so that an overlay becoming an alarm can immediately gain interaction precedence.
24. As an application developer, I want priority changes to re-evaluate the current hover position, so that the UI reflects new business state without requiring pointer movement.
25. As an application developer, I want to mark individual overlays selectable or non-selectable, so that display-only objects do not consume click selection.
26. As an application developer, I want to change an overlay's selectable state at runtime, so that interaction permissions can follow application state.
27. As an application developer, I want disabling the selected overlay to clear selection with a specific reason, so that dependent UI can react correctly.
28. As an application developer, I want hover eligibility independent from click selection eligibility, so that an overlay may support one interaction without the other.
29. As an application developer, I want non-interactive overlays not to block eligible overlays below them, so that interaction filtering is predictable.
30. As an application developer, I want non-overlay scene objects excluded from overlay ranking without blocking overlays, so that this service remains isolated from 3D Tiles, models and other modules.
31. As an application developer, I want a unified selection-change callback with current and previous root overlays, IDs and a reason, so that business state can synchronize reliably.
32. As an application developer, I want selection state committed before callbacks run, so that callbacks always observe the latest state.
33. As an application developer, I want the existing per-overlay click callback preserved, so that current integrations continue receiving clicks.
34. As an application developer, I want callback failures isolated, so that one business callback cannot break Cesium interaction or prevent another callback.
35. As an application developer, I want to query, select and clear selection programmatically, so that side panels and external controls can drive the map.
36. As an application developer, I want repeated programmatic selection of the same object to be idempotent, so that state synchronization does not accidentally toggle selection.
37. As an application developer, I want invalid programmatic selection to return false without changing state, so that invalid, hidden or non-selectable targets can be handled safely.
38. As an application developer, I want programmatic selection to remain available when pointer selection is disabled, so that UI locking does not block explicit commands.
39. As an application developer, I want separate master, hover and selection switches, so that interaction modes can be enabled independently.
40. As an application developer, I want an explicit refresh operation for hover after animated overlay updates, so that I can request a recalculation without enabling per-frame picking.
41. As an application developer, I want hidden or removed selected overlays to clear selection with distinct reasons, so that UI cleanup matches the lifecycle event.
42. As an application developer, I want removing a selected overlay to report its root object before destruction, so that business cleanup can still inspect it.
43. As an application developer, I want service destruction to clear interaction state silently, so that page teardown does not emit late business events.
44. As an application developer, I want a selectable overlay to use a default selected style even without custom styling, so that selection remains visible by default.
45. As an application developer, I want to disable selected visual styling while retaining selection state and events, so that a side-panel-only selection experience is possible.
46. As an application developer, I want style changes made during hover or selection to become the new base style, so that clearing interaction state never restores stale styling.
47. As an application developer, I want the new selection styling name while retaining the old click-highlight option as a migration alias, so that 2.x terminology is clear without needless source breakage.
48. As an application developer, I want all composite and batched parts of one overlay collapsed into one candidate, so that a fill and border do not compete as separate objects.
49. As an application developer, I want duplicate root IDs rejected, so that selection identity and candidate deduplication cannot silently point at the wrong overlay.
50. As an application developer, I want explicit editing commands to select an edit target even when it is normally non-selectable, so that editing remains an authoritative workflow.
51. As an application developer, I want explicit selection commands during editing to end editing before applying the final selection, so that edit and selection state cannot conflict.
52. As a library maintainer, I want candidate normalization, deduplication and ordering in a pure module, so that the most complex rules can be tested without WebGL.
53. As a library maintainer, I want one shared candidate pipeline for hover and click, so that their ordering behavior cannot drift.
54. As a library maintainer, I want bounded drill picking and existing governor-based throttling, so that hover does not perform unbounded GPU picking.
55. As a library maintainer, I want automated behavior tests and a real Cesium playground scenario, so that pure rules and browser rendering are both verifiable.
56. As a library maintainer, I want repeatable 12,000-overlay benchmarks across Entity, Primitive and mixed rendering scenarios, so that performance claims match production scale.
57. As a library maintainer, I want public API and migration documentation updated with the implementation, so that consumers can adopt the 2.x behavior safely.

## Implementation Decisions

- The feature is implemented only on the current 1.x development line and is treated as a 2.x behavior upgrade. It is not backported to 0.x or v0.0.7.
- Hover and selected are independent, single-valued states. At most one root overlay is hovered and one root overlay is selected. Different overlays may hold the two states simultaneously.
- When the same root overlay is both hovered and selected, selected styling wins if selected styling is enabled. If selected styling is explicitly disabled, hover styling remains visible.
- Candidate ordering is deterministic: higher `pickPriority` first, then lower Cesium visual rank, then earlier stable creation order, with root ID used only as a defensive final tie-breaker.
- `pickPriority` defaults to zero and is available both at overlay creation and through a runtime setter. Runtime changes immediately request hover re-evaluation when hover interaction is active.
- Click uses the same filtered and sorted candidate pipeline as hover and selects only the first candidate. There is no click cycling and no candidate menu.
- Raw Entity, Primitive and composite-part hits are normalized to one registered root overlay before sorting. Fill, border, inner and outer hits for the same root appear once.
- Only registered overlay candidates participate. 3D Tiles, terrain, models and primitives owned by other modules are ignored and do not block an eligible overlay behind them.
- Hover and click eligibility are filtered independently. An overlay without the required capability does not block an eligible overlay behind it.
- The feature covers all Cesium-pickable overlays managed by the overlay service, including points, icons, labels, lines, polygons, circles, rectangles and rings in Entity and Primitive modes. HTML information windows remain DOM-owned and out of Cesium picking.
- Root overlay IDs are unique. Registering a duplicate ID fails with a descriptive error rather than replacing an existing registration.
- Each overlay gains a `selectable` option. When omitted, compatibility inference treats an overlay with legacy click highlighting or a click callback as selectable; otherwise it remains display-only.
- Runtime `setOverlaySelectable` is supported. Disabling a currently selected overlay clears selection with reason `disabled`, except while that overlay is the active edit target.
- The canonical selected-style option is `selectionHighlight`. The existing `clickHighlight` option remains as a deprecated migration alias, and the canonical option wins when both are present.
- `selectable: true` with no selected-style option uses the default selected style. Explicitly disabling selected styling keeps selection state and events without modifying the overlay appearance.
- Default hover styling is yellow `#FFD54F` with face alpha `0.25`. Default selected styling is cyan `#00E5FF` with face alpha `0.40`. Explicit overlay styling overrides defaults.
- Style updates during hover or selection update the underlying base style and then reapply the current interaction effect. Clearing interaction state restores the latest base style.
- Pointer behavior is: click an unselected candidate to select it; click the selected candidate to toggle it off; click another candidate to switch; click a location with no selectable overlay to clear.
- A click on a non-overlay object with no selectable overlay behind it is treated as an empty overlay click.
- Double-click retains the first click's selection result. The default click debounce is 250ms so the second click does not immediately toggle selection off.
- The default pick rectangle is 3 by 3 pixels and both dimensions are configurable.
- Drill picking collects at most 16 raw results by default and the limit is configurable. Candidates beyond the limit do not participate in that decision.
- The first implementation performs one bounded drill pick per effective hover or click decision. It does not perform a preceding single pick and does not introduce candidate caching.
- The existing `PickGovernor` is integrated with the existing RAF coalescing. Default non-Mac hover governance remains 66ms and 2px; Mac remains 100ms and 6px.
- Camera movement clears hover and suspends hover picking. Camera movement does not change selected. Camera stop requests one hover calculation at the last known in-canvas pointer position.
- Pointer leave clears hover and forgets the last reusable pointer position. Re-entry waits for a new valid movement event.
- Moving overlays do not trigger per-frame hover picking. A public `refreshHover` operation lets an application request recalculation after relevant position updates.
- Drawing clears hover and suspends normal hover and click handling while preserving selected. Interaction resumes after drawing and hover is recalculated at the latest valid pointer position.
- Starting overlay editing forces the edit target into selected with reason `edit-start`, including when the target is normally non-selectable. Normal hover and selection are suspended during editing.
- The edit target remains selected after editing. Making it non-selectable during editing does not clear that edit-owned selection.
- Programmatic selection or clearing during editing ends editing first and then commits only the final selection transition, without an intermediate selection event.
- Touch tap follows click selection semantics. Long-press preview, touch hover and candidate menus are not introduced.
- Canvas cursor styling is not modified by this feature.
- A grouped `picking` service configuration contains a master switch, hover switch, selection switch, pick dimensions, drill limit, click debounce and governor profiles. Existing flat hover and click interval options remain migration aliases.
- The master switch disables pointer hover and click but preserves selected. The hover and selection switches independently control their pointer interactions.
- A public `setSelectionEnabled` controls pointer click handling and per-overlay click callbacks but preserves current selection. Explicit selection APIs remain available while pointer selection is disabled.
- Public selection APIs provide query, idempotent selection and explicit clearing. Invalid, hidden or non-selectable programmatic targets return false, preserve current state and emit no event.
- Programmatic repeated selection of the current target returns success without toggling or emitting a change event.
- Selection-change events expose current and previous normalized root entities, current and previous stable IDs, and a reason.
- Selection reasons are `pointer-select`, `pointer-toggle-off`, `empty-click`, `api-select`, `api-clear`, `hidden`, `removed`, `disabled` and `edit-start`.
- For pointer clicks, selection state is committed first, a change event is emitted only when state changes, and the per-overlay click callback runs last on every accepted overlay click, including pointer toggle-off.
- Programmatic selection does not invoke per-overlay click callbacks.
- Selection-change and click callbacks are individually exception-isolated. Callback failure is logged, does not roll state back and does not prevent the other callback.
- Hiding the selected overlay clears selection with reason `hidden`. Removing it clears selection with reason `removed` before entity destruction. Destroying the whole service clears state silently.
- A pure `OverlayPickResolver` module owns candidate normalization, root deduplication and deterministic sorting. The overlay service continues to own event orchestration, interaction state, mode coordination and style application.
- No large interaction-controller refactor is part of this feature.
- Package version changes and publishing are separate release work and are not part of implementation.

## Testing Decisions

- Vitest is introduced for automated behavior tests. Tests assert public behavior and decision outputs rather than private method structure.
- The highest automated seam is the pure candidate resolver. It is tested with synthetic raw pick records and root resolution inputs, without Cesium WebGL.
- Resolver tests cover Entity and Primitive normalization, composite-part deduplication, root identity, eligibility filtering, priority ordering, visual-order tie-breaking, creation-order tie-breaking, final deterministic fallback and drill-limit behavior.
- Overlay service tests exercise observable selection state, public return values, emitted event payloads and callback order using a controlled scene-picking boundary.
- Selection tests cover pointer select, pointer toggle-off, switching, empty click, idempotent API selection, API clear, hidden, removed, disabled and edit-start reasons.
- Tests verify that selection-change callbacks observe committed state, callback exceptions are isolated, programmatic selection does not invoke click callbacks and repeated idempotent operations do not emit changes.
- Interaction-state tests cover independent hover and selected targets, selected visual precedence, disabled selected styling, style updates while highlighted and restoration of the latest base style.
- Lifecycle tests cover camera start/stop, pointer leave, drawing suspension, editing suspension, edit override of selectable, explicit API commands during editing and silent service destruction.
- Performance-oriented unit tests verify that each governed decision performs at most one bounded drill pick and that no pick or cache fast path has been introduced in the initial implementation.
- Prior art in the repository is the existing overlay service's drill-pick normalization, highlight target grouping, RAF hover coalescing, click interval handling and the shared `PickGovernor`. The new tests preserve these externally visible behaviors while extending them.
- A dedicated playground scenario provides two overlapping surfaces with different priorities, Entity/Primitive overlaps, dynamic priority/selectability/visibility controls and visible selection-event diagnostics.
- The playground also provides repeatable benchmark generators for 12,000 Entity points/icons, 12,000 Primitive surfaces and a mixed 6,000/6,000 scene.
- Manual performance acceptance runs on Windows with a 4-core CPU, 16GB RAM and integrated graphics. With 12,000 simultaneously visible and pickable overlays, mouse movement averages at least 30 FPS, hover response P95 is at most 100ms, and pick-plus-resolution main-thread P95 is at most 16ms.
- Real FPS and WebGL timing thresholds are release-gate measurements on the specified hardware, not CI failure thresholds. CI validates correctness and bounded call behavior to avoid hardware-dependent flakiness.
- If the baseline implementation misses the performance gate, measured data must identify the bottleneck before the smallest correctness-preserving cache or rendering optimization is added. The feature is not complete until the performance gate passes.

## Out of Scope

- Backporting the behavior to 0.x or v0.0.7.
- Multiple persistent selections.
- Click cycling through overlapped candidates.
- Candidate selection menus.
- Hover-change callbacks or public hover subscriptions.
- Keyboard shortcuts, including built-in Escape handling.
- Long-press preview, touch hover or additional touch gestures.
- Automatic pointer cursor changes.
- Cesium picking for HTML information-window DOM elements.
- Allowing non-overlay scene objects to participate in overlay priority ranking.
- Per-frame hover recomputation for animated overlays.
- A scene-pick fast path or candidate cache before benchmark data demonstrates a need.
- A large extraction of all interaction responsibilities into a new controller.
- Package version bumps, lockfile release synchronization, publishing or backport releases.

## Further Notes

- The current codebase already has drill picking, partial Entity/Primitive root normalization, independent click/hover highlight state, RAF hover coalescing and a reusable `PickGovernor`. The implementation should extend these seams rather than duplicate them.
- The earlier research guide remains the official-source rationale for Cesium picking behavior. It must be updated where the final product decisions intentionally differ from its initial recommendations, especially the absence of click cycling, the initial no-cache implementation and the 12,000-object performance gate.
- New public documentation must describe 2.x migration from `clickHighlight` to `selectionHighlight`, the grouped picking configuration, callback ordering and every selection reason.
- Implementation order is test-first: failing resolver tests, failing selection-state tests, resolver implementation, overlay-service orchestration, playground and benchmark work, then final API and migration documentation.
