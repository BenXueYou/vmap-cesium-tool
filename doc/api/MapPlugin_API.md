# MapPlugin API 文档

## 概述

`MapPlugin` 是新架构下的地图插件内核，负责统一管理：

- `Cesium.Viewer` 生命周期
- 相机与底图初始化
- `ToolbarService`、`OverlayService`、`DrawService` 的装配与销毁
- 图层切换、路网显隐、禁飞区状态与工具栏联动

新项目推荐优先从 `createMapPlugin()` 进入，而不是直接依赖 compat 层的 `initCesium`。

顶层导出：

```ts
import {
  MapPlugin,
  createMapPlugin,
  type MapPluginOptions,
  type ToolbarPluginOptions,
  type OverlayPluginOptions,
  type DrawPluginOptions,
} from '@xingm/vmap-cesium-toolbar';
```

## 推荐用法

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
  services: {
    toolbar: {
      enabled: true,
    },
    overlay: true,
    draw: true,
  },
});

const viewer = await mapPlugin.initialize();

const toolbarService = mapPlugin.getToolbarService();
const overlayService = mapPlugin.getOverlayService();
const drawService = mapPlugin.getDrawService();
```

## 类定义

```ts
class MapPlugin
```

## 构造函数

```ts
constructor(containerId: string, options?: Partial<MapPluginOptions>)
```

说明：

- `containerId`: 地图容器 DOM 的 `id`
- `options`: 地图插件配置；内部会合并默认相机配置、默认图层类型和服务启用状态

通常不直接 `new MapPlugin(...)`，而是通过 `createMapPlugin(...)` 创建。

## 工厂函数

```ts
createMapPlugin(
  containerId: string,
  options?: Partial<MapPluginOptions>,
  toolbarConfig?: ToolbarConfig,
): MapPlugin
```

### 说明

- 前两个参数是标准入口
- 第三个参数 `toolbarConfig` 是保留的便捷参数，会被合并进 `services.toolbar.config`
- 如果传入第三个参数，内部会自动启用 toolbar 服务

## 配置项

### MapPluginOptions

```ts
interface MapPluginOptions {
  viewerOptions?: Cesium.Viewer.ConstructorOptions;
  camera?: CameraConfig;
  layers?: LayersConfig;
  cesiumToken?: string;
  services?: MapPluginServicesOptions;
}
```

### viewerOptions

直接透传给 `Cesium.Viewer` 的原生构造配置。

说明：

- `MapPlugin` 会补默认值，把 `animation`、`timeline`、`navigationHelpButton`、`fullscreenButton`、`geocoder`、`homeButton`、`baseLayerPicker`、`sceneModePicker`、`infoBox`、`selectionIndicator` 默认收敛为 `false`
- 如果传入 `cesiumToken`，会同步设置 `Cesium.Ion.defaultAccessToken`

### CameraConfig

```ts
interface CameraConfig {
  center: [number, number, number];
  pitch?: number;
  heading?: number;
  roll?: number;
}
```

字段说明：

- `center`: `[longitude, latitude, height]`
- `pitch`: 俯仰角，默认 `-45`
- `heading`: 朝向角，默认 `0`
- `roll`: 翻滚角，默认 `0`

### LayersConfig

```ts
type ProviderType = 'tdt' | 'gaode' | 'baidu' | 'arcgis' | 'osm' | 'custom';

