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

### 0. 多厂商地图接入先收口到 `mapService`

如果旧业务同时维护 `layers/baseMap`、`mapAuth`、搜索代理和搜索选中后的二次定位，建议先把这几条线合并成组件拥有的地图服务入口。

旧写法：

```ts
const mapPlugin = createMapPlugin('cesiumContainer', {
  baseMap: {
    provider: 'tdt',
    type: 'img',
    showLabel: true,
  },
  mapAuth: {
    tdt: {
      token: 'YOUR_TDT_TOKEN',
      sk: 'YOUR_TDT_SK',
    },
  },
  services: {
    toolbar: {
      enabled: true,
      callbacks: {
        onSearch: async (query) => [],
        onSelect: (result) => {
          viewer.camera.flyTo(...);
        },
      },
    },
  },
});
```

新写法：

```ts
const mapService = {
  provider: 'tdt',
  serviceKey: 'YOUR_TDT_TOKEN',
  secureKey: 'YOUR_TDT_SK',
} as const;

const validation = await validateMapService(mapService);
if (!validation.ok) {
  throw new Error(validation.capabilities.basemap.message || '地图服务不可用');
}

const mapPlugin = createMapPlugin('cesiumContainer', {
  mapService,
  onSearchResultSelected: (result) => {
    console.log(result.longitude, result.latitude);
  },
  services: {
    toolbar: {
      enabled: true,
    },
  },
});
```

迁移要点：

- 业务不再自己拼厂商搜索 URL、签名或坐标转换
- 业务不再在搜索选中后再次 `flyTo()`
- `mapService` 模式下不允许继续传 `callbacks.onSearch`
- 私有地图改为 `provider: 'private' + offlineMapUrl`

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

旧 `layers/baseMap` 模式统一通过 `mapPlugin.updateLayers()`。

如果已经迁到 `mapService`，请改用：

```ts
await mapPlugin.setMapService({
  provider: 'private',
  offlineMapUrl: '/tiles/{z}/{x}/{y}.png',
});
```

该调用会返回结构化结果，并在切换失败时保留旧地图状态。

### 4. 什么时候调用 destroy？

组件卸载或页面退出时，只需要调用一次 `mapPlugin.destroy()`。

### 5. `mapService` 和旧入口能混用吗？

不能。`mapService` 与旧 `layers`、`baseMap`、`mapAuth` 属于两套入口，1.x 兼容期内允许二选一，但不定义混用优先级。

### 6. 旧 `updateBaseMap/updateMapAuth/setMapAuth` 还能继续用吗？

仅限旧 `baseMap/mapAuth` 接入路径继续使用。进入 `mapService` 模式后，这三个入口都应视为废弃兼容接口。

## Overlay selection 迁移

如果旧业务已经依赖 overlay click highlight，迁到 2.x 时建议顺手把 selection 语义也一并对齐。

### 1. `clickHighlight` 迁到 `selectionHighlight`

旧写法：

```ts
overlayService.addPolygon({
  positions,
  clickHighlight: true,
  hoverHighlight: true,
});
```

推荐新写法：

```ts
overlayService.addPolygon({
  positions,
  selectionHighlight: {
    color: "#00E5FF",
    fillAlpha: 0.4,
  },
  hoverHighlight: true,
});
```

兼容说明：

- `clickHighlight` 仍然可用
- `selectionHighlight` 与 `clickHighlight` 同时传入时，以 `selectionHighlight` 为准
- 若需要“有选中状态但不改外观”，可以显式写 `selectionHighlight: false`

### 2. picking 配置迁到 grouped `picking`

旧写法：

```ts
const overlayService = new OverlayService(viewer, {
  enableHoverHandler: true,
  clickPickMinIntervalMs: 120,
});
```

推荐新写法：

```ts
const overlayService = new OverlayService(viewer, {
  picking: {
    enabled: true,
    hover: true,
    selection: true,
    pickWidth: 3,
    pickHeight: 3,
    drillLimit: 16,
    clickDebounceMs: 250,
  },
});
```

兼容说明：

- `enableHoverHandler` 仍可继续作为 hover 迁移别名
- `clickPickMinIntervalMs` 仍可继续作为 `clickDebounceMs` 的迁移别名

### 3. 点击后的业务观察点改为 `onSelectionChange`

2.x 推荐不要再只盯着 overlay 自身 `onClick`。更稳定的同步点是：

```ts
const unsubscribe = overlayService.onSelectionChange((event) => {
  console.log(event.currentId, event.previousId, event.reason);
});
```

pointer click 的顺序是：

1. 提交 selection
2. 触发 `onSelectionChange`
3. 调用 overlay 自身 `onClick`

程序化 `selectOverlay` / `clearSelection` 不会调用 overlay 自身 `onClick`。

### 4. reason 集合需要按 2.x 对齐

如果旧业务只处理“点击选中 / 取消选中”，建议把 reason 分支补齐到以下集合：

- `pointer-select`
- `pointer-toggle-off`
- `empty-click`
- `api-select`
- `api-clear`
- `hidden`
- `removed`
- `disabled`
- `edit-start`

其中最容易漏掉的是：

- `hidden`: 已选中的 overlay 被隐藏
- `removed`: 已选中的 overlay 被删除
- `disabled`: 已选中的 overlay 被改成不可选
- `edit-start`: 编辑开始强制接管 selection

### 5. 可选中的判定迁到 `selectable`

旧业务里常见的“有 `onClick` 就默认可点”在 2.x 仍有兼容推断，但新代码建议显式声明：

```ts
overlayService.addMarker({
  position,
  selectable: true,
  selectionHighlight: true,
});
```

如果某些对象只允许 hover、不允许 selected，推荐：

```ts
overlayService.addPolygon({
  positions,
  hoverHighlight: true,
  selectable: false,
});
```
