# 工具栏按钮回调矩阵

## 评估口径

本页只看默认工具栏按钮的回调闭环，统一按 5 个维度审查：

1. 配置入口
2. ToolbarService 注册映射
3. 按钮执行器
4. 实际触发点
5. 缺口与优先级

## 按钮回调矩阵

| 按钮 | 默认配置入口 | 配置入口 | ToolbarService 映射 | 执行器 | 触发点 | 当前状态 | 主要缺口 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `search` | `src/core/services/toolbar/config.ts` 的 `DEFAULT_BUTTON_CONFIGS.search` | `MapPlugin.createToolbarService(options.callbacks)` 或 `ToolbarAdapter.callbacks.search` | `onSearch`、`onSelect` 注入 `SearchButtonHandler` | `SearchButtonHandler.doSearch` 和结果项点击 | 回车后执行搜索，点击结果后执行选择 | 主链路完整 | `searchService.search` 优先于 `onSearch`，属于覆盖式而不是组合式；缺少优先级约定文档 | P2 |
| `measure` -> `measure-distance` | `src/core/services/toolbar/config.ts` 的 `DEFAULT_MEASURE_ITEMS.measure-distance` | `ToolbarCallbacks.onMeasurementStart`、`getDistanceDrawOptions`、`onDistanceComplete` | `onDistanceStart: callbacks?.onMeasurementStart`，完成态回调注入 `MeasureButtonHandler` | `MeasureButtonHandler.startDistanceMeasurement` | 菜单项点击后启动测距，完成时由 `measurementService` 或 `drawHelper` 回流完成事件 | 开始链路与完成链路已接通 | 开始事件仍然是“动作调用后立即触发”，不是“绘制真正开始后触发”；不同 measurementService 需遵守统一完成态协议 | P1 |
| `measure` -> `measure-area` | `src/core/services/toolbar/config.ts` 的 `DEFAULT_MEASURE_ITEMS.measure-area` | `ToolbarCallbacks.onMeasurementStart`、`getAreaDrawOptions`、`onAreaComplete` | `onAreaStart: callbacks?.onMeasurementStart`，完成态回调注入 `MeasureButtonHandler` | `MeasureButtonHandler.startAreaMeasurement` | 菜单项点击后启动测面，完成时由 `measurementService` 或 `drawHelper` 回流完成事件 | 开始链路与完成链路已接通 | 开始事件仍是动作级语义；面积完成依赖 service 或 drawHelper 遵守统一事件协议 | P1 |
| `measure` -> `clear-measurement` | `src/core/services/toolbar/config.ts` 的 `DEFAULT_MEASURE_ITEMS.clear-measurement` | `ToolbarCallbacks.onClear` | `onClear` 注入 `MeasureButtonHandler`，service 可回流 `onClearComplete` | `MeasureButtonHandler.clearMeasurements` | 菜单项点击后清理测量，service 分支在 clear 完成后触发 `onClear`，drawHelper 直连分支同步触发 | 主链路可用 | 新旧分支的“完成确认”语义还不完全一致：service 是显式完成事件，drawHelper 直连分支仍是同步完成假设 | P1 |
| `layers` | `src/core/services/toolbar/config.ts` 的 `DEFAULT_BUTTON_CONFIGS.layers` | `MapPlugin.layers` / `ToolbarAdapter.layers` / `ToolbarServiceOptions.layersPanelStyle` | `onMapTypeChange`、`onPlaceNameToggle`、`onShowNoFlyZones`、`onNoFlyZoneToggle` 注入 `LayersButtonHandler` | `LayersButtonHandler` 菜单项点击与勾选切换 | 点击地图类型卡片或勾选项时触发 service bridge 或回调 | 主链路可用 | 这类回调不经过 `ToolbarCallbacks`，属于第二套体系；与 search/measure/simple buttons 缺少统一抽象 | P1 |
| `view2d3d` | `src/core/services/toolbar/config.ts` 的 `DEFAULT_BUTTON_CONFIGS.view2d3d` | 新架构依赖 `setMapController`，旧架构依赖 `ToolbarAdapterMapController` | 无 ToolbarCallbacks 映射，SimpleButtonHandler 仅持有 `mapController` | `SimpleButtonHandler.handleClick` -> `mapController.toggle2D3D` | 点击按钮立即切换 2D/3D | 动作可用 | 没有统一的模式变更回调回流到 `ToolbarCallbacks` | P1 |
| `location` | `src/core/services/toolbar/config.ts` 的 `DEFAULT_BUTTON_CONFIGS.location` | 新架构依赖 `setMapController`，旧架构依赖 `ToolbarAdapter.callbacks.resetLocation` | 无 ToolbarCallbacks 到 `SimpleButtonHandler` 的直接映射 | `SimpleButtonHandler.handleClick` -> `mapController.resetLocation` | 点击按钮立即复位视角 | 旧兼容链路可回调，MapPlugin 新链路未见回调桥接 | `ToolbarCallbacks.onResetLocation` 已定义但在新链路里未接通 | P0 |
| `zoom-in` | `src/core/services/toolbar/config.ts` 的 `DEFAULT_BUTTON_CONFIGS.zoom-in` | 新架构依赖 `setMapController`，旧架构依赖 `ToolbarAdapter.callbacks.zoom.onZoomIn` | 无 ToolbarCallbacks 到 `SimpleButtonHandler` 的直接映射 | `SimpleButtonHandler.handleClick` -> `mapController.zoomOut` | 点击“缩小”按钮后相机高度增大 | 业务行为正确 | 内部 `id=zoom-in` 与 UI 文案“缩小”语义反向，容易误导维护者；`onZoomIn` 在新链路中未统一接通 | P1 |
| `zoom-out` | `src/core/services/toolbar/config.ts` 的 `DEFAULT_BUTTON_CONFIGS.zoom-out` | 新架构依赖 `setMapController`，旧架构依赖 `ToolbarAdapter.callbacks.zoom.onZoomOut` | 无 ToolbarCallbacks 到 `SimpleButtonHandler` 的直接映射 | `SimpleButtonHandler.handleClick` -> `mapController.zoomIn` | 点击“放大”按钮后相机高度减小 | 业务行为正确 | 内部 `id=zoom-out` 与 UI 文案“放大”语义反向，容易误导维护者；`onZoomOut` 在新链路中未统一接通 | P1 |
| `fullscreen` | `src/core/services/toolbar/config.ts` 的 `DEFAULT_BUTTON_CONFIGS.fullscreen` | 新架构依赖 `setMapController`，旧架构依赖 `ToolbarAdapter.callbacks.fullscreen` | 无 ToolbarCallbacks 到 `SimpleButtonHandler` 的直接映射 | `SimpleButtonHandler.handleClick` -> `mapController.toggleFullscreen` | 点击按钮后请求进入或退出全屏 | 旧兼容链路可回调，MapPlugin 新链路未见回调桥接 | `ToolbarCallbacks.onFullscreenChange` 已定义但在新链路里未接通 | P0 |
| 自定义按钮 | 业务侧 `buttonConfigs` 或 `addCustomButton` | `ToolbarService.addCustomButton(config, onClick)` 或 `ToolbarPluginOptions.buttonConfigs[*].onClick` | 不走 ToolbarCallbacks，直接挂到 `SimpleButtonHandler.config.onClick` | `SimpleButtonHandler.handleClick` | 点击按钮先执行自定义 `onClick`，不再走 mapController 默认行为 | 行为明确 | 与默认按钮回调体系完全分离，缺少统一追踪与埋点入口 | P2 |

