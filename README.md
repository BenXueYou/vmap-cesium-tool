# CesiumMapTools - Cesium 地图工具插件

一个功能强大的 Cesium 地图工具插件，提供完整的地图操作、测量、绘制和覆盖物管理功能。

## 功能特性

### 🗺️ 基础地图功能

- ✅ 地图容器大小配置
- ✅ 缩放控制（放大、缩小、指定级别）
- ✅ 2D/3D 模式切换
- ✅ 自定义初始视角

### 📍 点位功能

- ✅ 添加可配置样式的点位
- ✅ 点位点击事件监听
- ✅ 自动坐标标签显示

### 📏 测量功能

- ✅ 距离测量（测距）
- ✅ 面积测量（测面）
- ✅ 测量结果实时显示
- ✅ 测量图形点击事件

### 🎯 绘制功能

- ✅ 视锥体绘制
- ✅ 可配置视锥体参数
- ✅ 视锥体右键点击事件
- ✅ 垂直线绘制

### 🏗️ 覆盖物功能

- ✅ 多种类型覆盖物（点、标签、图标、模型、圆柱体）
- ✅ 完全可配置的样式
- ✅ 灵活的覆盖物管理

## 安装和使用

### 基本使用

```typescript
import { CesiumMapTools } from './libs/CesiumMapTools';

// 创建地图工具实例
const mapTools = new CesiumMapTools({
  containerId: 'cesiumContainer',
  mapCenter: {
    longitude: 120.15507,
    latitude: 30.274085,
    height: 5000,
    pitch: -30
  }
});

// 初始化地图
await mapTools.initialize();
```

### 配置选项

```typescript
interface MapToolsConfig {
  containerId: string;           // 地图容器ID
  viewerOptions?: ViewerOptions; // Cesium Viewer 配置
  mapCenter?: {                 // 初始地图中心
    longitude: number;
    latitude: number;
    height: number;
    pitch?: number;
    heading?: number;
  };
  zoomLevels?: number[];        // 缩放级别数组
  defaultZoom?: number;         // 默认缩放级别
}
```

## API 参考

### 基础功能

#### `setContainerSize(width: string, height: string)`

设置地图容器大小。

#### `zoomIn()` / `zoomOut()`

放大/缩小地图。

#### `setZoom(level: number)`

设置指定缩放级别。

#### `toggle2D3D()`

切换 2D/3D 模式。

### 点位功能

#### `addPoint(position: Cartesian3, options?: PointOptions)`

添加一个点位。

**PointOptions:**
```typescript
{
  pixelSize?: number;    // 点大小
  color?: Color;         // 点颜色
  outlineColor?: Color;  // 轮廓颜色
  outlineWidth?: number; // 轮廓宽度
  showLabel?: boolean;   // 是否显示标签
  labelText?: string;    // 标签文本
  onClick?: Function;    // 点击事件回调
}
```

### 测量功能

#### `startDistanceMeasurement(options?: LineOptions)`

开始距离测量。

#### `startAreaMeasurement(options?: PolygonOptions)`

开始面积测量。

### 绘制功能

#### `drawFrustum(options?: FrustumOptions)`

绘制视锥体。

#### `drawVerticalLine(options: VerticalLineOptions)`

绘制垂直线。

### 覆盖物功能

#### `addOverlay(options: OverlayOptions)`

添加覆盖物。

**覆盖物类型:**
- `point`: 点
- `label`: 文本标签
- `billboard`: 图标
- `model`: 3D 模型
- `cylinder`: 圆柱体

### 清理功能

#### `clearDrawing()`

清除绘制内容。

#### `clearFrustum()`

清除视锥体。

#### `clearAll()`

清除所有内容。

#### `destroy()`

销毁地图实例。

## 示例代码

### 完整使用示例

```typescript
// 创建地图工具
const mapTools = new CesiumMapTools({
  containerId: 'map-container',
  mapCenter: {
    longitude: 120.16,
    latitude: 30.27,
    height: 5000
  }
});

// 初始化
await mapTools.initialize();

// 添加点位
const position = Cesium.Cartesian3.fromDegrees(120.16, 30.28, 100);
mapTools.addPoint(position, {
  pixelSize: 12,
  color: Cesium.Color.BLUE,
  onClick: (pos, carto) => {
    console.log('点位坐标:', carto);
  }
});

// 开始测距
mapTools.startDistanceMeasurement({
  width: 4,
  material: Cesium.Color.GREEN,
  onClick: (positions, distance) => {
    console.log('距离:', distance);
  }
});

// 绘制视锥体
mapTools.drawFrustum({
  fov: 45,
  fillColor: new Cesium.Color(0, 1, 0, 0.2)
});
```

## 事件处理

插件支持多种事件监听：

1. **点位点击事件** - 点击点位时触发
2. **测量完成事件** - 测量操作完成时触发
3. **视锥体右键事件** - 右键点击视锥体时触发

## 注意事项

1. 确保已正确设置 Cesium Ion Token
2. 地图容器需要在 DOM 中存在
3. 使用完成后调用 `destroy()` 方法清理资源
4. 支持 TypeScript 类型提示

## 版本信息

- **版本**: 1.0.0
- **依赖**: Cesium ^1.110.0
- **兼容性**: Vue 3+, TypeScript 4.5+

## 开发计划

- [ ] 添加轨迹绘制功能
- [ ] 支持更多测量模式
- [ ] 添加图层管理功能
- [ ] 支持自定义样式主题
- [ ] 添加动画效果支持

## 技术支持

如有问题请提交 Issue 或联系开发团队。
