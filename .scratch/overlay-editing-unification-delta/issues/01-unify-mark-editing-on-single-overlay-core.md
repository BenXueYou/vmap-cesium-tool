# 01 — 统一标绘编辑到单一 Overlay 编辑内核

**What to build:** 让 `MarkService`、`CesiumMapMark` 和兼容覆盖物入口不再各自维护分叉的编辑实现。所有图形的编辑会话都通过同一条 Overlay 编辑内核启动、切换、停止和提交，从而让选择联动、hover 抑制、双击退出和回调时序在所有入口上表现一致。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `point / polyline / polygon / rectangle / circle` 在 `OverlayService`、`MarkService`、兼容入口上都通过同一条编辑会话链路进入和退出。
- [ ] 编辑期间的 `selected` 接管、普通 hover / pointer selection 暂停、双击退出和切换编辑目标时提交旧结果的规则，在所有入口上保持一致。
- [ ] `MarkService` 不再保留与统一内核并行的旧编辑 handler 行为分支。
