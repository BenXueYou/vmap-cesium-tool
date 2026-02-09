# CesiumMapHelper / DrawHelper API 文档

## 概述

当前版本对外导出的绘制类名称为 `DrawHelper`（默认导出自 `src/libs/CesiumMapDraw.ts`）。

它提供：

- 交互式绘制：线 / 多边形 / 矩形 / 圆
- 清理与删除：按实体删除、清空所有绘制
- 回调：开始/结束绘制、测量结果、实体移除
- 2D/3D 切换适配：场景模式切换后可触发重算

## 类定义

```ts
class DrawHelper
```

## 构造函数

```ts
constructor(viewer: Cesium.Viewer)
```

## 交互规则（绘制期间）

- 左键：落点
- 鼠标移动：更新预览
- 右键：撤销最后一个点
- 双击：结束绘制并生成最终实体

## 主要方法

### 1) 开始绘制

```ts
startDrawingLine(options?: DrawOptions): void
startDrawingPolygon(options?: DrawOptions): void
startDrawingRectangle(options?: DrawOptions): void
startDrawingCircle(options?: DrawOptions): void
```

其中 `options` 用于控制样式、选中态、面积/长度标签显示，以及多边形自相交校验等。

### 2) 结束/取消绘制

```ts
endDrawing(): void
cancelDrawing(): void
```

- `endDrawing()`：若正在绘制，等价于“结束绘制”（会尝试产出最终实体）；若未在绘制则做一次清理收尾。
- `cancelDrawing()`：取消当前未完成绘制，不生成实体（适合外部在开启新绘制前主动中止旧绘制）。

### 3) 清理

```ts
clearAll(): void
clearAllEntities(): void
clearAllPoints(): void
```

- `clearAll()`：清空 DrawHelper 追踪的“已完成实体/标签/点”等
- `clearAllEntities()`：更彻底，直接 `viewer.entities.removeAll()`
- `clearAllPoints()`：只清点实体（用于处理点实体偶发残留）

### 4) 删除与查询

```ts
removeEntity(entity: Cesium.Entity): void
getFinishedEntities(): Cesium.Entity[]
getEntityLabelEntities(entity: Cesium.Entity): Cesium.Entity[]
```

`getEntityLabelEntities` 可获取与某个绘制实体绑定的标签实体（例如面积 label）。

### 5) 回调注册

```ts
onDrawStart(callback: () => void): void
onDrawEnd(callback: (entity: Cesium.Entity | null) => void): void
onEntityRemoved(callback: (entity: Cesium.Entity) => void): void
onMeasureComplete(callback: (result: {
  type: 'line' | 'polygon' | 'rectangle' | 'circle';
  positions: Cesium.Cartesian3[];
  distance?: number;
  areaKm2?: number;
}) => void): void
```

### 6) 场景模式切换适配

```ts
handleSceneModeChanged(): void
```

当你不使用 `CesiumMapToolbar`，而是自己在外部切换 2D/3D（`viewer.scene.mode`）时，建议在切换完成后调用它，用于更新已完成实体/标签在不同模式下的高度与贴地策略。

### 7) 销毁

```ts
destroy(): void
```

销毁内部事件处理器（默认不会自动清空实体；是否清空由业务控制）。

## DrawOptions

```ts
interface DrawOptions {
  strokeColor?: Cesium.Color | string;
  strokeWidth?: number;
  fillColor?: Cesium.Color | string;
  outlineColor?: Cesium.Color | string;
  outlineWidth?: number;
  heightEpsilon?: number;
  selected?: {
    color?: Cesium.Color | string;
    width?: number;
    outlineColor?: Cesium.Color | string;
    outlineWidth?: number;
  };

  // polygon/rectangle/circle：是否显示面积标签（默认 true）
  showAreaLabel?: boolean;

  // line：是否显示长度标签（默认 true）。包含“分段长度”与“总长度”标签。
  // 说明：显式传入 false 才会关闭。
  showDistanceLabel?: boolean;

  // 多边形自相交校验
  selfIntersectionEnabled?: boolean;
  selfIntersectionAllowTouch?: boolean;
  selfIntersectionAllowContinue?: boolean;

  // 点击已完成实体回调
  onClick?: (entity: Cesium.Entity, type?: 'line' | 'polygon' | 'rectangle' | 'circle', positions?: Cesium.Cartesian3[]) => void;
}
```

## 使用示例

```ts
import DrawHelper from '@xingm/vmap-cesium-toolbar';

const drawHelper = new DrawHelper(viewer);

drawHelper.onDrawEnd((entity) => {
  if (!entity) return;
  console.log('draw end', entity.id);
});

drawHelper.startDrawingPolygon({
  strokeWidth: 2,
  showAreaLabel: true,
  selfIntersectionEnabled: true,
  selfIntersectionAllowTouch: true,
});

// 画线时关闭长度标签
drawHelper.startDrawingLine({
  strokeWidth: 3,
  showDistanceLabel: false,
});
```

## 注意事项

- 绘制过程中会短暂“屏蔽 pick”（通过在 viewer 上挂载内部标记），用于减少与覆盖物点击/hover 的交互冲突。
- 多边形自相交校验只有在 `selfIntersectionEnabled=true` 时开启。
- 如需释放内部事件监听器，请在组件卸载时调用 `destroy()`。
