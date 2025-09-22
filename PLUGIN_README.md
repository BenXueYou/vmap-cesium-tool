# @xingm/vmap-cesium-toolbar

一个功能强大的 Cesium 地图工具栏插件，提供搜索、测量、绘制、图层切换等功能。

## 安装

```bash
npm install @xingm/vmap-cesium-toolbar
# 或
yarn add @xingm/vmap-cesium-toolbar
# 或
pnpm add @xingm/vmap-cesium-toolbar
```

## 依赖配置

### 必需依赖

本插件需要以下必需依赖：

```bash
# Vue 3 (必需)
npm install vue@^3.0.0

# Cesium (必需)
npm install cesium@^1.100.0
```

### 开发依赖配置

如果您使用 Vite 作为构建工具，建议安装以下开发依赖：

```bash
# Vite 相关
npm install -D vite@^7.0.0
npm install -D @vitejs/plugin-vue@^6.0.0
npm install -D vite-plugin-cesium@^1.2.0

# TypeScript 支持 (可选但推荐)
npm install -D typescript@^5.0.0
npm install -D @types/cesium@^1.70.0
npm install -D vue-tsc@^3.0.0
```

### 依赖说明

| 依赖包 | 类型 | 必需性 | 说明 |
|--------|------|--------|------|
| `vue` | 生产依赖 | ✅ 必需 | Vue 3 框架，插件基于 Vue 3 开发 |
| `cesium` | 生产依赖 | ✅ 必需 | Cesium 3D 地球引擎，插件核心依赖 |
| `@vitejs/plugin-vue` | 开发依赖 | ⚠️ 推荐 | Vite 的 Vue 插件，用于 Vue 单文件组件支持 |
| `vite-plugin-cesium` | 开发依赖 | ⚠️ 推荐 | Vite 的 Cesium 插件，用于 Cesium 资源处理 |
| `@types/cesium` | 开发依赖 | ⚠️ 推荐 | Cesium 的 TypeScript 类型定义 |
| `@cesium/engine` | 开发依赖 | ❌ 可选 | Cesium 引擎包，通常由 cesium 包自动安装 |

### Vite 配置示例

创建或更新您的 `vite.config.js` 文件：

```javascript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import cesium from "vite-plugin-cesium";

export default defineConfig({
  plugins: [
    vue(),
    cesium(), // 处理 Cesium 静态资源
  ],
  optimizeDeps: {
    include: ["cesium"], // 预构建 Cesium
  },
  server: {
    port: 3000,
  },
});
```

### 完整安装示例

#### 1. 创建新项目

```bash
# 使用 Vite 创建 Vue 3 项目
npm create vue@latest my-cesium-app
cd my-cesium-app

# 安装依赖
npm install
```

#### 2. 安装插件和必需依赖

```bash
# 安装插件
npm install @xingm/vmap-cesium-toolbar

# 安装必需依赖
npm install cesium@^1.132.0

# 安装开发依赖
npm install -D @vitejs/plugin-vue@^6.0.1
npm install -D vite-plugin-cesium@^1.2.23
npm install -D @types/cesium@^1.70.4
```

#### 3. 配置 Vite

更新 `vite.config.js`：

```javascript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import cesium from "vite-plugin-cesium";

export default defineConfig({
  plugins: [vue(), cesium()],
  optimizeDeps: {
    include: ["cesium"],
  },
});
```

### 常见问题

#### Q: 为什么需要 vite-plugin-cesium？

A: `vite-plugin-cesium` 负责处理 Cesium 的静态资源（如 Web Workers、Assets 等），确保在 Vite 环境下 Cesium 能正常工作。如果不使用此插件，可能会遇到资源加载错误。

#### Q: @types/cesium 是否必需？

A: 不是必需的，但强烈推荐。它提供完整的 TypeScript 类型定义，让您在开发时获得更好的类型提示和错误检查。

#### Q: 可以使用其他构建工具吗？

A: 可以，但需要确保：

- 正确处理 Cesium 的静态资源
- 配置适当的模块解析
- 支持 ES 模块格式

#### Q: 版本兼容性如何？

A: 插件经过测试的版本组合：

- Vue 3.0+
- Cesium 1.100.0+
- Vite 7.0+
- TypeScript 5.0+ (可选)

## 快速开始

### 1. 基本使用

