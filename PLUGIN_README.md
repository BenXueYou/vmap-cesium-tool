# VMap Cesium Toolbar Plugin

一个功能强大的 Cesium 地图工具栏插件，提供搜索、测量、绘制、图层切换等功能。

## 安装

```bash
npm install vmap-cesium-toolbar
# 或
yarn add vmap-cesium-toolbar
# 或
pnpm add vmap-cesium-toolbar
```

## 依赖要求

- Vue 3.0+
- Cesium 1.100.0+

## 快速开始

### 1. 基本使用

```typescript
import { createApp } from 'vue';
import { CesiumMapToolbar, initCesium } from 'vmap-cesium-toolbar';
import 'vmap-cesium-toolbar/style';

// 设置 Cesium Token
Cesium.Ion.defaultAccessToken = 'your-cesium-token';

const app = createApp({
  async mounted() {
    // 初始化 Cesium 地图
    const { viewer, initialCenter } = await initCesium('cesiumContainer', {
      terrain: Cesium.Terrain.fromWorldTerrain(),
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      scene3DOnly: false,
    });

    // 创建工具栏
    const container = document.getElementById('cesiumContainer');
    const toolbar = new CesiumMapToolbar(
      viewer,
      container,
      {
        position: 'bottom-right',
        buttonSize: 40,
        buttonSpacing: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e0e0e0',
        borderRadius: 6,
        zIndex: 1000,
      },
      {
        search: {
          onSearch: async (query: string) => {
            // 实现搜索逻辑
            return await searchAPI(query);
          },
          onSelect: (result) => {
            console.log('定位到:', result.name);
          }
        },
        measurement: {
          onDistanceComplete: (positions, distance) => {
            console.log(`测距完成，总距离: ${distance.toFixed(2)} 米`);
          },
          onAreaComplete: (positions, area) => {
            console.log(`测面积完成，面积: ${area.toFixed(2)} 平方公里`);
          },
          onClear: () => {
            console.log('清除测量');
          }
        },
        zoom: {
          onZoomIn: (beforeLevel, afterLevel) => {
            console.log(`放大: ${beforeLevel.toFixed(0)} -> ${afterLevel.toFixed(0)}`);
          },
          onZoomOut: (beforeLevel, afterLevel) => {
            console.log(`缩小: ${beforeLevel.toFixed(0)} -> ${afterLevel.toFixed(0)}`);
          }
        }
      },
      initialCenter
    );
  }
});

app.mount('#app');
```

### 2. 在 Vue 组件中使用

```vue
<template>
  <div class="map-container">
    <div id="cesiumContainer" ref="cesiumContainer"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { CesiumMapToolbar, initCesium } from 'vmap-cesium-toolbar';
import 'vmap-cesium-toolbar/style';

const cesiumContainer = ref<HTMLElement>();
let viewer: any;
let toolbar: CesiumMapToolbar | null = null;

onMounted(async () => {
  // 初始化地图
  const { viewer: cesiumViewer, initialCenter } = await initCesium('cesiumContainer', {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    scene3DOnly: false,
  });

  viewer = cesiumViewer;

  // 创建工具栏
  const container = document.getElementById('cesiumContainer');
  if (container) {
    toolbar = new CesiumMapToolbar(
      viewer,
      container,
      {
        position: 'bottom-right',
        buttonSize: 45,
        buttonSpacing: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#4285f4',
        borderRadius: 8,
        zIndex: 1000,
      },
      {
        search: {
          onSearch: async (query: string) => {
            // 实现搜索逻辑
            return [];
          },
          onSelect: (result) => {
            console.log('定位到:', result.name);
          }
        },
        measurement: {
          onDistanceComplete: (positions, distance) => {
            console.log(`测距完成，总距离: ${distance.toFixed(2)} 米`);
          },
          onAreaComplete: (positions, area) => {
            console.log(`测面积完成，面积: ${area.toFixed(2)} 平方公里`);
          },
          onClear: () => {
            console.log('清除测量');
          }
        }
      },
      initialCenter
    );
  }
});

onBeforeUnmount(() => {
  if (toolbar) {
    toolbar.destroy();
  }
});
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100vh;
  position: relative;
}

#cesiumContainer {
  width: 100%;
  height: 100%;
}
</style>
```

