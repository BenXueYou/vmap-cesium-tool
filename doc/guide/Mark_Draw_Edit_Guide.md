---
title: 标绘、绘制与编辑
---

# 标绘、绘制与编辑

这份说明对应 1.x 当前的标绘与绘制实现，重点覆盖：

- `CesiumMapMark`
- `DrawHelper`
- 基础编辑
- `rectangle` 真实语义
- `startWorkAreaDraw`

## 默认约定

业务层默认只传地图厂商和业务经纬度，坐标默认按 `WGS84` 处理。

- 绘制、取点、覆盖物添加默认都按 `WGS84`
- 只有 API 显式传入 `coordSystem` / `outputCoordSystem` 时才切换
- `gaode` / `tencent` 继续使用 `GCJ02`
- `baidu` 使用 `BD09`

## CesiumMapMark 能力面

```ts
import { CesiumMapMark } from '@xingm/vmap-cesium-toolbar';

const mark = new CesiumMapMark(viewer, {
  showToolbar: true,
  buttons: ['point', 'polyline', 'polygon', 'rectangle', 'circle'],
  continuous: false,
  defaultColor: '#00A3FF',
  colors: {
    rectangle: '#FF8A00',
  },
  callbacks: {
    onDrawStart: (type) => console.log('start', type),
    onDrawEnd: (result) => console.log('draw', result),
    onWorkAreaDrawEnd: (result) => console.log('work-area', result),
    onEditChange: (result) => console.log('editing', result),
    onEditEnd: (result) => console.log('edit end', result),
    onColorChange: (color, type) => console.log('color', type, color),
  },
});
```

### 绘制模式

- `drawPoint`
- `drawPolyline`
- `drawPolygon`
- `drawRectangle`
- `drawCircle`

### 工作区绘制

```ts
mark.startWorkAreaDraw('rectangle', 'noFly', {
  outputCoordSystem: 'WGS84',
});
```

工作区结果会保留 `kind` 语义，便于区分 `work` / `noFly`。

## 结果结构

### Draw 结果

`DrawResult` 直接携带：

- `type`
- `positions`
- `geographicPositions`
- `distance`
- `area`
- `radius`

### Mark 结果

`MarkDrawResult` / `MarkExportItem` 直接携带：

- `position`
- `positions`
- `cartesian3Positions`
- `length`
- `area`
- `radius`
- `color`

### rectangle 语义

`rectangle` 不再用 polygon 冒充，结果与编辑都按真实矩形处理：

- 预览使用 `rectangle` 实体
- 最终实体使用 `rectangle` 实体
- 导出位置为四角点
- 编辑时保持矩形语义，不退化为多边形

## 基础编辑

当前支持的基础编辑类型：

- `point`
- `polyline`
- `polygon`
- `rectangle`
- `circle`

编辑入口：

```ts
mark.enableEdit();
mark.startEdit(entityId, {
  outputCoordSystem: 'WGS84',
});
```

退出编辑：

```ts
mark.stopEdit();
mark.disableEdit();
```

编辑过程会触发：

- `onEditChange`
- `onEditEnd`

## 迁移约束

开发时请保持以下链路不变：

- 多厂商底图加载
- `baseMap / mapAuth / provider` 切换
- `WGS84 / GCJ02 / BD09` 转换
- 搜索定位
- 相机 `flyTo`
- 覆盖物导出

不要在 adapter 层伪造结果，也不要把坐标统一降级成 `WGS84` 直接透传。
