# CesiumMapHelper API 文档

## 概述

`CesiumMapHelper` 是一个功能完整的Cesium绘图辅助工具类，提供绘制点、线、多边形、矩形、视锥体等功能，支持编辑和删除操作。

## 类定义

```typescript
class DrawHelper
```

## 构造函数

```typescript
constructor(viewer: Cesium.Viewer)
```

### 参数
- `viewer` (Cesium.Viewer): Cesium Viewer 实例

### 示例
```typescript
import DrawHelper from './libs/CesiumMapHelper';

const drawHelper = new DrawHelper(viewer);
```

## 主要方法

### 1. 绘制线条
```typescript
startDrawingLine(): void
```
开始绘制线条模式。支持多点折线绘制，实时显示每段距离和总距离。

**功能特点：**
- 支持多点折线绘制
- 实时显示每段距离（青色标签）
- 显示总距离（白色标签）
- 双击结束绘制
- 右键删除最后一个点

**使用示例：**
```typescript
drawHelper.startDrawingLine();
```

### 2. 绘制多边形
```typescript
startDrawingPolygon(): void
```
开始绘制多边形模式。绘制带淡绿色填充的多边形区域。

**功能特点：**
- 淡绿色填充区域（30%透明度）
- 绿色边框
- 自动计算并显示面积
- 双击结束绘制
- 右键删除最后一个点

**使用示例：**
```typescript
drawHelper.startDrawingPolygon();
```

### 3. 绘制矩形
```typescript
startDrawingRectangle(): void
```
开始绘制矩形模式。

**功能特点：**
- 两点确定矩形
- 绿色半透明填充
- 自动计算并显示面积

**使用示例：**
```typescript
drawHelper.startDrawingRectangle();
```

### 4. 绘制视锥体
```typescript
drawFrustum(options?: FrustumOptions): void
```

#### FrustumOptions 接口
```typescript
interface FrustumOptions {
  position?: Cartesian3;           // 视锥体位置（默认相机位置）
  orientation?: Quaternion;        // 视锥体方向（默认相机方向）
  fov?: number;                   // 视野角度 (1-179度，默认60)
  aspectRatio?: number;           // 宽高比（默认1.0）
  near?: number;                  // 近平面距离（默认1.0）
  far?: number;                   // 远平面距离（默认1000.0）
  fillColor?: Color;              // 填充颜色（默认红色半透明）
  outlineColor?: Color;           // 轮廓颜色（默认白色）
  onRightClick?: (position: Cartesian3) => void; // 右键点击回调
}
```

**功能特点：**
- 半透明填充的视锥体
- 白色轮廓线
- 支持右键交互
- 参数验证和错误处理

**使用示例：**
```typescript
drawHelper.drawFrustum({
  fov: 60,
  aspectRatio: 1.5,
  near: 10,
  far: 2000,
  fillColor: Cesium.Color.GREEN.withAlpha(0.3),
  outlineColor: Cesium.Color.WHITE,
  onRightClick: (pos) => {
    console.log('视锥体被右键点击:', pos);
  }
});
```

### 5. 结束绘制
```typescript
endDrawing(): void
```
结束当前绘制操作。

### 6. 清除所有
```typescript
clearAll(): void
```
清除所有已绘制的实体。

### 7. 清除视锥体
```typescript
clearFrustum(): void
```
清除所有视锥体相关图形。

### 8. 删除指定实体
```typescript
removeEntity(entity: Cesium.Entity): void
```

#### 参数
- `entity` (Cesium.Entity): 要删除的实体

### 9. 获取已完成实体
```typescript
getFinishedEntities(): Cesium.Entity[]
```
返回所有已完成的绘制实体数组。

## 事件回调

### 设置开始绘制回调
```typescript
onDrawStart(callback: () => void): void
```

### 设置结束绘制回调
```typescript
onDrawEnd(callback: (entity: Cesium.Entity | null) => void): void
```

### 设置实体移除回调
```typescript
onEntityRemoved(callback: (entity: Cesium.Entity) => void): void
```

### 使用示例
```typescript
drawHelper.onDrawStart(() => {
  console.log('开始绘制');
});

drawHelper.onDrawEnd((entity) => {
  if (entity) {
    console.log('绘制完成:', entity);
  } else {
    console.log('绘制被取消');
  }
});

drawHelper.onEntityRemoved((entity) => {
  console.log('实体被移除:', entity);
});
```

## 销毁资源
```typescript
destroy(): void
```
销毁工具实例，清理所有事件监听器和资源。

## 绘制操作说明

### 线条绘制
1. 调用 `startDrawingLine()` 开始绘制
2. 左键点击添加点
3. 右键删除最后一个点
4. 双击结束绘制
5. 每段显示距离标签，最后显示总距离

### 多边形绘制
1. 调用 `startDrawingPolygon()` 开始绘制
2. 左键点击添加点
3. 右键删除最后一个点
4. 双击结束绘制
5. 显示淡绿色填充区域和面积标签

### 矩形绘制
1. 调用 `startDrawingRectangle()` 开始绘制
2. 左键点击确定第一个角点
3. 左键点击确定对角点
4. 自动完成矩形绘制
5. 显示绿色填充区域和面积标签

### 视锥体绘制
1. 调用 `drawFrustum(options)` 绘制视锥体
2. 支持自定义位置、方向、大小等参数
3. 右键点击可触发回调函数
4. 调用 `clearFrustum()` 清除视锥体

## 注意事项

1. **地形贴合**：所有绘制内容都会贴合地形显示
2. **事件冲突**：绘制过程中会临时禁用Cesium的默认交互
3. **内存管理**：记得在组件销毁时调用 `destroy()` 方法
4. **精度计算**：面积计算使用球面几何，适合大范围测量
5. **视觉反馈**：绘制过程中提供实时视觉反馈

## 完整使用示例

```typescript
import DrawHelper from './libs/CesiumMapHelper';

// 创建绘图助手
const drawHelper = new DrawHelper(viewer);

// 设置回调
drawHelper.onDrawStart(() => {
  console.log('开始绘制');
});

drawHelper.onDrawEnd((entity) => {
  if (entity) {
    console.log('绘制完成:', entity);
    // 根据实体类型处理结果
    if (entity.polyline) {
      console.log('绘制了线条');
    } else if (entity.polygon) {
      console.log('绘制了多边形');
    } else if (entity.rectangle) {
      console.log('绘制了矩形');
    }
  }
});

drawHelper.onEntityRemoved((entity) => {
  console.log('实体被移除:', entity);
});

// 开始绘制线条
drawHelper.startDrawingLine();

// 开始绘制多边形
drawHelper.startDrawingPolygon();

// 绘制视锥体
drawHelper.drawFrustum({
  fov: 45,
  aspectRatio: 1.5,
  near: 10,
  far: 2000,
  fillColor: Cesium.Color.BLUE.withAlpha(0.3),
  onRightClick: (pos) => {
    console.log('视锥体被点击:', pos);
  }
});

// 清除所有绘制内容
drawHelper.clearAll();

// 销毁资源
drawHelper.destroy();
```
