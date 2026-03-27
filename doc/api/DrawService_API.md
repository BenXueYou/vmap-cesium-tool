# DrawService API 文档

## 概述

`DrawService` 是新架构下的绘制服务，负责处理交互式绘制流程，包括：

- 启动线、面、矩形、圆绘制
- 管理临时预览实体与最终实体
- 输出统一的绘制完成结果
- 提供绘制开始、结束、实体移除等事件回调

如果你的目标是“直接拿到绘制完成后的实体与坐标”，应优先使用 `DrawService`；如果你的目标是“从工具栏里触发测量”，则由 `ToolbarService` 在上层继续封装业务回调。

顶层导出：

```ts
import {
  DrawService,
  type DrawMode,
  type DrawOptions,
  type DrawResult,
  type MeasurementTheme,
} from '@xingm/vmap-cesium-toolbar';
```

## 推荐接入方式

### 1. 通过 MapPlugin 获取

这是推荐方式。

```ts
import { createMapPlugin } from '@xingm/vmap-cesium-toolbar';

const mapPlugin = createMapPlugin('cesiumContainer', {
  services: {
    draw: true,
  },
});

await mapPlugin.initialize();

const drawService = mapPlugin.getDrawService();
```

### 2. 手动创建

适合不走 `MapPlugin` 统一装配、但仍想单独复用绘制服务的场景。

```ts
import { DrawService } from '@xingm/vmap-cesium-toolbar';

const drawService = new DrawService(viewer);
```

## 类定义

```ts
class DrawService
```

## 构造函数

```ts
constructor(viewer: Viewer)
```

说明：

- `DrawService` 自身构造函数不接收额外配置对象
- 地图级装配配置通过 `MapPlugin.services.draw` 控制
- 单次绘制的样式与行为通过 `DrawOptions` 控制

## MapPlugin 装配配置

### DrawPluginOptions

```ts
interface DrawPluginOptions {
  enabled?: boolean;
}
```

字段说明：

- `enabled`: 是否启用 `DrawService`，默认 `true`

说明：

- 当前 `MapPlugin` 对 `draw` 服务的装配配置比较轻，仅提供启用开关
- 线宽、填充、标注样式、提示气泡等都不在 `DrawPluginOptions` 中，而是在每次 `startDrawing(...)` 时通过 `DrawOptions` 传入

## 单次绘制配置

### DrawMode

```ts
type DrawMode = 'point' | 'line' | 'polygon' | 'rectangle' | 'circle' | null
```

当前公开能力说明：

- 已实现并建议直接使用：`line`、`polygon`、`rectangle`、`circle`
- 类型中保留了 `point`，但当前 `DrawService` 的最终实体工厂未产出 point 结果，也没有对应的便捷方法，因此不建议在新文档示例中使用

### DrawOptions

```ts
interface DrawOptions {
  mode?: DrawMode;
  measurementTheme?: MeasurementTheme;
  lineColor?: Cesium.Color | string;
  lineWidth?: number;
  fillColor?: Cesium.Color | string;
  clampToGround?: boolean;
  segmentDistanceLabelStyle?: MeasurementSummaryLabelStyle;
  totalDistanceLabelStyle?: MeasurementSummaryLabelStyle;
  previewAreaLabelStyle?: MeasurementSummaryLabelStyle;
  totalAreaLabelStyle?: MeasurementSummaryLabelStyle;
  hintBubbleStyle?: MeasurementSummaryLabelStyle;
  onClick?: (entity: Entity, positions?: Cartesian3[]) => void;
}
```

字段说明：

- `measurementTheme`: 一次性定义描边、填充、顶点、测距标签、面积标签、提示气泡等完整主题
- `lineColor`: 线颜色快捷配置
- `lineWidth`: 线宽快捷配置
- `fillColor`: 面填充快捷配置
- `clampToGround`: 是否贴地
- `segmentDistanceLabelStyle`: 分段距离标签样式
- `totalDistanceLabelStyle`: 总距离标签样式
- `previewAreaLabelStyle`: 预览面积标签样式
- `totalAreaLabelStyle`: 总面积标签样式
- `hintBubbleStyle`: 鼠标提示气泡样式
- `onClick`: 绘制结果实体的点击回调

