# @xingm/vmap-cesium-toolbar

一个基于 Cesium 的现代化地图工具库，提供模块化的地图插件、实体管理、服务层和UI组件。

## ✨ 特性

- 🏗️ **模块化架构** - 清晰的分层设计（core/components/adapters）
- 🎯 **类型安全** - 完整的 TypeScript 支持
- 🔧 **高度可定制** - 灵活的配置和样式系统
- 📱 **Vue 3 兼容** - 原生支持 Vue 3 项目
- 🔄 **向后兼容** - 保持与旧版本的 API 兼容性
- 🚀 **高性能** - 优化的渲染和事件处理
- 🌍 **多语言支持** - 内置国际化系统

## 📦 安装

```bash
npm install @xingm/vmap-cesium-toolbar cesium
```

## 🚀 快速开始

### 基本使用

```javascript
import { MapPlugin, createMapPlugin } from '@xingm/vmap-cesium-toolbar';

// 创建地图插件
const plugin = await createMapPlugin('cesiumContainer', {
  // Cesium Ion Token（可选）
  cesiumToken: 'your-cesium-ion-token',
  
  // 相机配置
  camera: {
    center: [116.3974, 39.9093, 1000000], // 北京 [经度, 纬度, 高度]
    pitch: -45,
    heading: 0,
    roll: 0
  },
  
  // 图层配置
  layers: {
    type: 'tdt', // 地图类型: 'tdt' | 'gaode' | 'baidu' | 'osm' | 'custom'
    tdt: {
      mapTypeId: 'img', // 天地图类型: 'vec' | 'img' | 'ter'
      token: 'your-tianditu-token',
      showLabel: true
    }
  },
  
  // Cesium Viewer 原生配置
  viewerOptions: {
    animation: false,
    timeline: false,
    geocoder: false
  }
});

// 获取 Cesium Viewer 实例
const viewer = plugin.getViewer();
```

### Vue 3 项目中使用

```vue
<template>
  <div id="cesiumContainer" style="width: 100%; height: 100vh"></div>
</template>

<script setup>
import { onMounted } from 'vue';
import { createMapPlugin } from '@xingm/vmap-cesium-toolbar';

onMounted(async () => {
  const plugin = await createMapPlugin('cesiumContainer', {
    cesiumToken: 'your-cesium-ion-token',
    camera: {
      center: [116.3974, 39.9093, 1000000],
      pitch: -45
    },
    layers: {
      type: 'tdt',
      tdt: {
        mapTypeId: 'img',
        token: 'your-tianditu-token'
      }
    }
  });
});
</script>
```

## 🏛️ 架构概览

### 核心模块 (core/)

```typescript
import {
  MapPlugin, createMapPlugin  // 地图插件核心
} from '@xingm/vmap-cesium-toolbar';
```

### 组件模块 (components/)

```typescript
import {
  Toolbar, SearchBox, ToolbarButton // UI组件
} from '@xingm/vmap-cesium-toolbar';
```

### 适配器 (adapters/) - 向后兼容

```typescript
import {
  DrawHelper, // 兼容旧版 DrawHelper
  CesiumOverlayService // 兼容旧版 CesiumOverlayService
} from '@xingm/vmap-cesium-toolbar';
```

## 📚 主要API

### MapPlugin - 核心地图插件

```typescript
// 创建插件实例
const plugin = await createMapPlugin(containerId, {
  // Cesium Ion Token
  cesiumToken: 'your-cesium-ion-token',
  
  // 相机配置
  camera: {
    center: [116.3974, 39.9093, 1000000], // [经度, 纬度, 高度]
    pitch: -45,    // 俯仰角
    heading: 0,    // 朝向角
    roll: 0        // 翻滚角
  },
  
  // 图层配置
  layers: {
    type: 'tdt',   // 地图类型
    tdt: {
      mapTypeId: 'img',  // 天地图类型: 'vec' | 'img' | 'ter'
      token: 'your-token',
      showLabel: true
    }
  },
  
  // Cesium Viewer 原生配置
  viewerOptions: {
    animation: false,
    timeline: false
  }
});

// 获取 Cesium Viewer 实例
const viewer = plugin.getViewer();

// 获取当前配置
const config = plugin.getConfig();

// 更新相机配置
plugin.updateCamera({
  center: [117.0, 40.0, 500000],
  pitch: -30
});

// 更新图层配置
plugin.updateLayers({
  type: 'gaode',
  gaode: {
    mapTypeId: 'satellite',
    token: 'your-gaode-key'
  }
});

// 检查是否已初始化
if (plugin.isReady()) {
  // 地图已准备就绪
}

// 销毁插件
plugin.destroy();
// 创建标记
const marker = new Marker(viewer, {
  position: [116.3974, 39.9093],
  title: '北京',
  pixelSize: 10,
  color: Cesium.Color.RED
});

// 创建标签
const label = new Label(viewer, {
  position: [116.3974, 39.9093],
  text: '北京市中心',
  font: '12pt sans-serif'
});

// 创建折线
const polyline = new Polyline(viewer, {
  positions: [
    [116.3, 39.9],
    [116.4, 39.9],
    [116.4, 40.0]
  ],
  width: 3,
  material: Cesium.Color.BLUE
});
```

