# @xingm/vmap-cesium-toolbar

一个以 MapPlugin 为中心的 Cesium 地图工具库，重构后将 Viewer 生命周期、工具栏、覆盖物和绘制能力统一收敛到插件内核与服务层，并保留一层兼容适配器用于平滑迁移旧 API。

## 安装

```bash
npm install @xingm/vmap-cesium-toolbar cesium
```

## 推荐入口

新项目只推荐使用 createMapPlugin、MapPlugin 和服务层 API。

```ts
import { createMapPlugin } from '@xingm/vmap-cesium-toolbar';

const mapPlugin = createMapPlugin('cesiumContainer', {
  cesiumToken: 'your-cesium-ion-token',
  camera: {
    center: [116.3974, 39.9093, 1000],
    pitch: -45,
    heading: 0,
  },
  layers: {
    type: 'tdt',
    tdt: {
      mapTypeId: 'img',
      token: 'your-tianditu-token',
      showLabel: true,
    },
  },
  viewerOptions: {
    animation: false,
    timeline: false,
    navigationHelpButton: false,
  },
  services: {
    overlay: true,
    draw: true,
    toolbar: {
      enabled: true,
      callbacks: {
        onSearch: async () => [],
      },
    },
  },
});

const viewer = await mapPlugin.initialize();
const toolbarService = mapPlugin.getToolbarService();
const overlayService = mapPlugin.getOverlayService();
const drawService = mapPlugin.getDrawService();

drawService.startDrawing('polygon');

mapPlugin.updateLayers({
  type: 'tdt',
  tdt: {
    mapTypeId: 'vec',
    token: 'your-tianditu-token',
    showLabel: true,
  },
});
```

## 重构后的公开层次

### 1. 新 API

- createMapPlugin
- MapPlugin
- ToolbarService
- OverlayService
- DrawService
- Marker、Label、Icon、SVG、InfoWindow、Polyline、Polygon、Rectangle、Circle、Ring
- HeatmapLayer、PointClusterLayer

### 2. 类型与样式能力

- MapPluginOptions、ToolbarConfig、LayersConfig 等统一从顶层导出
- i18n 与样式系统继续保留顶层导出，供组件与业务侧接入

### 3. 兼容 API

以下导出仍保留，但定位是迁移适配层，不再是推荐入口：

- initCesium
- CesiumMapToolbar
- CesiumOverlayService
- DrawHelper

## 迁移建议

建议按下面顺序逐步迁移旧业务。

1. 用 createMapPlugin(...).initialize() 替代 initCesium(...)
2. 用 services.toolbar 或 mapPlugin.getToolbarService() 替代直接构造 CesiumMapToolbar
3. 用 mapPlugin.getOverlayService() 替代直接维护 CesiumOverlayService 生命周期
4. 用 mapPlugin.getDrawService() 替代 DrawHelper 的直接持有
5. 仅在过渡窗口内保留 compat 导出

### 旧写法

```ts
import { initCesium, CesiumMapToolbar } from '@xingm/vmap-cesium-toolbar';
```

### 新写法

```ts
import { createMapPlugin } from '@xingm/vmap-cesium-toolbar';
```

## Vue 3 示例

```vue
<template>
  <div id="cesiumContainer" style="width: 100%; height: 100vh"></div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue';
import { createMapPlugin } from '@xingm/vmap-cesium-toolbar';

let mapPlugin: ReturnType<typeof createMapPlugin> | null = null;

onMounted(async () => {
  mapPlugin = createMapPlugin('cesiumContainer', {
    camera: {
      center: [116.3974, 39.9093, 1000],
      pitch: -45,
    },
    layers: {
      type: 'tdt',
      tdt: {
        mapTypeId: 'img',
        token: 'your-tianditu-token',
      },
    },
    services: {
      toolbar: { enabled: true },
      overlay: true,
      draw: true,
    },
  });

  await mapPlugin.initialize();
});

onBeforeUnmount(() => {
  mapPlugin?.destroy();
});
</script>
```

## 文档入口

- 架构说明：doc/guide/Architecture.md
- 迁移指南：doc/guide/Migration_Guide.md
- API 目录：doc/api/index.md

说明：当前文档站已优先切换为“新架构说明 + 兼容 API 参考”的组织方式，新的逐个 API 页面会继续补齐。

## 开发命令

```bash
pnpm run build:plugin
pnpm run type-check
pnpm run docs:dev
pnpm run docs:build
```
