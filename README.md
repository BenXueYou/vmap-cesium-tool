# @xingm/vmap-cesium-toolbar

一个以 `MapPlugin` 为中心的 Cesium 地图工具库，提供统一的地图编排、工具栏服务、覆盖物服务、绘制服务，以及旧 API 的兼容适配层。

## 安装

```bash
npm install @xingm/vmap-cesium-toolbar cesium
```

## 推荐用法

新项目只推荐使用 `createMapPlugin`、`MapPlugin` 和服务层 API。

```ts
import { createMapPlugin, type ToolbarService } from '@xingm/vmap-cesium-toolbar';

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
        onSearch: async (query) => [],
        onSelect: (result) => {
          console.log(result);
        },
      },
    },
  },
});

const viewer = await mapPlugin.initialize();
const toolbarService: ToolbarService | null = mapPlugin.getToolbarService();
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
    cesiumToken: 'your-cesium-ion-token',
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

## 架构

公开 API 分成三层。

1. 新 API：`createMapPlugin`、`MapPlugin`、`ToolbarService`、`OverlayService`、`DrawService`
2. 类型与常量：统一从 `core/types` 和 `core/constants` 汇总导出
3. 兼容 API：只通过 adapter 暴露，例如 `initCesium`、`CesiumMapToolbar`、`CesiumOverlayService`、`DrawHelper`

## 迁移指南

旧用法：

```ts
import { initCesium, CesiumMapToolbar } from '@xingm/vmap-cesium-toolbar';
```

新用法：

```ts
import { createMapPlugin } from '@xingm/vmap-cesium-toolbar';
```

建议按下面顺序迁移。

1. 用 `createMapPlugin(...).initialize()` 替代 `initCesium(...)`
2. 用 `services.toolbar` 或 `mapPlugin.getToolbarService()` 替代直接构造 `CesiumMapToolbar`
3. 用 `mapPlugin.getOverlayService()`、`mapPlugin.getDrawService()` 接管服务生命周期
4. 仅在过渡期继续调用 compat adapter

## 兼容 API

以下导出仍保留，但只建议用于过渡迁移。

```ts
import {
  initCesium,
  CesiumMapToolbar,
  CesiumOverlayService,
  DrawHelper,
} from '@xingm/vmap-cesium-toolbar';
```

## 主要导出

```ts
import {
  createMapPlugin,
  MapPlugin,
  ToolbarService,
  OverlayService,
  DrawService,
  HeatmapLayer,
  PointClusterLayer,
  Marker,
  Label,
  Polyline,
} from '@xingm/vmap-cesium-toolbar';
```

## 开发命令

```bash
pnpm run build:plugin
pnpm run type-check
pnpm run docs:dev
```