### 服务层 (Services)

```typescript
import { OverlayService, DrawService } from '@xingm/vmap-cesium-toolbar';

// 覆盖物服务
const overlayService = new OverlayService(viewer);
overlayService.addOverlay(marker);
overlayService.setOverlayEditMode(true);

// 绘制服务
const drawService = new DrawService(viewer);
drawService.startDrawing('polygon');
drawService.onComplete((result) => {
  console.log('绘制完成:', result);
});
```

### 图层 (Layers)

```typescript
import { HeatmapLayer, PointClusterLayer } from '@xingm/vmap-cesium-toolbar';

// 热力图层
const heatmap = new HeatmapLayer(viewer, {
  points: [
    { lon: 116.3, lat: 39.9, value: 100 },
    { lon: 116.4, lat: 39.9, value: 80 }
  ],
  gradient: {
    0.0: 'blue',
    0.5: 'yellow',
    1.0: 'red'
  }
});

// 点聚合图层
const cluster = new PointClusterLayer(viewer, {
  points: [
    { id: '1', lon: 116.3, lat: 39.9, value: 1 },
    { id: '2', lon: 116.4, lat: 39.9, value: 1 }
  ],
  pixelRange: 60,
  minimumClusterSize: 2
});
```

## ⚙️ 配置选项

### 地图配置

```typescript
interface MapConfig {
  // 地图类型
  mapType?: 'tdt' | 'custom' | 'default';
  tdtMapTypeId?: string; // 天地图类型: 'vec' | 'img' | 'ter'

  // 认证
  token?: string; // 天地图token
  cesiumToken?: string; // Cesium Ion token

  // 视图配置
  center?: [number, number, number]; // [经度, 纬度, 高度]
  pitch?: number;
  heading?: number;

  // 性能配置
  requestRenderMode?: boolean;
  maximumRenderTimeChange?: number;

  // UI配置
  uiControls?: {
    geocoder?: boolean;
    homeButton?: boolean;
    sceneModePicker?: boolean;
    baseLayerPicker?: boolean;
    navigationHelpButton?: boolean;
    animation?: boolean;
    timeline?: boolean;
    fullscreenButton?: boolean;
  };
}
```

### 工具栏配置

```typescript
interface ToolbarConfig {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  buttonSize?: number;
  buttonSpacing?: number;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  boxShadow?: string;
  zIndex?: number;

  // 功能开关
  showSearch?: boolean;
  showMeasurement?: boolean;
  showDrawing?: boolean;
  showLayerControl?: boolean;
  show2D3DToggle?: boolean;
  showFullscreen?: boolean;

  // 自定义按钮
  buttons?: CustomButtonConfig[];
}
```

### 样式配置

```typescript
interface StyleConfig {
  theme?: 'light' | 'dark' | 'auto';
  primaryColor?: string;
  secondaryColor?: string;

  // CSS变量覆盖
  cssVariables?: Record<string, string>;
}
```

## 🎨 样式定制

组件支持通过CSS变量进行样式定制：

```css
:root {
  --vmap-primary-color: #007acc;
  --vmap-secondary-color: #f0f0f0;
  --vmap-text-color: #333333;
  --vmap-background-color: #ffffff;
  --vmap-border-color: #e0e0e0;
  --vmap-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
```

## 🌐 国际化

内置多语言支持：

```typescript
import { i18n } from '@xingm/vmap-cesium-toolbar';

// 设置语言
i18n.setLocale('zh-CN'); // 中文
i18n.setLocale('en-US');  // 英文

// 自定义翻译
i18n.addMessages('zh-CN', {
  'toolbar.search': '搜索',
  'toolbar.measure': '测量'
});
```

## 📖 示例项目

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

## 📚 API 文档

详细的API文档请参考：