```typescript
import { createApp } from 'vue';
import { CesiumMapToolbar, initCesium } from '@xingm/vmap-cesium-toolbar';
import '@xingm/vmap-cesium-toolbar/style';

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
import { CesiumMapToolbar, initCesium } from '@xingm/vmap-cesium-toolbar';
import '@xingm/vmap-cesium-toolbar/style';

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

#### DrawHelper 构造函数

```typescript
new DrawHelper(viewer: Viewer)
```

#### DrawHelper 主要方法

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

## 配置指南

### 环境要求

- **Node.js**: 16.0+
- **浏览器**: 支持 WebGL 的现代浏览器
- **网络**: 需要访问 Cesium Ion 服务（用于地形数据）

### 项目初始化

#### 方法一：使用 Vite 模板（推荐）

```bash
# 创建 Vue 3 + TypeScript 项目
npm create vue@latest my-cesium-project
cd my-cesium-project

# 选择以下选项：
# ✅ TypeScript
# ✅ JSX Support  
# ✅ Vue Router
# ✅ Pinia
# ✅ Vitest
# ✅ End-to-End Testing Solution
# ✅ ESLint
# ✅ Prettier
```

#### 方法二：手动配置

```bash
# 创建项目目录
mkdir my-cesium-project
cd my-cesium-project

# 初始化 package.json
npm init -y

# 安装依赖
npm install vue@^3.5.0 cesium@^1.132.0 @xingm/vmap-cesium-toolbar
npm install -D vite@^7.0.0 @vitejs/plugin-vue@^6.0.0 vite-plugin-cesium@^1.2.0
npm install -D typescript@^5.0.0 @types/cesium@^1.70.0 vue-tsc@^3.0.0
```

### 项目配置文件

#### package.json 示例

```json
{
  "name": "my-cesium-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.5.0",
    "cesium": "^1.132.0",
    "@xingm/vmap-cesium-toolbar": "^0.0.1-beta.1"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^6.0.0",
    "vite": "^7.0.0",
    "vite-plugin-cesium": "^1.2.0",
    "typescript": "^5.0.0",
    "@types/cesium": "^1.70.0",
    "vue-tsc": "^3.0.0"
  }
}
```

#### vite.config.js 完整配置

```javascript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import cesium from "vite-plugin-cesium";

export default defineConfig({
  plugins: [
    vue(),
    cesium({
      // Cesium 插件配置
      rebuildCesium: true, // 重新构建 Cesium
    }),
  ],
  optimizeDeps: {
    include: ["cesium"], // 预构建 Cesium
  },
  build: {
    // 构建配置
    target: "esnext",
    minify: "terser",
    rollupOptions: {
      output: {
        manualChunks: {
          cesium: ["cesium"], // 将 Cesium 单独打包
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
```

#### tsconfig.json 配置

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["cesium"]
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 环境变量设置

创建 `.env` 文件：

```bash
# Cesium Ion Token
VITE_CESIUM_TOKEN=your_cesium_ion_token_here

# 其他配置
VITE_APP_TITLE=My Cesium App
```

在代码中使用：

```typescript
// 设置 Cesium Token
Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;
```

### 故障排除

#### 常见错误及解决方案

1. **Cesium 资源加载失败**

   ```text
   Error: Failed to load Cesium assets
   ```

   **解决方案**: 确保安装了 `vite-plugin-cesium` 并正确配置

2. **TypeScript 类型错误**

   ```text
   Cannot find module 'cesium' or its corresponding type declarations
   ```

   **解决方案**: 安装 `@types/cesium` 并在 `tsconfig.json` 中添加 `"types": ["cesium"]`

3. **Vue 组件无法识别**

   ```text
   Cannot resolve component
   ```

   **解决方案**: 确保安装了 `@vitejs/plugin-vue` 并在 Vite 配置中启用

4. **构建时内存不足**

   ```text
   JavaScript heap out of memory
   ```

   **解决方案**: 增加 Node.js 内存限制

   ```bash
   node --max-old-space-size=4096 node_modules/.bin/vite build
   ```

### 性能优化建议

1. **按需加载**: 只导入需要的 Cesium 模块
2. **CDN 加速**: 使用 CDN 加载 Cesium 资源
3. **代码分割**: 将 Cesium 相关代码单独打包
4. **缓存策略**: 合理配置浏览器缓存

## 更新日志

### v0.0.1-beta.1

- 初始版本发布
- 支持完整的工具栏功能（搜索、测量、2D/3D切换、图层切换、定位、缩放、全屏）
- 支持完整的绘图功能（点、线、多边形、矩形、视锥体）
- 完整的回调系统和事件处理
- 可配置的样式选项
- 完善的错误处理和资源管理
- 详细的依赖配置说明和安装指南