说明：

- `measurementTheme` 是更完整的主题入口，单项样式字段可以理解为常用快捷配置
- 最终样式会在内部被解析和归一化
- `mode` 字段存在于类型中，但在 `DrawService.startDrawing(mode, options)` 的调用模式下，通常以第一个参数为准

## 主题配置

### MeasurementTheme

```ts
interface MeasurementTheme {
  stroke?: MeasurementStrokeStyle;
  fill?: MeasurementFillStyle;
  vertex?: MeasurementVertexStyle;
  segmentDistanceLabel?: MeasurementSummaryLabelStyle;
  totalDistanceLabel?: MeasurementSummaryLabelStyle;
  previewAreaLabel?: MeasurementSummaryLabelStyle;
  totalAreaLabel?: MeasurementSummaryLabelStyle;
  hintBubble?: MeasurementSummaryLabelStyle;
}
```

### MeasurementStrokeStyle

```ts
interface MeasurementStrokeStyle {
  color?: Cesium.Color | string;
  width?: number;
  clampToGround?: boolean;
}
```

### MeasurementFillStyle

```ts
interface MeasurementFillStyle {
  color?: Cesium.Color | string;
}
```

### MeasurementVertexStyle

```ts
interface MeasurementVertexStyle {
  pixelSize?: number;
  color?: Cesium.Color | string;
  outlineColor?: Cesium.Color | string;
  outlineWidth?: number;
}
```

### MeasurementSummaryLabelStyle

```ts
interface MeasurementSummaryLabelStyle {
  font?: string;
  textColor?: Cesium.Color | string;
  backgroundColor?: Cesium.Color | string;
  borderRadius?: number;
  pixelOffset?: Cesium.Cartesian2 | { x: number; y: number };
}
```

适用位置：

- `segmentDistanceLabel`: 每一段距离标签
- `totalDistanceLabel`: 总距离标签
- `previewAreaLabel`: 绘制中的面积预览标签
- `totalAreaLabel`: 最终面积标签
- `hintBubble`: 鼠标提示气泡

## 公开方法

### 启动绘制

#### startDrawing

```ts
startDrawing(mode: DrawMode, options?: DrawOptions): void
```

使用指定模式开始绘制。

#### startDrawingLine

```ts
startDrawingLine(options?: DrawOptions): void
```

#### startDrawingPolygon

```ts
startDrawingPolygon(options?: DrawOptions): void
```

#### startDrawingRectangle

```ts
startDrawingRectangle(options?: DrawOptions): void
```

#### startDrawingCircle

```ts
startDrawingCircle(options?: DrawOptions): void
```

说明：

- 如果当前已经处于绘制中，再次调用会先结束旧会话，再启动新会话
- 绘制过程中会创建预览实体、顶点标记和提示气泡
- 当前默认通过双击结束绘制

### 结束与取消

#### endDrawing

```ts
endDrawing(): void
```

结束当前绘制会话并清理临时实体。

#### cancelDrawing

```ts
cancelDrawing(): void
```

取消当前绘制会话并清理临时实体。

说明：

- `endDrawing()` / `cancelDrawing()` 不会自动生成 `DrawResult`
- 真正的完成结果是在交互流程满足最小点数并触发完成逻辑时产生的

### 结果管理

#### getFinishedEntities

```ts
getFinishedEntities(): Entity[]
```

返回当前服务已完成绘制的主实体列表。

#### clearAll

```ts
clearAll(): void
```

清除当前服务创建的所有完成实体及其附属标注实体。

#### removeEntity

```ts
removeEntity(entity: Entity): void
```

删除指定绘制实体，并同步移除它绑定的附属实体。

### 状态查询

#### isDrawingMode

```ts
isDrawingMode(): boolean
```

返回当前是否处于绘制状态。

#### getCurrentDrawMode

```ts
getCurrentDrawMode(): DrawMode
```

返回当前绘制模式。

### 生命周期

#### destroy

```ts
destroy(): void
```

销毁服务，包含：

