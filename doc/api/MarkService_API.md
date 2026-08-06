---
title: MarkService / CesiumMapMark API
---

# MarkService / CesiumMapMark API

`MarkService` 是新架构标绘服务；`CesiumMapMark` 是面向旧项目的兼容适配器。二者支持点、线、面、矩形、圆、工作区/禁飞区、编辑和坐标系输出。

## 创建实例

```ts
import { MarkService, CesiumMapMark } from '@xingm/vmap-cesium-toolbar';

const mark = new MarkService(viewer, {
  showToolbar: true,
  toolbarPosition: 'top-right',
  buttons: ['point', 'polyline', 'polygon', 'rectangle', 'circle'],
  continuous: false,
  defaultColor: '#1677ff',
  callbacks: {
    onDrawEnd(result) {
      console.log(result?.positions, result?.outputCoordSystem);
    },
    onEditEnd(result) {
      console.log('edited', result);
    },
  },
});

// 兼容写法：方法基本一致
const compatMark = new CesiumMapMark(viewer, { showToolbar: true });
```

## 绘制

```ts
mark.drawPoint({ outputCoordSystem: 'WGS84' });
mark.drawPolyline({ color: '#00c853', clampToGround: true });
mark.drawPolygon({ outputCoordSystem: 'GCJ02' });
mark.drawRectangle();
mark.drawCircle();

// 通用入口
mark.startDrawing('polygon', {
  color: '#ff4d4f',
  coordSystem: 'WGS84',
  outputCoordSystem: 'BD09',
  onComplete: result => console.log(result),
});
```

| 方法 | 说明 |
| --- | --- |
| `startDrawing(type, options?)` | 通用绘制入口 |
| `drawPoint/options` | 绘制点 |
| `drawPolyline(options?)` | 绘制折线 |
| `drawPolygon(options?)` | 绘制多边形 |
| `drawRectangle(options?)` | 绘制矩形 |
| `drawCircle(options?)` | 绘制圆 |
| `stopDraw()` | 结束当前绘制流程 |
| `cancelDrawing()` | 取消当前绘制 |

## 工作区和禁飞区

```ts
mark.startWorkAreaDraw('polygon', 'work', {
  color: '#1677ff',
  outputCoordSystem: 'WGS84',
});

mark.startWorkAreaDraw('circle', 'noFly', {
  color: '#ff4d4f',
});
```

`type` 支持 `polygon | circle | rectangle`，`kind` 支持 `work | noFly`。

## 编辑与删除

```ts
mark.enableEdit({ outputCoordSystem: 'WGS84' });
mark.startEdit(entityOrId, { outputCoordSystem: 'WGS84' });
const result = mark.stopEdit();
mark.disableEdit();

mark.deleteEntity(entityOrId);
mark.clearAll();
```

编辑模式会显示控制点。点、线、面、矩形和圆均可编辑；圆的中心与半径控制点分别可拖动。
点位编辑默认使用绿色 move 句柄。

## 样式、查询与导出

```ts
mark.setColor('polygon', '#ff4d4f');
console.log(mark.getColor('polygon'));

const entities = mark.getEntities();
const data = mark.exportData('GCJ02');

mark.destroy();
```

`exportData()` 默认输出 WGS84。`CesiumMapMark` 兼容适配器的 `exportData()` 当前无参数，固定使用默认 WGS84；需要指定输出坐标系时请使用 `MarkService`。

## 返回结果

`MarkDrawResult` 包含 `id`、`type`、`entity`、`positions`、`cartesian3Positions`、`outputCoordSystem`，并按图形类型补充 `position`、`length`、`area`、`radius`、`color`、`kind`。

`MarkExportItem` 不包含 Cesium Entity，但保留可序列化经纬度数据，适合保存到业务后端。

## 回调

支持 `onDrawStart`、`onDrawEnd`、`onWorkAreaDrawEnd`、`onEditChange`、`onEditEnd`、`onColorChange`、`onDelete`、`onClear`。
