# 02 — 统一点位编辑并恢复 0.x 默认句柄语义

**What to build:** 让点位覆盖物在所有入口上都使用统一编辑引擎，并把默认句柄外观恢复到 0.x 的移动点语义，同时保留实时编辑回调和最终结果回调。

**Blocked by:** 01 — 统一编辑入口与公开编辑契约

**Status:** ready-for-agent

- [ ] `point` 在 `OverlayService`、`MarkService`、`CesiumOverlayService`、`CesiumMapMark` 上的编辑进入方式和编辑结果一致。
- [ ] 点位默认句柄外观对齐 0.x，而不是沿用当前通用顶点视觉。
- [ ] 点位拖拽时实时触发 `change`，结束编辑时总是返回最终快照。