interface LayersConfig {
  type?: ProviderType;
  tdt?: TDTLayerConfig;
  gaode?: GaodeLayerConfig;
  baidu?: BaiduLayerConfig;
  arcgis?: ArcGISLayerConfig;
  osm?: OSMLayerConfig;
  custom?: CustomLayerConfig;
}
```

当前实现重点支持：

- `tdt`
- `gaode`
- `baidu`
- `osm`
- `custom`

#### TDTLayerConfig

```ts
interface TDTLayerConfig {
  mapTypeId?: 'vec' | 'img' | 'ter';
  token: string;
  showLabel?: boolean;
}
```

#### GaodeLayerConfig

```ts
interface GaodeLayerConfig {
  mapTypeId?: 'vector' | 'satellite' | 'terrain';
  token?: string;
  showLabel?: boolean;
}
```

#### BaiduLayerConfig

```ts
interface BaiduLayerConfig {
  mapTypeId?: 'normal' | 'satellite' | 'terrain';
  token?: string;
  showLabel?: boolean;
}
```

#### OSMLayerConfig

```ts
interface OSMLayerConfig {
  urlTemplate?: string;
  maximumLevel?: number;
}
```

#### CustomLayerConfig

```ts
interface CustomLayerConfig {
  providers: Cesium.ImageryProvider[];
}
```

### MapPluginServicesOptions

```ts
interface MapPluginServicesOptions {
  toolbar?: boolean | ToolbarPluginOptions;
  overlay?: boolean | OverlayPluginOptions;
  draw?: boolean | DrawPluginOptions;
}
```

默认启用策略：

- `overlay`: 默认启用
- `draw`: 默认启用
- `toolbar`: 默认不启用

### ToolbarPluginOptions

```ts
interface ToolbarPluginOptions {
  enabled?: boolean;
  container?: HTMLElement;
  config?: ToolbarConfig;
  useDefaultButtons?: boolean;
  buttonConfigs?: CustomButtonConfig[];
  searchMenu?: ToolbarSearchMenuOptions;
  layersMenu?: ToolbarLayersMenuOptions;
  callbacks?: ToolbarCallbacks;
}
```

说明：

- `container`: 工具栏挂载容器，默认使用 `viewer.container`
- `config`: 工具栏整体样式
- `buttonConfigs`: 覆盖默认按钮配置
- `searchMenu`: 搜索面板扩展配置
- `layersMenu`: 图层菜单扩展配置
- `callbacks`: 搜索、测量、缩放、全屏、复位的业务回调

### OverlayPluginOptions

```ts
interface OverlayPluginOptions {
  enabled?: boolean;
  enableHoverHandler?: boolean;
  clickPickMinIntervalMs?: number;
}
```

### DrawPluginOptions

```ts
interface DrawPluginOptions {
  enabled?: boolean;
}
```

## 公开方法

### initialize

```ts
initialize(): Promise<Cesium.Viewer>
```

执行地图初始化流程：

1. 查找容器
2. 创建 `Cesium.Viewer`
3. 应用底图配置
4. 设置相机视角
5. 根据 `services` 装配工具栏、覆盖物和绘制服务

说明：

- 重复调用时，如果已初始化，会直接返回现有 viewer
- 容器不存在时会抛错

### getViewer

```ts
getViewer(): Cesium.Viewer | null
```

获取内部持有的 `Cesium.Viewer` 实例。

### getConfig

```ts
getConfig(): MapPluginOptions
```

返回当前 MapPlugin 的配置快照，包括 `viewerOptions`、`camera`、`layers`、`cesiumToken`、`services`。

### updateCamera

```ts
updateCamera(config: Partial<CameraConfig>): void
```

更新相机配置，并在已经初始化的情况下立即调用 `setCameraView()` 应用新视角。

常见用途：

- 更新中心点
- 修改 `pitch`
- 修改 `heading`

### updateLayers

```ts
updateLayers(config: Partial<LayersConfig>): void
```

更新图层配置，并在已经初始化的情况下重新应用底图。

同时会同步：

- 当前地图类型状态
- 注记/路网显隐状态
- 三维路网实例状态
- 工具栏图层菜单状态

### createToolbarService

```ts
createToolbarService(options?: ToolbarPluginOptions): ToolbarService
```

创建并初始化 `ToolbarService`。

说明：

- 如果已存在，会直接返回现有实例
- 内部会注入 `drawHelper`、图层桥接和地图控制器

### getToolbarService

```ts
getToolbarService(): ToolbarService | null
```

获取已创建的 `ToolbarService`。如果没有启用 toolbar 服务，会返回 `null`。

### createOverlayService

```ts
createOverlayService(options?: OverlayPluginOptions): OverlayService
```

创建覆盖物服务。

### getOverlayService

```ts
getOverlayService(): OverlayService
```

获取覆盖物服务。如果尚未创建，会按默认配置自动创建。

### createDrawService

```ts
createDrawService(options?: DrawPluginOptions): DrawService
```

创建绘制服务。

### getDrawService

```ts
getDrawService(): DrawService
```

获取绘制服务。如果尚未创建，会按默认配置自动创建。

### destroy

```ts
destroy(): void
```

销毁 `ToolbarService`、`OverlayService`、`DrawService`、三维路网实例和 `Cesium.Viewer`。

推荐在组件卸载时调用。

### isReady

```ts
isReady(): boolean
```

判断插件是否已初始化完成。

## 公开行为说明

### 图层与工具栏联动

如果启用了 toolbar，并配置了 `layersMenu`，`MapPlugin` 会负责把这些状态同步给图层菜单：

- 当前地图类型
- 注记/路网是否显示
- 禁飞区是否显示
- 当前地图 token

### 禁飞区

`MapPlugin` 内部包含禁飞区数据源管理逻辑。开启后会：

- 加载 GeoJSON 数据
- 构建 `Cesium.CustomDataSource`
- 在工具栏图层菜单中维护显示状态

### 三维路网

`MapPlugin` 会在场景模式变化和图层切换时同步 GeoWTFS 实例：

- 进入 3D 时尝试创建
- 切换图层时重建
- 不满足条件时销毁

## 示例

### 仅启用地图与覆盖物

```ts
const mapPlugin = createMapPlugin('cesiumContainer', {
  layers: {
    type: 'tdt',
    tdt: {
      mapTypeId: 'img',
      token: 'your-tianditu-token',
    },
  },
  services: {
    overlay: true,
    draw: false,
    toolbar: false,
  },
});

await mapPlugin.initialize();

const overlayService = mapPlugin.getOverlayService();
```

### 启用完整服务层

```ts
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
  services: {
    toolbar: {
      enabled: true,
      callbacks: {
        onSearch: async (query) => [],
      },
    },
    overlay: true,
    draw: true,
  },
});

await mapPlugin.initialize();

mapPlugin.updateLayers({
  type: 'tdt',
  tdt: {
    mapTypeId: 'vec',
    token: 'your-tianditu-token',
    showLabel: true,
  },
});
```

## 与 compat 层的关系

- `MapPlugin` 是新架构的主入口
- `initCesium` 是兼容适配入口
- 新业务应优先使用 `createMapPlugin()`
- 旧业务迁移时，可以先把初始化入口替换到 `MapPlugin`，再逐步迁移工具栏、覆盖物和绘制逻辑
