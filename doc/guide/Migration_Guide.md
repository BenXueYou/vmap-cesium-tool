---
title: 迁移指南
---

# 迁移指南

## 迁移原则

重构后的推荐路径不是“继续直接使用旧类”，而是“让旧接口逐步映射到新内核”。

建议优先把业务接入点迁到 `MapPlugin`，再逐步移除对 compat 导出的依赖。

## API 对照表

| 旧入口 | 新入口 | 说明 |
| --- | --- | --- |
| `initCesium` | `createMapPlugin(...).initialize()` | 地图初始化收口到 `MapPlugin` |
| `CesiumMapToolbar` | `services.toolbar` 或 `mapPlugin.getToolbarService()` | 工具栏生命周期由插件统一管理 |
| `CesiumOverlayService` | `mapPlugin.getOverlayService()` | 覆盖物服务与 Viewer 同生命周期 |
| `DrawHelper` | `mapPlugin.getDrawService()` | 绘制与测量能力迁入新服务层 |

## 推荐迁移顺序

### 第一步：替换地图初始化入口

旧写法：

```ts
import { initCesium } from '@xingm/vmap-cesium-toolbar';

const { viewer } = await initCesium({
  containerId: 'cesiumContainer',
  cesiumToken: 'your-cesium-ion-token',
});
```

新写法：

```ts
import { createMapPlugin } from '@xingm/vmap-cesium-toolbar';

const mapPlugin = createMapPlugin('cesiumContainer', {
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
      showLabel: true,
    },
  },
});

const viewer = await mapPlugin.initialize();
```

### 第二步：让工具栏由插件装配

旧写法：

```ts
import { CesiumMapToolbar } from '@xingm/vmap-cesium-toolbar';

const toolbar = new CesiumMapToolbar(viewer, {
  useDefaultButtons: true,
});
```

新写法：

```ts
const mapPlugin = createMapPlugin('cesiumContainer', {
  services: {
    toolbar: {
      enabled: true,
      useDefaultButtons: true,
    },
  },
});

await mapPlugin.initialize();

const toolbarService = mapPlugin.getToolbarService();
```

### 第三步：覆盖物服务接入新生命周期

旧写法：

```ts
import { CesiumOverlayService } from '@xingm/vmap-cesium-toolbar';

const overlayService = new CesiumOverlayService(viewer);
```

新写法：

```ts
const overlayService = mapPlugin.getOverlayService();
```

这样做的好处是：

- OverlayService 与 Viewer 生命周期保持一致
- 图层切换、点击和 hover 行为都统一通过插件体系协作
- 业务层不需要重复管理销毁逻辑

### 第四步：把绘制迁到 DrawService

旧写法：

```ts
import { DrawHelper } from '@xingm/vmap-cesium-toolbar';

const drawHelper = new DrawHelper(viewer);
drawHelper.startDrawingPolygon();
```

新写法：

```ts
const drawService = mapPlugin.getDrawService();
drawService.startDrawing('polygon');
```

## 过渡期建议

如果当前业务量较大，不必一次性切完，可以按下面方式分阶段推进：

1. 先只替换地图初始化入口到 `MapPlugin`
2. 保留 compat 工具栏和 compat 覆盖物，确认 Viewer 生命周期稳定
3. 再把业务逻辑逐步迁到 `getToolbarService()`、`getOverlayService()`、`getDrawService()`
4. 最后移除 compat 导入

## 兼容层的定位

兼容层当前仍然对外导出，但定位已经变化：

- 可以继续用于迁移窗口
- 不建议新业务继续新增依赖
- 后续版本会继续向“adapter only”收口

## 常见迁移问题

### 1. 工具栏一定要手动 new 吗？

不需要。新架构建议在 `services.toolbar` 中开启，由 `MapPlugin` 负责创建和销毁。

### 2. 还能不能直接拿到 viewer？

可以。`await mapPlugin.initialize()` 的返回值就是 `viewer`。

### 3. 图层切换怎么做？

统一通过 `mapPlugin.updateLayers()`。如果启用了工具栏图层菜单，相关状态也会由插件同步到工具栏。

### 4. 什么时候调用 destroy？

组件卸载或页面退出时，只需要调用一次 `mapPlugin.destroy()`。