- [MapPlugin API](./doc/api/MapPlugin_API.md)
- [实体类 API](./doc/api/)
- [服务层 API](./doc/api/)
- [组件 API](./doc/api/)

## 🔧 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm run dev

# 构建库
pnpm run build

# 构建文档
pnpm run docs:build

# 类型检查
pnpm run type-check
```

## 📋 依赖要求

- **Cesium**: ^1.134.0
- **Vue**: ^3.0.0 (可选，用于Vue项目)

## 🌐 浏览器支持

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📝 更新日志

### v2.0.0 (2026-03-25)

- ✨ **全新架构重构** - 采用模块化设计，性能大幅提升
- 🏗️ **核心模块化** - 清晰的core/components/adapters分层
- 🎯 **类型安全** - 完整的TypeScript类型定义
- 🔄 **向后兼容** - 保持与旧版本API的兼容性
- 🌐 **国际化支持** - 内置多语言系统
- 🎨 **样式系统** - 灵活的主题和样式定制

### v0.0.6 (2024-12-XX)

- 优化构建配置
- 改进类型定义
- 修复已知问题

### v0.0.1-beta.2

- 新增高度测量功能
- 优化标签显示逻辑
- 修复3D模式下标签位置问题

### v0.0.1-beta.1

- 初始版本发布
- 基础工具栏功能
- 搜索、测量、绘制功能
- Vue 3 支持

```typescript
import { initCesium } from '@xingm/vmap-cesium-toolbar';

const { viewer } = await initCesium('cesiumContainer', {
  cesiumToken: 'your_cesium_ion_token',
});

// 使用天地图时可指定底图类型（默认 imagery）
const { viewer: tdtViewer } = await initCesium('cesiumContainer', {
  mapType: 'tiandi',
  tdtMapTypeId: 'terrain',
  token: 'your_tianditu_token',
});
```

## 🔧 高级用法

### 自定义实体样式

```typescript
import { Marker, Polyline } from '@xingm/vmap-cesium-toolbar';

// 自定义标记样式
const customMarker = new Marker(viewer, {
  position: [116.3974, 39.9093],
  pixelSize: 20,
  color: Cesium.Color.fromCssColorString('#ff6b6b'),
  outlineColor: Cesium.Color.WHITE,
  outlineWidth: 2,
  heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
});

// 自定义折线样式
const styledPolyline = new Polyline(viewer, {
  positions: [[116.3, 39.9], [116.4, 39.9]],
  width: 4,
  material: new Cesium.PolylineGlowMaterialProperty({
    color: Cesium.Color.CYAN,
    glowPower: 0.3
  }),
  clampToGround: true
});
```

### 服务层集成

```typescript
import { OverlayService, DrawService } from '@xingm/vmap-cesium-toolbar';

// 创建服务实例
const overlayService = new OverlayService(viewer);
const drawService = new DrawService(viewer);

// 监听绘制完成事件
drawService.onComplete((result) => {
  if (result.type === 'polygon') {
    // 将绘制结果添加到覆盖物服务
    overlayService.addOverlay(result.entity);
  }
});

// 启用编辑模式
overlayService.setOverlayEditMode(true);

// 监听编辑事件
overlayService.onOverlayEdited((overlay) => {
  console.log('覆盖物已编辑:', overlay);
});
```

### 图层管理

```typescript
import { HeatmapLayer, PointClusterLayer } from '@xingm/vmap-cesium-toolbar';

// 创建热力图
const heatmap = new HeatmapLayer(viewer, {
  points: [
    { lon: 116.3, lat: 39.9, value: 100 },
    { lon: 116.4, lat: 39.9, value: 80 },
    { lon: 116.5, lat: 39.8, value: 60 }
  ],
  radius: 20,
  opacity: 0.7
});

// 动态更新热力图数据
setInterval(() => {
  heatmap.updateData(newPoints);
}, 5000);

// 创建点聚合图层
const clusterLayer = new PointClusterLayer(viewer, {
  points: generatePoints(1000),
  pixelRange: 80,
  minimumClusterSize: 3,
  style: {
    font: '12pt Arial',
    fillColor: Cesium.Color.WHITE,
    backgroundColor: Cesium.Color.fromCssColorString('#007acc'),
    borderRadius: 20
  }
});
```

## ⚙️ 配置选项

### 地图配置

```typescript
interface MapConfig {
  // 地图类型
  mapType?: 'tdt' | 'custom' | 'default';
  tdtMapTypeId?: 'vec' | 'img' | 'ter' | 'terrain';