## API 文档

### CesiumMapToolbar

#### 构造函数

```typescript
new CesiumMapToolbar(
  viewer: Viewer,
  container: HTMLElement,
  config?: ToolbarConfig,
  callbacks?: {
    search?: SearchCallback;
    measurement?: MeasurementCallback;
    zoom?: ZoomCallback;
  },
  initialCenter?: { longitude: number; latitude: number; height: number }
)
```

#### 主要方法

##### setInitialCenter(center)

设置初始中心点

```typescript
toolbar.setInitialCenter({
  longitude: 116.3974,
  latitude: 39.9093,
  height: 1000
});
```

##### getInitialCenter()

获取初始中心点

```typescript
const center = toolbar.getInitialCenter();
```

##### resetToInitialLocation()

复位到初始位置

```typescript
toolbar.resetToInitialLocation();
```

##### drawMonitoringCircle(longitude, latitude, height, radius, options)

绘制监控圆形区域（代理到 DrawHelper）

```typescript
const circle = toolbar.drawMonitoringCircle(
  120.16,  // 经度
  30.28,   // 纬度
  100,     // 高度
  500,     // 半径500米
  {
    borderColor: '#0062FF',
    fillColor: '#0062FF',
    borderWidth: 2,
    name: '监控区域'
  }
);
```

##### drawVerticalLine(longitude, latitude, height, options)

绘制垂直线条（代理到 DrawHelper）

```typescript
const line = toolbar.drawVerticalLine(
  120.15,  // 经度
  30.25,   // 纬度
  1000,    // 高度1000米
  {
    color: '#0062FF',
    width: 3,
    dashPattern: 0x00FF00FF,
    name: '垂直线',
    groundHeight: 0
  }
);
```

##### destroy()

销毁工具栏

```typescript
toolbar.destroy();
```

### DrawHelper

#### 构造函数

```typescript
new DrawHelper(viewer: Viewer)
```

#### 主要方法

##### startDrawingLine()

开始绘制线条

```typescript
drawHelper.startDrawingLine();
```

##### startDrawingPolygon()

开始绘制多边形

```typescript
drawHelper.startDrawingPolygon();
```

##### startDrawingRectangle()

开始绘制矩形

```typescript
drawHelper.startDrawingRectangle();
```

##### drawFrustum(options)

绘制视锥体

```typescript
drawHelper.drawFrustum({
  position: cameraPosition,
  orientation: cameraOrientation,
  fov: 60,
  aspectRatio: 1.5,
  near: 10,
  far: 2000,
  fillColor: Cesium.Color.BLUE.withAlpha(0.3),
  outlineColor: Cesium.Color.WHITE,
  onRightClick: (pos) => {
    console.log('视锥体被右键点击:', pos);
  }
});
```

##### clearAll()

清除所有绘制内容

```typescript
drawHelper.clearAll();
```

##### clearFrustum()

清除视锥体

```typescript
drawHelper.clearFrustum();
```

##### drawMonitoringCircle(longitude, latitude, height, radius, options?)

绘制监控圆形区域

```typescript
const circle = drawHelper.drawMonitoringCircle(
  120.16,  // 经度
  30.28,   // 纬度
  100,     // 高度
  500,     // 半径（米）
  {
    borderColor: '#0062FF',
    fillColor: '#0062FF',
    borderWidth: 2,
    name: '监控区域'
  }
);
```

##### drawVerticalLine(longitude, latitude, height, options?)

绘制垂直线条

```typescript
const line = drawHelper.drawVerticalLine(
  120.15,  // 经度
  30.25,   // 纬度
  1000,    // 高度
  {
    color: '#0062FF',
    width: 3,
    dashPattern: 0x00FF00FF,
    name: '垂直线条',
    groundHeight: 0
  }
);
```

### initCesium

