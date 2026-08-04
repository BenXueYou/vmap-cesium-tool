# 多边形预览触发 `cartesian has a NaN component`

## 结论

问题发生在动态预览阶段，不是最终多边形的面积计算阶段，也不是 Cesium 版本不一致导致的。

1.x 在已有两个已落点后，把鼠标位置作为第三个预览点。预览工厂只检查候选点数量是否达到 3，没有检查候选是否包含重复点、是否共线、面积是否接近 0。当拾取抖动使预览点与最后一个已落点重合，或三点恰好共线时，会把零面积 `PolygonHierarchy` 交给 Cesium。

Cesium 1.134.1 的 `PolygonGeometryUpdater` 会计算该 Polygon 的二维质心。零面积导致 `1 / (area * 3)` 除零，质心成为带 `NaN` 的 `Cartesian3`。该中心随后进入 `TerrainOffsetProperty -> Ellipsoid.cartesianToCartographic -> geodeticSurfaceNormal`，最终抛出附件中的 `DeveloperError: cartesian has a NaN component` 并停止渲染。

“偶现”来自预览点与已落点重合/共线的短暂交互状态和 Cesium 帧更新时机；顶点自身的 `x/y/z` 都可以是有限数，现有的逐点 `isValidCartesian3` 因而无法拦截这种几何级退化。

## 1.x 证据链

- `DrawInteractionController` 已过滤屏幕坐标及拾取结果中的 `NaN/Infinity`，所以“坏的单个 Cartesian3 直接从 pick 进入”不是当前首要原因。
- `DrawService.onMouseMove` 在存在已落点后调用 `renderPreview(position)`。
- `DrawPreviewFactory.createPreviewPolygon` 使用 `[...basePositions, previewPoint]`，只要长度达到 3 就创建 Polygon；创建前没有唯一点数、共线或面积校验。
- 默认 `clampToGround=true`；Polygon 被设置为 `height=0.1` 和 `heightReference=RELATIVE_TO_GROUND`，进入 Cesium 的地形偏移链路。
- `finishDrawing` 已检查最终 Polygon 面积是否为有限正数，因此本问题主要暴露在预览实体，而不是最终实体。

关键代码：

- `src/core/services/draw/DrawService.ts`：鼠标移动和 `renderPreview`。
- `src/core/services/draw/entities/drawPreviewFactory.ts`：候选拼接、仅按数量建面、贴地属性。
- `src/core/services/draw/geometry/drawPosition.ts`：当前只做逐点有限数校验。

## 可重复诊断

正式回归用例位于 `tests/DrawServicePolygonPreview.test.ts`。它通过公开的 `DrawService.startDrawingPolygon()` 驱动两次落点和鼠标预览，并让真实 Cesium `PolygonGeometryUpdater` 消费生成的 Entity。

```powershell
npx vitest run tests/DrawServicePolygonPreview.test.ts --reporter=verbose
```

修复前，重合预览点用例稳定失败，异常及栈与附件一致：

```text
DeveloperError: cartesian has a NaN component
  at Ellipsoid.geodeticSurfaceNormal
  at Ellipsoid.cartesianToCartographic
  at TerrainOffsetProperty._updateClamping
  at new TerrainOffsetProperty
  at GroundGeometryUpdater._onEntityPropertyChanged
  at new PolygonGeometryUpdater
  at DrawPreviewFactory.createPolygonFillEntity
  at DrawPreviewFactory.createPreviewPolygon
```

修复后，重合点、共线点、正常三角形预览和正常绘制完成 4 个场景均通过：退化候选只保留折线预览，正常候选继续创建并完成 Polygon。

## 为什么 0.x 未观察到

0.x 使用的是一套防御更重、状态更分散的方案：

1. 单击只增加已落点，并以无预览点参数刷新；两个已落点不会创建 Polygon。鼠标真正移动后，才使用独立的预览点形成第三点。
2. 只有 `tilesLoaded` 后才调用 `globe.pick`，否则回退到椭球拾取；屏幕坐标、拾取 Cartesian3、Cartographic 转换和 `fromRadians` 结果均做有限数校验并克隆。
3. 预览 Polygon 复用已有 Entity，并使用显式抬高后的世界坐标、`perPositionHeight=true`、`heightReference=NONE`；边线使用普通 Polyline，而不是贴地 Polyline。
4. 完成后保存地面点；等地形瓦片稳定，再通过 `sampleTerrainMostDetailed` 分批采样，将显式高度写回 Polygon，继续保持 `heightReference=NONE`。这是一种“先安全显示、后异步地形精化”的两阶段方案。
5. 双击结束前会去掉距离小于 5cm 的重复末点。

这套方案降低了不稳定拾取、重复点和地形状态变化同时进入渲染管线的概率，也避免把 Polygon 的展示持续绑定到 `RELATIVE_TO_GROUND`。

但需要精确说明：0.x 不是从数学上彻底免疫。Cesium 的 `GroundGeometryUpdater` 只要看到已定义的 `heightReference` 属性就会创建 `TerrainOffsetProperty`，即使值是 `NONE`；强行向 0.x 形态传入 `[A,B,B]`，同样可以复现该异常。因此，“0.x 没出现”说明它的事件时序和防御使实际触发概率较低，不代表可直接照搬 0.x 就能保证修复。

## 版本和历史结论

- 0.x 与 1.x 当前均使用 `cesium@1.134.1` / `@cesium/engine@21.0.1`，排除依赖版本差异。
- 1.x 的新绘制模块来自提交 `a51a40a`（2026-03-26，`feat:重构绘制类`）。重构保留了逐点有效性过滤，但没有继承 0.x 的全部预览时序、地形就绪门控和两阶段精化策略。
- 0.x 的相关防御可追溯到 `5ca2515`、`046124c` 等多边形修复提交。

## 已实施的修复边界

规则建立在 `DrawPreviewFactory` 入口，而不是只在鼠标事件里删除一次重复点：

1. 创建 Polygon 前，要求至少 3 个相距超过 1mm 的不同顶点。
2. 将候选投影到局部二维平面，要求面积为有限数且大于 `1e-6 m²`。
3. 退化时仍可显示折线和点，但不创建 Polygon Entity，也不创建面积标签。
4. 回归用例至少覆盖 `[A,B]+B`、三个共线点、三个正常点，以及最终绘制路径。
5. 可额外恢复 0.x 的 `tilesLoaded` 拾取门控或稳定回退，但它属于降低不稳定输入概率的第二层防御，不能替代几何有效性校验。

不建议仅把 `RELATIVE_TO_GROUND` 改成 `NONE` 作为修复。实测退化 Polygon 在两种值下都能进入同一 NaN 链路；真正的边界必须是“不让退化几何进入 Cesium”。

## 一手参考资料

官方固定版本源码和 API 引用汇总见：[`../research/cesium-polygon-terrain-offset-nan-sources.md`](../research/cesium-polygon-terrain-offset-nan-sources.md)。
