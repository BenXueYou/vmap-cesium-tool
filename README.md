# @xingm/vmap-cesium-toolbar

一个功能强大的 Cesium 地图工具栏组件，提供搜索、测量、绘制、2D/3D切换、图层管理等功能。

## 特性

- 🗺️ **完整的地图工具栏** - 搜索、测量、绘制、图层切换等功能
- 📏 **精确测量工具** - 支持距离、面积、高度测量
- ✏️ **绘制功能** - 支持点、线、面绘制和编辑
- 🔄 **2D/3D切换** - 无缝切换2D和3D视图模式
- 🎨 **可定制样式** - 支持自定义按钮样式和布局
- 📱 **响应式设计** - 适配不同屏幕尺寸
- 🚀 **TypeScript支持** - 完整的类型定义
- ⚡ **Vue 3兼容** - 原生支持Vue 3项目

## 安装

```bash
npm install @xingm/vmap-cesium-toolbar cesium
```

## 快速开始

### 基本使用

```javascript
import { CesiumMapToolbar, initCesium } from '@xingm/vmap-cesium-toolbar';
import '@xingm/vmap-cesium-toolbar/style';

// 初始化Cesium
(async () => {
  const { viewer } = await initCesium('cesiumContainer', {
    terrainProvider: Cesium.createWorldTerrain(),
  });

  // 创建工具栏
  const toolbar = new CesiumMapToolbar(viewer, document.getElementById('toolbar'));
})();
```

### Vue 3 项目中使用

```vue
<template>
  <div id="cesiumContainer"></div>
  <div id="toolbar"></div>
</template>

<script setup>
import { onMounted } from 'vue';
import { CesiumMapToolbar, initCesium } from '@xingm/vmap-cesium-toolbar';
import '@xingm/vmap-cesium-toolbar/style';

let viewer;
let toolbar;

onMounted(async () => {
  // 初始化Cesium
  const result = await initCesium('cesiumContainer', {
    terrainProvider: Cesium.createWorldTerrain(),
  });
  viewer = result.viewer;

  // 创建工具栏
  toolbar = new CesiumMapToolbar(viewer, document.getElementById('toolbar'));
});
</script>
```

## 主要组件

### CesiumMapToolbar

主要工具栏组件，提供完整的地图操作功能。

```typescript
const toolbar = new CesiumMapToolbar(
  viewer,                    // Cesium Viewer实例
  container,                 // 工具栏容器元素
  config,                    // 配置选项（可选）
  callbacks,                 // 回调函数（可选）
  initialCenter              // 初始中心点（可选）
);
```

### DrawHelper

绘制工具类（包的默认导出），提供线/面/矩形/圆等交互绘制能力。

```typescript
import DrawHelper from '@xingm/vmap-cesium-toolbar';

const drawHelper = new DrawHelper(viewer);
drawHelper.startDrawingPolygon();
```

### initCesium

Cesium 初始化函数，简化 Viewer 创建、底图/地形与初始视角配置。

```typescript
import { initCesium } from '@xingm/vmap-cesium-toolbar';

const { viewer } = await initCesium('cesiumContainer', {
  cesiumToken: 'your_cesium_ion_token',
});
```

## 配置选项

### 工具栏配置

```typescript
interface ToolbarConfig {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  buttonSize?: number;           // 按钮大小 (默认40px)
  buttonSpacing?: number;        // 按钮间距 (默认8px)
  backgroundColor?: string;      // 背景色
  borderColor?: string;          // 边框色
  borderRadius?: number;         // 圆角半径
  showSearch?: boolean;          // 显示搜索框
  showMeasurement?: boolean;     // 显示测量工具
  showDrawing?: boolean;         // 显示绘制工具
  showLayerControl?: boolean;    // 显示图层控制
  show2D3DToggle?: boolean;      // 显示2D/3D切换
}
```

### 回调函数

```typescript
interface ToolbarCallbacks {
  search?: (query: string) => void;
  measurement?: (type: string, result: any) => void;
  drawing?: (type: string, entity: Entity) => void;
  zoom?: (level: number) => void;
}
```

## 功能说明

### 搜索功能

支持地名搜索和坐标定位：

```javascript
// 搜索回调
const callbacks = {
  search: (query) => {
    console.log('搜索:', query);
    // 实现搜索逻辑
  }
};
```

### 测量工具

支持多种测量类型：

- **距离测量** - 测量两点间距离
- **面积测量** - 测量多边形面积
- **高度测量** - 测量点的高度信息

```javascript
// 测量回调
const callbacks = {
  measurement: (type, result) => {
    console.log('测量结果:', type, result);
  }
};
```

### 绘制功能

支持多种绘制类型：

- **点绘制** - 在地图上标记点
- **线绘制** - 绘制线条
- **面绘制** - 绘制多边形区域

```javascript
// 绘制回调
const callbacks = {
  drawing: (type, entity) => {
    console.log('绘制完成:', type, entity);
  }
};
```

## 样式定制

组件提供了完整的CSS变量支持，可以轻松定制样式：

```css
:root {
  --toolbar-bg-color: #ffffff;
  --toolbar-border-color: #e0e0e0;
  --toolbar-button-size: 40px;
  --toolbar-button-spacing: 8px;
  --toolbar-border-radius: 4px;
}
```

## 示例项目

### 基本使用示例

```bash
# 克隆项目
git clone https://github.com/your-username/vmap-cesium-toolbar.git
cd vmap-cesium-toolbar

# 查看基本示例
cd examples/basic-usage
# 在浏览器中打开 index.html
```

### Vue 3 示例

```bash
cd examples/vue3-usage
npm install
npm run dev
```

## API 文档

详细的API文档请参考：

- [CesiumMapToolbar API](./doc/CesiumMapToolbar_API.md)
- [CesiumMapHelper API](./doc/CesiumMapHelper_API.md)
- [CesiumMapLoader API](./doc/CesiumMapLoader_API.md)
- [CesiumOverlayService API](./doc/CesiumOverlayService_API.md)

## 依赖要求

- **Cesium**: ^1.100.0
- **Vue**: ^3.0.0 (可选，用于Vue项目)

## 浏览器支持

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v0.0.1-beta.2

- 新增高度测量功能
- 优化标签显示逻辑
- 修复3D模式下标签位置问题
- 改进绘制工具的用户体验

### v0.0.1-beta.1

- 初始版本发布
- 基础工具栏功能
- 搜索、测量、绘制功能
- Vue 3 支持
