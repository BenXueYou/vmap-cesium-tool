---
title: Overlay Selection Performance
---

# 12,000 Overlay 性能验收

这份记录用于对应 selection spec 里的手工验收门槛，而不是 CI 自动门槛。

## 验收门槛

在 Windows、4 核 CPU、16GB 内存、集成显卡环境下，`12,000` 个同时可见且可拾取 overlay 需要满足：

- 平均 FPS `>= 30`
- hover 响应 P95 `<= 100ms`
- pick + resolution 主线程耗时 P95 `<= 16ms`

## Playground 场景

当前 playground 已提供三类可重复生成的基准场景：

1. `12,000 Entity markers`
2. `12,000 primitive circles`
3. `6,000 entity + 6,000 primitive mixed`

位置：

- 打开 playground
- 进入 `Overlay API`
- 展开 `12,000 Overlay Benchmark`

## 建议验收步骤

1. 使用 `Overlay API` 页面重建地图，确保 overlay picking 配置生效。
2. 生成目标 benchmark 场景。
3. 等待镜头稳定后，连续移动鼠标穿过高密度区域至少 20 到 30 秒。
4. 观察 benchmark 面板里的：
   - `FPS Avg`
   - `Hover P95`
   - `Pick P95`
   - `Acceptance`
5. 分别对 `Entity / Primitive / Mixed` 三个场景重复一次。
6. 将结果回填到下方“最新记录”表格。

## 最新记录

截至 **2026-07-30**，仓库内尚未附带一次符合 spec 环境要求的人工 WebGL 验收结果。

当前状态：

- `Acceptance status`: `pending`
- `结论`: **selection feature 还不能宣称已经通过 12,000 overlay 性能门槛**
- `原因`: 当前命令行 / 单元测试环境无法替代目标 Windows 图形环境，仓库中也还没有一份已记录的人工验收数据

## 记录模板

| Date | Scenario | FPS Avg | Hover P95 | Pick P95 | Result | Notes |
| --- | --- | ---: | ---: | ---: | --- | --- |
| 2026-07-30 | Entity 12,000 | - | - | - | Pending | 尚无符合 spec 环境的人工验收数据 |
| 2026-07-30 | Primitive 12,000 | - | - | - | Pending | 尚无符合 spec 环境的人工验收数据 |
| 2026-07-30 | Mixed 6,000/6,000 | - | - | - | Pending | 尚无符合 spec 环境的人工验收数据 |

## 说明

- 这里的 `Hover P95` 使用 playground 对 `updateHoverAtPosition` 的采样作为当前实现的近似指标。
- 这里的 `Pick P95` 使用 playground 对 `pickOverlayEntity` 的采样作为当前实现的近似指标。
- 若人工验收未达标，下一步应先记录是哪一类场景失败，再决定是否引入额外优化；在没有数据前，不要提前加 pick cache 或改变排序语义。
