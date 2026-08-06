# 统一 Overlay 编辑内核

## Context

1.x 之前存在多条编辑路径：`OverlayService`、`MarkService`、`CesiumOverlayService` 各自承担部分编辑职责，容易出现默认句柄、回调时机和兼容入口语义不一致的问题。

## Decision

- `OverlayService` 作为唯一编辑内核，负责真实的句柄创建、拖拽、插点、删除、旋转与缩放。
- `MarkService` 只保留标绘编排、结果同步和业务回调职责，不再维护独立编辑实现。
- `CesiumOverlayService` 只作为兼容适配层，编辑能力统一转发到 `OverlayService`。
- `point / polyline / polygon / rectangle / circle` 的默认句柄与 `change` / `end` 语义以 `OverlayService` 为准。

## Consequences

- 公开文档、兼容文档和编辑指南可以围绕同一套语义描述。
- 回归测试只需要围绕统一编辑内核和两层入口适配做校验。
- 后续编辑能力只需在 `OverlayService` 维护一份实现。
