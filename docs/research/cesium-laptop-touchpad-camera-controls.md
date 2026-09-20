# CesiumJS 笔记本触控板相机控制方案

## 调查范围与结论

本文只核对 CesiumJS、W3C 和 WebKit 的一手资料。项目锁定的版本是 `cesium@1.134.1` / `@cesium/engine@21.0.1`；Cesium `1.134.1` tag 对应提交 [`0f84b3e65a32aa865a7cf6f1e78da5298545aa1b`](https://github.com/CesiumGS/cesium/tree/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b)。

核心结论：**普通 Windows/macOS 笔记本触控板不等同于触摸屏，不能指望 Cesium 的 `CameraEventType.PINCH` 接收到触控板双指接触点。** 对网页而言，触控板的一指按压拖动通常表现为鼠标拖动，双指滑动通常表现为 `wheel`。因此：

- 现有 `Ctrl + LEFT_DRAG` 在触控板上的直接等价操作是：按住键盘 `Ctrl`，按下触控板并保持按压，再拖动。
- 若希望“不按 Ctrl、只在触控板上操作”，可靠的配置级方案是把一个可由触控板产生的鼠标拖动事件分配给 `tiltEventTypes`；这会同时改变鼠标行为，因为标准事件没有可靠的“这是触控板”标识。
- 若希望“双指自由滑动就二维旋转”，Cesium 官方事件配置本身不够，需要自定义 DOM `wheel` 适配层；且必须用模式开关或修饰键消除与滚轮缩放的歧义。

## Cesium 官方默认映射

`ScreenSpaceCameraController` 接受单个事件、带 `modifier` 的事件对象或它们的数组。固定版本默认值如下：[官方源码，147–225 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/Scene/ScreenSpaceCameraController.js#L147-L225)、[当前 API](https://cesium.com/learn/cesiumjs/ref-doc/ScreenSpaceCameraController.html)。

| 相机动作 | 默认输入 | 说明 |
| --- | --- | --- |
| `translateEventTypes` | `LEFT_DRAG` | 只适用于 2D 和 Columbus View |
| `zoomEventTypes` | `RIGHT_DRAG`、`WHEEL`、`PINCH` | 缩放 |
| `rotateEventTypes` | `LEFT_DRAG` | 绕地球或对象旋转，适用于 3D 和 Columbus View |
| `tiltEventTypes` | `MIDDLE_DRAG`、`PINCH`、`Ctrl + LEFT_DRAG`、`Ctrl + RIGHT_DRAG` | 3D/CV 倾斜；2D 扭转 |
| `lookEventTypes` | `Shift + LEFT_DRAG` | 改变观察方向，适用于 3D/CV |

因此，用户描述的 `Ctrl + 左键拖动` 对应官方默认的 **tilt（绕选中支点倾斜/环绕）**，而不是 `rotateEventTypes` 的无修饰左拖。产品文案可统称“旋转视角”，但代码设计时应区分 `tilt`、`rotate` 与 `look`。

`CameraEventType` 只定义五种相机输入：`LEFT_DRAG`、`RIGHT_DRAG`、`MIDDLE_DRAG`、`WHEEL`、`PINCH`；其中 `PINCH` 的注释是触摸表面上的双指触摸：[官方源码，1–46 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/Scene/CameraEventType.js#L1-L46)。修饰键仅有 `SHIFT`、`CTRL`、`ALT`：[官方源码](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/Core/KeyboardEventModifier.js#L1-L30)。

## 为什么触控板双指通常不会成为 Cesium `PINCH`

Cesium 在浏览器支持 Pointer Events 时注册 `pointerdown/up/move/cancel`；否则注册鼠标事件和 Touch Events：[官方源码，70–148 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/Core/ScreenSpaceEventHandler.js#L70-L148)。在 Pointer Events 路径中，只有 `event.pointerType === "touch"` 才会被放入多触点集合，其他输入直接按鼠标处理：[官方源码，831–888 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/Core/ScreenSpaceEventHandler.js#L831-L888)。只有集合中存在两个触点时，Cesium 才计算双指距离、角度和中心高度并派发 pinch movement：[官方源码，746–828 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/Core/ScreenSpaceEventHandler.js#L746-L828)。

W3C Pointer Events 规范也明确说明：笔记本触控板上的“拖动滚动”一般通过触控板生成“假的鼠标滚轮事件”完成，不属于直接触摸操纵：[Pointer Events Level 3，术语 direct manipulation](https://www.w3.org/TR/pointerevents3/#dfn-direct-manipulation)。这正是触摸屏双指能进入 Cesium `PINCH`、普通触控板双指通常只能进入 `WHEEL` 的边界。

Windows 和 macOS 的设备驱动、系统设置及浏览器可能把手势映射为不同鼠标/滚轮序列，Web 标准并未提供一个稳定的“触控板设备类型”供业务判断。W3C UI Events 将滚轮的“rotation”定义为可能来自真实滚轮，也可能来自平面上的移动；`WheelEvent` 只暴露 `deltaX/Y/Z` 和修饰键等结果数据：[UI Events，Wheel Events](https://www.w3.org/TR/uievents/#events-wheelevents)。因此用 `deltaMode`、增量大小或是否存在 `deltaX` 猜测触控板都只能是启发式判断。

在 macOS Safari/WebKit 中还存在 WebKit 的 `GestureEvent` 接口：[Apple 官方文档](https://developer.apple.com/documentation/webkitjs/gestureevent)。它不是 Cesium 这里注册的输入之一，也不是跨 Windows/macOS 的统一方案，因此不应作为组件默认能力。

## `WHEEL` 的另一个限制

Cesium 的 `ScreenSpaceEventHandler` 处理标准 `wheel` 时只读取 `deltaY`，换算成一个标量后交给上层；没有向 `ScreenSpaceCameraController` 传递 `deltaX`：[官方源码，414–455 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/Core/ScreenSpaceEventHandler.js#L414-L455)。`CameraEventAggregator` 又把该标量放入虚拟 movement 的 `y` 分量：[官方源码，133–172 行](https://github.com/CesiumGS/cesium/blob/0f84b3e65a32aa865a7cf6f1e78da5298545aa1b/packages/engine/Source/Scene/CameraEventAggregator.js#L133-L172)。

所以把 `CameraEventType.WHEEL` 直接加入 `tiltEventTypes`，最多只能得到单轴动作，不能把触控板双指横向、纵向增量完整映射为二维视角旋转；它也会与默认滚轮缩放冲突。

## 可选方案

### 方案 A：保持代码不变

使用 `Ctrl + 触控板按压拖动`：按住 `Ctrl`，一指把触控板按下并保持，再拖动；也可以按住触控板左下角，用另一根手指移动。它产生 `Ctrl + LEFT_DRAG`，完整命中 Cesium 默认 `tiltEventTypes`。

优点是零开发、桌面鼠标行为完全不变、Windows/macOS 都走标准鼠标事件。缺点是仍需键盘，且不同触控板的“轻点拖动/拖移锁定”由系统设置决定。

### 方案 B：官方配置级映射（推荐）

为组件增加明确的“触控板视角模式”，开启时把无修饰 `LEFT_DRAG` 分配给 `tiltEventTypes`，并把原本的 `rotateEventTypes` 左拖迁移到另一个组合键，避免同一输入同时驱动两个动作。示意配置如下，最终组合键需结合产品现有快捷键确认：

```ts
controller.tiltEventTypes = [
  Cesium.CameraEventType.LEFT_DRAG,
  Cesium.CameraEventType.MIDDLE_DRAG,
  Cesium.CameraEventType.PINCH,
  {
    eventType: Cesium.CameraEventType.LEFT_DRAG,
    modifier: Cesium.KeyboardEventModifier.CTRL,
  },
]

controller.rotateEventTypes = {
  eventType: Cesium.CameraEventType.LEFT_DRAG,
  modifier: Cesium.KeyboardEventModifier.ALT,
}
```

触控板操作变为“一指按下并拖动”，不再需要 `Ctrl`。建议用显式模式开关而不是全局永久替换，因为浏览器无法可靠区分这次左拖来自鼠标还是触控板；开启后鼠标左拖也会执行 tilt。此方案只使用 Cesium 官方公开配置，改动小、生命周期和相机惯性仍由 Cesium 管理。

如果不希望交换左拖，可把 `RIGHT_DRAG` 分给 tilt，并从 `zoomEventTypes` 删除 `RIGHT_DRAG`，保留 `WHEEL` / `PINCH` 缩放。它依赖系统能稳定产生“右键按住并拖动”，不同触控板的可用性和易用性不如左拖模式。

### 方案 C：自定义双指滑动适配

在 canvas 上监听原生 `wheel`，读取 `deltaX` / `deltaY`，调用公开的相机旋转方法；同时从 Cesium 的 `zoomEventTypes` 中移除相同手势，避免一次输入既缩放又旋转。必须再增加一个显式“旋转模式”或修饰键，因为网页无法可靠区分鼠标滚轮和触控板双指滚动。

此方案才能接近“双指不按压、横纵滑动控制二维视角”，但跨设备手感、增量归一化、惯性、页面滚动抑制、组件销毁解绑都要自行维护。它不适合作为默认首选；若产品明确要求这种手势，应先做 Windows Edge/Chrome 与 macOS Safari/Chrome 的真机验证。

## 建议验收矩阵

无论选择方案 B 还是 C，至少验证：

- Windows Precision Touchpad：Edge、Chrome。
- macOS Force Touch Trackpad：Safari、Chrome。
- 外接鼠标：左拖、右拖、中键拖、滚轮及 `Ctrl` / `Shift` / `Alt` 组合不发生意外冲突。
- 3D、2D、Columbus View 分别验证，因为 `translate`、`rotate`、`tilt` 的适用场景不同。
- 组件创建/销毁多次后监听器不重复，绘制和测量模式不会误触发相机动作。
