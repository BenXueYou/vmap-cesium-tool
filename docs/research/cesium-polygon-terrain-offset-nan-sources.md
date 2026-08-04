# Cesium 多边形地形偏移产生 NaN：官方源码证据

## 调查范围与版本

本文只核对 CesiumJS 官方一手资料，目标版本为 `cesium@1.134.1` / `@cesium/engine@21.0.1`，不讨论项目业务实现。

- Cesium 官方仓库 `1.134.1` tag 指向提交 [`0f84b3e65a32aa865a7cf6f1e78da5298545aa1b`](https://github.com/CesiumGS/cesium/tree/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b)。该提交的根 `package.json` 声明版本 `1.134.1`，并依赖 `@cesium/engine ^21.0.1`：[官方源码](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/package.json#L1-L54)。
- 同一提交中，engine 包明确声明名称 `@cesium/engine`、版本 `21.0.1`：[官方源码](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/package.json#L1-L3)。

## 结论一：`PolygonGeometryUpdater._computeCenter` 没有防护零面积多边形

`_computeCenter` 只提前排除了两种情况：没有 hierarchy，以及 `positions.length === 0`。它没有检查顶点少于 3 个、顶点重复、顶点共线或最终有向面积为 0：[官方源码，235–246 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/DataSources/PolygonGeometryUpdater.js#L235-L246)。

之后，该方法把顶点投影到椭球切平面，使用鞋带公式累计 `area` 和重心分子，最后无条件执行：

```js
const a = 1.0 / (area * 3.0);
centroid2D = Cartesian2.multiplyByScalar(centroid2D, a, centroid2D);
```

来源：[官方源码，249–273 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/DataSources/PolygonGeometryUpdater.js#L249-L273)。

当多边形退化且 `area === 0` 时，比例因子成为 `Infinity`。`Cartesian2.multiplyByScalar` 是直接逐分量乘法，没有有限值保护：[官方源码，539–548 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/Core/Cartesian2.js#L539-L548)。因此，对重合点或精确共线点这类零面积输入，典型计算是 `0 * Infinity`，重心变为 `(NaN, NaN)`；随后的切平面反投影也会把非有限值带入返回的 `Cartesian3`：[官方源码，327–351 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/Core/EllipsoidTangentPlane.js#L327-L351)。

### 机械验证

使用仓库实际安装的 `@cesium/engine@21.0.1`，逐句运行上述官方实现，对“3 个完全重合点”和“3 个共线点”两组输入，结果均为：

```text
area = 0
a = Infinity
centroid2D = (NaN, NaN)
projectPointOntoEllipsoid(...) = (NaN, NaN, NaN)
```

这不是额外假设，而是对上述固定版本源码算术路径的直接验证。

## 结论二：只要任一高度参考 Property 存在，就创建 `TerrainOffsetProperty`

`GroundGeometryUpdater._onEntityPropertyChanged` 会先销毁旧的地形偏移属性，再读取：

- `geometry.heightReference`
- `geometry.extrudedHeightReference`

只要两者任意一个是 `defined`，它就用子类的 `_computeCenter` 包装一个 `CallbackProperty`，并创建 `TerrainOffsetProperty`。这里没有先判断枚举值是否为 `RELATIVE_TO_GROUND`，也没有检查当前 polygon 是否有效或面积是否为 0：[官方源码，115–137 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/DataSources/GroundGeometryUpdater.js#L115-L137)。

需要区分“创建条件”和“实际返回偏移的条件”：

- 创建条件只是任一高度参考 Property 存在。
- `TerrainOffsetProperty.getValue` 在 `heightReference === NONE` 且 extrusion 也不是 relative 时返回零偏移；否则继续计算地形偏移：[官方源码，159–188 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/DataSources/TerrainOffsetProperty.js#L159-L188)。

对于静态几何，包装出的 `CallbackProperty` 被标记为 constant；`TerrainOffsetProperty` 构造时会立即读取中心点并调用 `_updateClamping`：[GroundGeometryUpdater 127–135 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/DataSources/GroundGeometryUpdater.js#L127-L135)、[TerrainOffsetProperty 60–74 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/DataSources/TerrainOffsetProperty.js#L60-L74)。对于动态几何，`getValue` 会在运行时重新读取中心位置，并在位置变化时更新 clamping：[官方源码，191–216 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/DataSources/TerrainOffsetProperty.js#L191-L216)。

这意味着：绘制过程中只要某一帧 hierarchy 暂时是重复点或共线点，且已配置高度参考 Property，就可能把 `_computeCenter` 产生的 NaN 送入地形偏移链路。是否“偶现”取决于业务代码向 Cesium 暴露中间绘制态的时序；这一句是基于固定版本源码的推论，不是 Cesium 官方文档原文。

## 结论三：`RELATIVE_TO_GROUND` 的官方语义

Cesium 1.134.1 源码对 `HeightReference.RELATIVE_TO_GROUND` 的原文定义是：

> The position height is the height above the terrain and 3D Tiles.

即“位置的高度表示其高于 terrain 和 3D Tiles 表面的高度”，枚举值为 `2`：[固定版本官方源码，21–26 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/Scene/HeightReference.js#L21-L26)。官方当前 API 页面也给出相同定义：[HeightReference API](https://cesium.com/learn/cesiumjs/ref-doc/global.html#HeightReference)。

Cesium 同时把 `RELATIVE_TO_GROUND` 分类为“相对表面偏移”的高度参考，而非纯绝对高度：[官方源码，73–84 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/Scene/HeightReference.js#L73-L84)。Polygon 的 `heightReference` 和 `extrudedHeightReference` API 默认语义均为 `HeightReference.NONE`：[固定版本 PolygonGraphics 源码，151–174 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/DataSources/PolygonGraphics.js#L151-L174)、[官方 PolygonGraphics API](https://cesium.com/learn/cesiumjs/ref-doc/PolygonGraphics.html#heightReference)。

## 与截图堆栈的闭环

截图中的错误链可以由固定版本源码完整解释：

1. 零面积 polygon 使 `_computeCenter` 返回含 NaN 的 `Cartesian3`，见结论一。
2. `TerrainOffsetProperty._updateClamping` 把这个 position 传给 `ellipsoid.cartesianToCartographic`：[官方源码，118–147 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/DataSources/TerrainOffsetProperty.js#L118-L147)。
3. `Ellipsoid.cartesianToCartographic` 内部调用 `geodeticSurfaceNormal`：[官方源码，512–521 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/Core/Ellipsoid.js#L512-L521)。
4. `geodeticSurfaceNormal` 明确检查三个 Cartesian 分量，任一为 NaN 就抛出 `DeveloperError("cartesian has a NaN component")`：[官方源码，407–412 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/Core/Ellipsoid.js#L407-L412)。

因此，截图并非泛化的 WebGL 渲染错误；其直接触发点是地形偏移在把 polygon 中心转换为经纬高时收到了含 NaN 的中心点，而固定版本的 polygon 中心算法对零面积中间态没有防护。