  // 认证令牌
  token?: string;        // 天地图token
  cesiumToken?: string;  // Cesium Ion token

  // 初始视图
  center?: [number, number, number]; // [经度, 纬度, 高度]
  pitch?: number;
  heading?: number;
  roll?: number;

  // 性能配置
  requestRenderMode?: boolean;
  maximumRenderTimeChange?: number;
  useBrowserRecommendedResolution?: boolean;

  // UI控件
  uiControls?: {
    geocoder?: boolean;
    homeButton?: boolean;
    sceneModePicker?: boolean;
    baseLayerPicker?: boolean;
    navigationHelpButton?: boolean;
    animation?: boolean;
    timeline?: boolean;
    fullscreenButton?: boolean;
  };

  // 地形配置
  terrainProvider?: any;
  terrainExaggeration?: number;

  // 其他配置
  shadows?: boolean;
  shouldAnimate?: boolean;
}
```

### 工具栏配置

```typescript
interface ToolbarConfig {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  buttonSize?: number;
  buttonSpacing?: number;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  boxShadow?: string;
  zIndex?: number;

  // 功能显示控制
  showSearch?: boolean;
  showMeasurement?: boolean;
  showDrawing?: boolean;
  showLayerControl?: boolean;
  show2D3DToggle?: boolean;
  showFullscreen?: boolean;
  showLocation?: boolean;

  // 自定义按钮
  buttons?: CustomButtonConfig[];

  // 国际化
  useI18n?: boolean;
  i18n?: I18nLike;
}
```

### 实体配置示例

```typescript
// 标记配置
const markerOptions: MarkerOptions = {
  position: [116.3974, 39.9093],
  pixelSize: 16,
  color: Cesium.Color.RED,
  outlineColor: Cesium.Color.WHITE,
  outlineWidth: 2,
  heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
  scaleByDistance: new Cesium.NearFarScalar(1000, 1.0, 10000, 0.5)
};

// 折线配置
const polylineOptions: PolylineOptions = {
  positions: [[116.3, 39.9], [116.4, 39.9]],
  width: 3,
  material: Cesium.Color.BLUE,
  clampToGround: true,
  classificationType: Cesium.ClassificationType.TERRAIN
};

// 多边形配置
const polygonOptions: PolygonOptions = {
  hierarchy: [
    [116.3, 39.9], [116.4, 39.9], [116.4, 40.0], [116.3, 40.0]
  ],
  material: Cesium.Color.fromCssColorString('#00ff00').withAlpha(0.5),
  outline: true,
  outlineColor: Cesium.Color.GREEN,
  outlineWidth: 2,
  height: 100,
  extrudedHeight: 200
};
```

## 🎨 样式定制

组件提供了完整的CSS变量支持，可以轻松定制样式：

```css
/* 全局样式变量 */
:root {
  --vmap-primary-color: #007acc;
  --vmap-secondary-color: #6c757d;
  --vmap-success-color: #28a745;
  --vmap-warning-color: #ffc107;
  --vmap-danger-color: #dc3545;

  --vmap-text-color: #212529;
  --vmap-text-muted: #6c757d;
  --vmap-background-color: #ffffff;
  --vmap-surface-color: #f8f9fa;
  --vmap-border-color: #dee2e6;

  --vmap-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --vmap-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  --vmap-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);

  --vmap-border-radius: 6px;
  --vmap-border-radius-sm: 3px;
  --vmap-border-radius-lg: 8px;
}

/* 工具栏样式定制 */
.vmap-toolbar {
  --toolbar-bg-color: var(--vmap-background-color);
  --toolbar-border-color: var(--vmap-border-color);
  --toolbar-button-size: 40px;
  --toolbar-button-spacing: 8px;
  --toolbar-border-radius: var(--vmap-border-radius);
  --toolbar-shadow: var(--vmap-shadow);
}

/* 搜索框样式定制 */
.vmap-search-box {
  --search-border-color: var(--vmap-border-color);
  --search-focus-color: var(--vmap-primary-color);
  --search-shadow: var(--vmap-shadow-sm);
}

/* 按钮样式定制 */
.vmap-button {
  --button-primary-bg: var(--vmap-primary-color);
  --button-secondary-bg: var(--vmap-secondary-color);
  --button-success-bg: var(--vmap-success-color);
  --button-danger-bg: var(--vmap-danger-color);
}
```

### 主题系统

支持亮色和暗色主题：

```typescript
import { styleManager, applyTheme } from '@xingm/vmap-cesium-toolbar';