#### 函数签名

```typescript
async function initCesium(
  containerId: string,
  options: InitOptions,
  mapCenter?: MapCenter
): Promise<{ viewer: Viewer; initialCenter: MapCenter }>
```

#### 使用示例

```typescript
const { viewer, initialCenter } = await initCesium('cesiumContainer', {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  animation: false,
  baseLayerPicker: false,
  fullscreenButton: false,
  geocoder: false,
  homeButton: false,
  infoBox: false,
  sceneModePicker: false,
  selectionIndicator: false,
  timeline: false,
  navigationHelpButton: false,
  scene3DOnly: false,
}, {
  longitude: 120.2052342,
  latitude: 30.2489634,
  height: 1000,
  pitch: -60,
  heading: 0
});
```

## 配置选项

### ToolbarConfig

```typescript
interface ToolbarConfig {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  buttonSize?: number;           // 按钮大小 (默认40px)
  buttonSpacing?: number;        // 按钮间距 (默认8px)
  backgroundColor?: string;      // 背景色
  borderColor?: string;          // 边框色
  borderRadius?: number;         // 圆角半径
  borderWidth?: number;          // 边框宽度
  boxShadow?: string;           // 阴影
  zIndex?: number;              // 层级
}
```

### SearchCallback

```typescript
interface SearchCallback {
  onSearch?: (query: string) => Promise<SearchResult[]>;
  onSelect?: (result: SearchResult) => void;
}
```

### MeasurementCallback

```typescript
interface MeasurementCallback {
  onDistanceComplete?: (positions: Cartesian3[], distance: number) => void;
  onAreaComplete?: (positions: Cartesian3[], area: number) => void;
  onClear?: () => void;
}
```

### ZoomCallback

```typescript
interface ZoomCallback {
  onZoomIn?: (beforeLevel: number, afterLevel: number) => void;
  onZoomOut?: (beforeLevel: number, afterLevel: number) => void;
}
```

## 工具栏功能

### 1. 搜索功能 🔍

- 鼠标悬停显示搜索框
- 支持地址搜索
- 点击搜索结果自动定位

### 2. 测量功能 📏

- 测距：支持多点折线，显示每段距离和总距离
- 测面积：绘制淡绿色填充多边形，显示面积
- 清除：清除所有测量内容

### 3. 2D/3D切换 🔄

- 一键切换2D和3D视角
- 按钮文本自动更新

### 4. 图层切换 📚

- 支持天地图的普通、三维、影像、地形四种类型
- 单选模式，默认影像图

### 5. 定位功能 🎯

- 复位到地图初始中心点
- 平滑飞行动画

### 6. 缩放功能 🔍+/🔍-

- 地图放大/缩小
- 支持缩放回调

### 7. 全屏功能 ⛶

- 进入/退出全屏模式
- 自动检测全屏状态

## 样式定制

### CSS 变量

```css
:root {
  --toolbar-bg: rgba(255, 255, 255, 0.95);
  --toolbar-border: #e0e0e0;
  --toolbar-radius: 6px;
  --button-bg: rgba(66, 133, 244, 0.4);
  --button-hover-bg: rgba(51, 103, 214, 0.9);
  --button-color: white;
}
```

### 自定义样式

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

## 注意事项

1. **Cesium Token**：使用世界地形需要有效的 Cesium Ion Token
2. **网络连接**：确保网络连接正常，能够访问 Cesium 服务
3. **浏览器兼容性**：确保浏览器支持 WebGL
4. **内存管理**：记得在组件销毁时调用 `destroy()` 方法
5. **事件冲突**：工具栏会管理自己的事件处理器，避免与其他组件冲突

## 许可证

MIT License

## 更新日志

### v1.0.0

- 初始版本发布
- 支持完整的工具栏功能（搜索、测量、2D/3D切换、图层切换、定位、缩放、全屏）
- 支持完整的绘图功能（点、线、多边形、矩形、视锥体）
- 完整的回调系统和事件处理
- 可配置的样式选项
- 完善的错误处理和资源管理
