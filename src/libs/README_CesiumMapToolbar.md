# CesiumMapToolbar 使用说明

## 概述

`CesiumMapToolbar` 是一个功能完整的 Cesium 地图工具栏组件，提供了搜索、测量、2D/3D切换、图层切换、定位、缩放、全屏等功能。

## 功能特性

### 🔍 搜索功能

- 鼠标悬停显示搜索框
- 支持地理位置搜索
- 可配置搜索回调函数
- 点击搜索结果自动定位

### 📏 测量功能

- 测距：支持多点折线测量
- 测面积：支持多边形面积测量
- 清除：一键清除所有测量内容
- 实时显示测量结果

### 🎯 2D/3D 切换

- 一键切换2D和3D视角
- 按钮状态自动更新

### 📚 图层切换

- 支持多种地图类型
- 天地图：普通、三维、影像、地形
- 可扩展自定义地图类型

### 🎯 定位功能

- 复位到地图初始中心点
- 平滑飞行动画

### 🔍 缩放控制

- 放大/缩小按钮
- 支持缩放回调函数
- 显示缩放前后层级

### ⛶ 全屏功能

- 进入/退出全屏模式
- 自动检测全屏状态

## 使用方法

### 基本用法

```typescript
import { CesiumMapToolbar, type SearchResult } from './libs/CesiumMapToolbar';

// 初始化工具栏
const mapToolbar = new CesiumMapToolbar(
  viewer,           // Cesium Viewer 实例
  container,        // 地图容器元素
  {
    position: 'bottom-right',  // 工具栏位置
    buttonSize: 40,            // 按钮大小
    buttonSpacing: 8,          // 按钮间距
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: '#e0e0e0',
    borderRadius: 6,
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    zIndex: 1000
  },
  {
    // 搜索回调
    search: {
      onSearch: async (query: string): Promise<SearchResult[]> => {
        // 实现搜索逻辑
        return await yourSearchAPI(query);
      },
      onSelect: (result: SearchResult) => {
        console.log('选择了搜索结果:', result);
      }
    },
    // 测量回调
    measurement: {
      onDistanceComplete: (positions, distance) => {
        console.log('测距完成:', distance);
      },
      onAreaComplete: (positions, area) => {
        console.log('测面积完成:', area);
      },
      onClear: () => {
        console.log('清除测量');
      }
    },
    // 缩放回调
    zoom: {
      onZoomIn: (beforeLevel, afterLevel) => {
        console.log('放大:', beforeLevel, '->', afterLevel);
      },
      onZoomOut: (beforeLevel, afterLevel) => {
        console.log('缩小:', beforeLevel, '->', afterLevel);
      }
    }
  }
);
```

### 配置选项

#### ToolbarConfig

```typescript
interface ToolbarConfig {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  buttonSize?: number;           // 按钮大小，默认40px
  buttonSpacing?: number;        // 按钮间距，默认8px
  backgroundColor?: string;      // 背景色
  borderColor?: string;          // 边框色
  borderRadius?: number;         // 圆角半径
  boxShadow?: string;           // 阴影
  zIndex?: number;              // 层级
}
```

#### SearchResult

```typescript
interface SearchResult {
  name: string;        // 地点名称
  address: string;     // 详细地址
  longitude: number;   // 经度
  latitude: number;    // 纬度
  height?: number;     // 高度
}
```

### 自定义地图类型

```typescript
// 在 CesiumMapToolbar 类中添加自定义地图类型
const customMapType = {
  id: 'custom',
  name: '自定义地图',
  thumbnail: 'data:image/svg+xml;base64,...',
  provider: new Cesium.UrlTemplateImageryProvider({
    url: 'https://your-tile-server/{z}/{x}/{y}.png',
    minimumLevel: 1,
    maximumLevel: 18
  })
};

// 添加到 mapTypes 数组
this.mapTypes.push(customMapType);
```

## 事件回调

### 搜索事件

- `onSearch(query: string)`: 搜索请求回调
- `onSelect(result: SearchResult)`: 选择搜索结果回调

### 测量事件

- `onDistanceComplete(positions: Cartesian3[], distance: number)`: 测距完成
- `onAreaComplete(positions: Cartesian3[], area: number)`: 测面积完成
- `onClear()`: 清除测量

### 缩放事件

- `onZoomIn(beforeLevel: number, afterLevel: number)`: 放大操作
- `onZoomOut(beforeLevel: number, afterLevel: number)`: 缩小操作

## 样式定制

工具栏使用内联样式，可以通过以下方式定制：

1. **修改配置参数**：通过 `ToolbarConfig` 调整基本样式
2. **CSS 覆盖**：使用 CSS 选择器覆盖样式
3. **修改源码**：直接修改 `CesiumMapToolbar.ts` 中的样式

```css
/* 自定义工具栏样式 */
.cesium-map-toolbar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  border: 2px solid #fff !important;
}

.cesium-toolbar-button {
  background: rgba(255, 255, 255, 0.2) !important;
  color: #fff !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
}

.cesium-toolbar-button:hover {
  background: rgba(255, 255, 255, 0.3) !important;
  transform: scale(1.1) !important;
}
```

## 依赖要求

- Cesium 1.132.0+
- CesiumMapHelper (用于测量功能)
- 现代浏览器支持

## 注意事项

1. **搜索功能**：需要实现 `onSearch` 回调函数，可以集成真实的地理编码API
2. **地图类型**：天地图需要有效的 token，请替换示例中的 `your_token`
3. **全屏功能**：需要用户手势触发，某些浏览器可能有限制
4. **测量精度**：面积计算使用球面几何，适合大范围测量
5. **内存管理**：记得在组件销毁时调用 `destroy()` 方法

## 示例项目

查看 `src/demo/App1.vue` 获取完整的使用示例。

## 更新日志

### v1.0.0

- 初始版本发布
- 支持搜索、测量、2D/3D切换、图层切换、定位、缩放、全屏功能
- 完整的回调系统
- 可配置的样式选项