// 应用亮色主题
applyTheme('light');

// 应用暗色主题
applyTheme('dark');

// 自定义主题
applyTheme({
  name: 'custom',
  colors: {
    primary: '#ff6b6b',
    secondary: '#4ecdc4',
    background: '#2c3e50',
    surface: '#34495e',
    text: '#ecf0f1'
  }
});
```

## 🌐 国际化 (i18n)

内置多语言支持，支持动态切换和自定义翻译：

```typescript
import { i18n } from '@xingm/vmap-cesium-toolbar';

// 设置语言
i18n.setLocale('zh-CN'); // 中文
i18n.setLocale('en-US');  // 英文

// 获取当前语言
const currentLang = i18n.getLocale();

// 添加自定义翻译
i18n.addMessages('zh-CN', {
  'toolbar.search': '搜索',
  'toolbar.measure': '测量',
  'toolbar.draw': '绘制',
  'measurement.distance': '距离测量',
  'measurement.area': '面积测量'
});

// 合并翻译（保留现有翻译）
i18n.addMessages('zh-CN', {
  'custom.feature': '自定义功能'
}, { merge: true });

// 监听语言切换
i18n.onLocaleChange((locale) => {
  console.log('语言已切换到:', locale);
});
```

### 自定义语言包

```typescript
// 自定义语言包
const customTranslations = {
  'ja-JP': {
    'toolbar.search': '検索',
    'toolbar.measure': '測定',
    'toolbar.draw': '描画'
  },
  'ko-KR': {
    'toolbar.search': '검색',
    'toolbar.measure': '측정',
    'toolbar.draw': '그리기'
  }
};

// 注册语言包
Object.entries(customTranslations).forEach(([locale, messages]) => {
  i18n.addMessages(locale, messages);
});
```

## 📖 示例项目

### 基本使用示例

查看 `examples/basic-usage/` 目录：

```bash
cd examples/basic-usage
# 在浏览器中打开 index.html 查看基本功能演示
```

### Vue 3 项目集成示例

查看 `src/App.vue` 文件，了解完整的新框架集成示例：

```bash
# 启动开发服务器
pnpm run dev

# 访问 http://localhost:3003 查看演示
```

App.vue 展示了以下新框架功能：

- **MapPlugin 初始化** - 使用 `createMapPlugin` 创建地图实例
- **实体管理** - 添加 Marker、Label、Polyline、Polygon 等实体
- **服务层集成** - 使用 OverlayService 和 DrawService
- **图层系统** - 添加 HeatmapLayer 和 PointClusterLayer
- **事件处理** - 监听绘制和编辑事件
- **交互演示** - 提供绘制、清除、编辑等功能按钮

### 高级功能示例

```javascript
// 完整的地图应用示例
import {
  createMapPlugin,
  Marker,
  Polyline,
  OverlayService,
  HeatmapLayer
} from '@xingm/vmap-cesium-toolbar';

async function initMap() {
  // 创建地图插件
  const plugin = await createMapPlugin('mapContainer', {
    mapType: 'tdt',
    tdtMapTypeId: 'img',
    token: 'your_tianditu_token',
    center: [116.3974, 39.9093, 1000],
    toolbar: {
      position: 'bottom-right',
      showSearch: true,
      showMeasurement: true,
      showDrawing: true
    }
  });

  const viewer = plugin.getViewer();

  // 添加标记
  const marker = new Marker(viewer, {
    position: [116.3974, 39.9093],
    title: '北京天安门'
  });

  // 添加路径
  const path = new Polyline(viewer, {
    positions: [
      [116.3974, 39.9093],
      [116.4074, 39.9193],
      [116.4174, 39.9293]
    ],
    width: 4,
    material: Cesium.Color.BLUE
  });

  // 添加热力图
  const heatmap = new HeatmapLayer(viewer, {
    points: [
      { lon: 116.3974, lat: 39.9093, value: 100 },
      { lon: 116.4074, lat: 39.9193, value: 80 }
    ]
  });

  // 设置事件监听
  plugin.on('ready', () => {
    console.log('地图初始化完成');
  });

  return plugin;
}
```

## 📚 API 文档

详细的API文档请参考：

- [MapPlugin API](./doc/api/MapPlugin_API.md)
- [实体类 API](./doc/api/)
- [服务层 API](./doc/api/)
- [组件 API](./doc/api/)
- [适配器 API](./doc/api/)

## 🔧 开发指南

```bash
# 安装依赖
pnpm install

# 开发模式（带热重载）
pnpm run dev

