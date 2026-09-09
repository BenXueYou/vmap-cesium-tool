# 01 — 统一编辑入口与公开编辑契约

**What to build:** 让覆盖物编辑只有一套正式入口和一份正式编辑配置契约。`OverlayService` 成为唯一编辑内核，`MarkService`、`CesiumOverlayService`、`CesiumMapMark` 全部走同一条编辑启动链路，同时保持现有调用方式继续可用。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `OverlayEditOptions` 成为正式公开类型，所有编辑入口围绕同一个配置概念工作。
- [ ] `enableEdit` / `setOverlayEditMode` 作为默认配置入口，`startEdit` / `startOverlayEdit` 作为本次会话覆盖入口，且覆盖规则按字段合并。
- [ ] `MarkService` 不再维护独立编辑实现，而是把编辑会话委托给统一编辑内核。