- 取消当前绘制
- 清空已完成实体
- 销毁交互控制器

## 事件回调

`DrawService` 通过注册方法暴露事件，而不是通过构造参数传入。

### onDrawStart

```ts
onDrawStart(callback: () => void): void
```

开始绘制时触发。

触发时机：

- 调用 `startDrawing(...)` 并完成内部交互控制器激活之后

### onDrawEnd

```ts
onDrawEnd(callback: (result: DrawResult | null) => void): void
```

绘制完成时触发。

触发时机：

- 用户完成交互，内部执行 `finishDrawing()` 时

返回值说明：

- 成功绘制时返回 `DrawResult`
- 点数不足或未成功生成最终实体时返回 `null`

### onEntityRemoved

```ts
onEntityRemoved(callback: (entity: Entity) => void): void
```

通过 `removeEntity(...)` 删除某个已完成实体时触发。

说明：

- `clearAll()` 不会逐个触发 `onEntityRemoved`

## 返回结果说明

### DrawResult

```ts
interface DrawResult {
  entity: Entity;
  positions: Cartesian3[];
}
```

字段说明：

- `entity`: 最终主实体
- `positions`: 用于生成该实体的原始坐标点数组

### 返回结果的语义边界

`DrawResult` 当前只包含“实体 + 坐标”，不直接附带：

- 距离数值
- 面积数值
- 半径数值
- 标签实体列表

如果业务需要这些值，有两种处理方式：

1. 基于 `positions` 自行计算距离、面积等统计值
2. 使用 `ToolbarService` 的测量回调，在工具栏测距/测面流程里拿到上层封装结果

### DrawResult 为 null 的情况

可能出现于：

- 线、矩形、圆的点数不足 2 个
- 多边形点数不足 3 个
- 当前模式没有生成最终实体

## 交互流程说明

默认交互流程：

1. 左键添加控制点
2. 鼠标移动更新预览图形与提示气泡
3. 右键回退一个控制点
4. 双击完成绘制

最小点数要求：

- `line`: 2
- `rectangle`: 2
- `circle`: 2
- `polygon`: 3

## 示例

### 监听完成结果

```ts
const drawService = mapPlugin.getDrawService();

drawService.onDrawStart(() => {
  console.log('开始绘制');
});

drawService.onDrawEnd((result) => {
  if (!result) {
    console.log('绘制未完成或点数不足');
    return;
  }

  console.log('主实体:', result.entity);
  console.log('坐标点:', result.positions);
});

drawService.startDrawingLine({
  lineColor: '#1677ff',
  lineWidth: 3,
  clampToGround: true,
});
```

### 使用 measurementTheme 定制测量样式

```ts
drawService.startDrawingPolygon({
  measurementTheme: {
    stroke: {
      color: 'rgba(22, 92, 201, 0.96)',
      width: 3,
      clampToGround: true,
    },
    fill: {
      color: 'rgba(0, 132, 110, 0.24)',
    },
    vertex: {
      pixelSize: 11,
      color: '#20b7ff',
      outlineColor: '#ffffff',
      outlineWidth: 1,
    },
    totalAreaLabel: {
      backgroundColor: 'rgba(0, 132, 110, 0.96)',
      textColor: '#ffffff',
      borderRadius: 12,
      pixelOffset: { x: 0, y: -10 },
    },
    hintBubble: {
      backgroundColor: 'rgba(72, 78, 92, 0.92)',
      textColor: '#ffffff',
      borderRadius: 10,
      pixelOffset: { x: 96, y: -16 },
    },
  },
});
```

### 删除绘制结果

```ts
drawService.onEntityRemoved((entity) => {
  console.log('实体已移除:', entity);
});

const entities = drawService.getFinishedEntities();
if (entities.length > 0) {
  drawService.removeEntity(entities[0]);
}
```

## 与 compat 层的关系

- `DrawService` 是新架构的绘制服务
- `DrawHelper` 是兼容适配层
- 新项目优先使用 `mapPlugin.getDrawService()`
- 旧项目迁移时，可以先继续使用 `DrawHelper`，再逐步切换到 `DrawService`