# 构建库文件
pnpm run build

# 构建类型定义
pnpm run build:dts

# 构建文档
pnpm run docs:build

# 预览文档
pnpm run docs:preview

# 类型检查
pnpm run type-check

# 生成文件列表
pnpm run generate:file-list
```

### 项目结构

```
src/
├── core/               # 核心模块
│   ├── entities/       # 实体类 (Marker, Label, Polyline等)
│   ├── services/       # 服务层 (OverlayService, DrawService等)
│   ├── layers/         # 图层 (HeatmapLayer, PointClusterLayer)
│   ├── loader/         # 地图加载器
│   ├── types.ts        # 类型定义
│   ├── constants.ts    # 常量定义
│   └── index.ts        # 核心模块导出
├── components/         # UI组件
│   ├── Toolbar.ts      # 工具栏组件
│   ├── SearchBox.ts    # 搜索框组件
│   └── index.ts        # 组件导出
├── adapters/           # 适配器 (向后兼容)
│   ├── DrawHelperAdapter.ts
│   ├── OverlayServiceAdapter.ts
│   └── index.ts        # 适配器导出
├── i18n/               # 国际化
├── styles/             # 样式系统
├── utils/              # 工具函数
└── index.ts            # 主入口
```

## 📋 系统要求

- **Node.js**: >= 16.0.0
- **Cesium**: ^1.134.0
- **Vue**: ^3.0.0 (可选，用于Vue项目)
- **TypeScript**: ^4.5.0

## 🌐 浏览器支持

- **Chrome**: >= 80
- **Firefox**: >= 75
- **Safari**: >= 13
- **Edge**: >= 80
- **移动端**: iOS Safari >= 13, Chrome Mobile >= 80

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献指南

我们欢迎各种形式的贡献！请查看我们的[贡献指南](CONTRIBUTING.md)。

### 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 问题反馈

- 🐛 [提交 Bug](https://github.com/your-username/vmap-cesium-toolbar/issues/new?template=bug_report.md)
- 💡 [功能建议](https://github.com/your-username/vmap-cesium-toolbar/issues/new?template=feature_request.md)
- ❓ [问题讨论](https://github.com/your-username/vmap-cesium-toolbar/discussions)

## 📝 更新日志

### v2.0.0 (2026-03-25) 🎉

**重大更新：全新架构重构**

- ✨ **模块化架构** - 采用清晰的core/components/adapters分层设计
- 🏗️ **核心重构** - 重新设计了实体、服务、图层和组件模块
- 🎯 **类型安全** - 完整的TypeScript类型定义和更好的开发体验
- 🔄 **向后兼容** - 通过适配器保持与旧版本API的兼容性
- 🌐 **国际化支持** - 内置多语言系统，支持动态切换
- 🎨 **样式系统** - 灵活的主题和CSS变量定制
- 🚀 **性能优化** - 优化的渲染性能和内存管理
- 📚 **文档完善** - 完整的API文档和使用指南

**新增功能**
- 🆕 MapPlugin - 统一的地图插件入口
- 🆕 实体系统 - Marker, Label, Polyline, Polygon等
- 🆕 服务层 - OverlayService, DrawService等
- 🆕 图层系统 - HeatmapLayer, PointClusterLayer
- 🆕 组件系统 - Toolbar, SearchBox等UI组件
- 🆕 样式管理器 - 主题切换和样式定制
- 🆕 国际化系统 - 多语言支持

**API变更**
- 🔄 `CesiumMapToolbar` → `MapPlugin` (主要入口)
- 🔄 `DrawHelper` → `DrawService` (新服务)
- 🔄 `CesiumOverlayService` → `OverlayService` (新服务)
- ✅ 保持旧API兼容性通过适配器

### v0.0.6 (2024-12-XX)

- 🔧 优化构建配置和打包流程
- 📝 改进TypeScript类型定义
- 🐛 修复各种已知问题和兼容性问题
- 📦 优化包体积和依赖管理

### v0.0.1-beta.2

- ✨ 新增高度测量功能
- 🎨 优化标签显示逻辑和样式
- 🐛 修复3D模式下标签位置问题
- 🎯 改进绘制工具的用户体验

### v0.0.1-beta.1

- 🎉 初始版本发布
- 🗺️ 基础工具栏功能
- 🔍 搜索功能
- 📏 测量功能
- ✏️ 绘制功能
- ⚡ Vue 3 支持

---

**⭐ 如果这个项目对你有帮助，请给我们一个 Star！**