## 回调链路摘要

### 1. Search

配置入口：`MapPlugin.options.callbacks.onSearch/onSelect` 或 `ToolbarAdapter.callbacks.search`

调用链：

`ToolbarService.registerDefaultButtonHandlers` -> `SearchButtonHandler` -> `doSearch` -> `searchService.search` 或 `onSearch` -> `showSearchResults` -> 点击结果触发 `onSelect`

评估：主流程最完整，问题主要是回调优先级没有明确约定。

### 2. Measure

配置入口：`ToolbarCallbacks.onMeasurementStart/getDistanceDrawOptions/getAreaDrawOptions/onClear/onDistanceComplete/onAreaComplete`

调用链：

`ToolbarService.registerDefaultButtonHandlers` -> `MeasureButtonHandler` -> `MeasureMenu` -> `startDistanceMeasurement/startAreaMeasurement/clearMeasurements`

评估：开始、完成、清理三条链路都已接通；当前剩余问题是开始/清理回调仍偏动作语义，且自定义 measurementService 需要实现统一完成态协议。

### 3. Simple Buttons

配置入口：默认情况下不直接消费 `ToolbarCallbacks`，而是依赖 `mapController`

调用链：

`ToolbarService.registerDefaultButtonHandlers` -> `SimpleButtonHandler.handleClick` -> `mapController`

评估：新旧两条路径都已能回流 zoom/fullscreen/resetLocation 回调；当前问题已从“缺桥接”转为“不同入口的命名和抽象不统一”。

### 4. Layers

配置入口：`MapPlugin.layers`、`ToolbarService.setLayersService`、`LayersButtonHandlerOptions`

调用链：

`ToolbarService.registerDefaultButtonHandlers` -> `LayersButtonHandler` -> service bridge / option callbacks

评估：功能可用，但它和 `ToolbarCallbacks` 不属于同一套回调模型。

## 关键缺口清单

### P0

1. `measurementService` 需要遵守显式完成态协议，避免业务侧只能依赖 drawHelper 间接闭环。

### P1

1. `zoom-in` / `zoom-out` 的内部 `id` 与 UI 文案语义反向，容易在维护和扩展回调时造成误判。
2. `onMeasurementStart` 仍然是动作调用后立即触发，不是“绘制真正开始后触发”。
3. `onClear` 在 service 分支和 drawHelper 直连分支的完成语义还不完全一致。
4. `layers` 回调体系与 `ToolbarCallbacks` 平行存在，抽象不统一。
5. 新旧两套入口对同一类回调的建模不同。

### P2

1. `searchService.search` 与 `onSearch` 的优先级没有文档化。
2. 自定义按钮回调不纳入统一的回调观测面。

## 最小验证项

| 按钮 | 最小验证断言 |
| --- | --- |
| `search` | 输入关键词并回车后，能够调用 `onSearch` 或 `searchService.search`；点击结果后调用 `onSelect` |
| `measure-distance` | 菜单点击后启动绘制，并在结束时回流距离完成回调 |
| `measure-area` | 菜单点击后启动绘制，并在结束时回流面积完成回调 |
| `clear-measurement` | 清除图元成功后再触发 `onClear` |
| `view2d3d` | 点击后场景模式切换，并有统一回调可观测 |
| `location` | 点击后完成复位，并触发复位回调 |
| `zoom-in` | 点击“缩小”后相机高度增大，并触发对应缩小链路回调 |
| `zoom-out` | 点击“放大”后相机高度减小，并触发对应放大链路回调 |
| `fullscreen` | 点击后全屏状态变化，并触发状态回调 |
| `layers` | 点击地图类型、路网和禁飞区开关后，对应 bridge 回调只触发一次 |
