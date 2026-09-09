# 02 — 收口 Overlay 编辑句柄配置契约

**What to build:** 让统一编辑内核真正兑现公开的句柄配置契约。业务可以稳定地用默认配置和本次会话覆盖配置控制 `vertex / mid / move / rotate / scale` 的启用状态和外观，而不是只在类型和文档里声明支持。

**Blocked by:** 01 — 统一标绘编辑到单一 Overlay 编辑内核

**Status:** ready-for-agent

- [ ] `OverlayEditOptions` 的默认配置与会话覆盖配置按字段合并，并在所有入口上得到相同结果。
- [ ] `false` 和 `enable` 都能真实控制对应句柄是否创建、是否可交互，而不是仅保留为类型字段。
- [ ] 句柄关闭后不会残留不可见但仍能命中的编辑交互目标。
