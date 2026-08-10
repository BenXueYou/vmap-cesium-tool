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
  validateMapService,
  i18n,
  type I18nLike,
  type MapPluginOptions,
  type ToolbarPluginOptions,
  type OverlayPluginOptions,
  type DrawPluginOptions,
} from '@xingm/vmap-cesium-toolbar';
```

## 推荐用法

```ts
import { createMapPlugin, validateMapService } from '@xingm/vmap-cesium-toolbar';

const mapService = {
  provider: 'tdt',
  serviceKey: 'your-tianditu-token',
  secureKey: 'your-tianditu-sk',
} as const;

const validation = await validateMapService(mapService);
if (!validation.ok) {
  throw new Error(validation.capabilities.basemap.message || '地图服务不可用');
}

const mapPlugin = createMapPlugin('cesiumContainer', {
  cesiumToken: 'your-cesium-ion-token',
  mapService,
  camera: {
    center: [116.3974, 39.9093, 1000],
    pitch: -45,
    heading: 0,
  },
  onSearchResultSelected: (result) => {
    console.log(result.provider, result.longitude, result.latitude);
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

标记说明：

- `必传`
  - `是`：该字段必须提供
  - `否`：该字段可省略
  - `条件必传`：仅在特定 provider / 模式下必须提供
- `兼容性`
  - `推荐`：当前推荐写法
  - `兼容`：为旧版入口或迁移场景保留
  - `保留`：类型已声明，但当前运行时能力未作为主路径提供
- `mapService` 与 `layers` / `baseMap` / `mapAuth` **不能混用**

### MapPluginOptions

```ts
interface MapPluginOptions {
  viewerOptions?: Cesium.Viewer.ConstructorOptions;
  fxaa?: boolean;
  camera?: CameraConfig;
  layers?: LayersConfig;
  mapService?: MapServiceConfig;
  baseMap?: BaseMapConfig;
  mapAuth?: MapAuthConfig;
  providerSearch?: ProviderSearchOptions;
  onSearchResultSelected?: (result: MapSearchResult) => void;
  credits?: CreditsOptions;
  cesiumToken?: string;
  noFlyZone?: NoFlyZonePluginOptions;
  services?: MapPluginServicesOptions;
}
```

| 字段 | 必传 | 兼容性 | 说明 |
| --- | --- | --- | --- |
| `viewerOptions` | 否 | 推荐 | 透传给 `Cesium.Viewer` 的原生配置 |
| `fxaa` | 否 | 推荐 | 是否启用 FXAA 后处理抗锯齿，默认 `true` |
| `camera` | 否 | 推荐 | 初始化视角配置 |
| `layers` | 否 | 兼容 | 旧版底图配置入口；与 `mapService` 互斥 |
| `mapService` | 否 | 推荐 | 新版地图服务配置入口；与 `layers` / `baseMap` / `mapAuth` 互斥 |
| `baseMap` | 否 | 兼容 | 迁移期底图配置；与 `mapService` 互斥 |
| `mapAuth` | 否 | 兼容 | 迁移期多厂商鉴权配置；与 `mapService` 互斥 |
| `providerSearch` | 否 | 推荐 | 启用内置多厂商搜索 |
| `onSearchResultSelected` | 否 | 推荐 | 地图服务搜索结果选中回调 |
| `credits` | 否 | 推荐 | Cesium 版权区控制，默认隐藏 |
| `cesiumToken` | 否 | 推荐 | Cesium Ion token |
| `noFlyZone` | 否 | 推荐 | 禁飞区初始化配置 |
| `services` | 否 | 推荐 | toolbar / overlay / draw 服务装配配置 |

### viewerOptions

直接透传给 `Cesium.Viewer` 的原生构造配置。

说明：

- `MapPlugin` 会补默认值，把 `animation`、`timeline`、`navigationHelpButton`、`fullscreenButton`、`geocoder`、`homeButton`、`baseLayerPicker`、`sceneModePicker`、`infoBox`、`selectionIndicator` 默认收敛为 `false`
- 如果传入 `cesiumToken`，会同步设置 `Cesium.Ion.defaultAccessToken`
- 初始化时默认开启 WebGL 原生抗锯齿（`contextOptions.webgl.antialias = true`，除非显式传入 `false`），并开启 FXAA；`viewerOptions.msaaSamples` 可用于调整 MSAA 采样数。

### CameraConfig

```ts
interface CameraConfig {
  center: [number, number, number];
  pitch?: number;
  heading?: number;
  roll?: number;
  coordSystem?: CoordSystem;
}
```

| 字段 | 必传 | 兼容性 | 说明 |
| --- | --- | --- | --- |
| `center` | 是 | 推荐 | `[longitude, latitude, height]` |
| `pitch` | 否 | 推荐 | 俯仰角，默认 `-45` |
| `heading` | 否 | 推荐 | 朝向角，默认 `0` |
| `roll` | 否 | 推荐 | 翻滚角，默认 `0` |
| `coordSystem` | 否 | 推荐 | 输入中心点坐标系，默认 `WGS84` |

### LayersConfig

```ts
type ProviderType =
  | 'tdt'
  | 'gaode'
  | 'tencent'
  | 'google'
  | 'baidu'
  | 'arcgis'
  | 'osm'
  | 'custom';

interface LayersConfig {
  type?: ProviderType;
  tdt?: TDTLayerConfig;
  gaode?: GaodeLayerConfig;
  tencent?: TencentLayerConfig;
  google?: GoogleLayerConfig;
  baidu?: BaiduLayerConfig;
  arcgis?: ArcGISLayerConfig;
  osm?: OSMLayerConfig;
  custom?: CustomLayerConfig;
}
```

说明：`LayersConfig` 是 **legacy 兼容入口**，内部会先转成统一的 `baseMap` 配置再参与底图装配；新项目优先使用 `mapService`，迁移项目可继续使用 `layers`。

| 字段 | 必传 | 兼容性 | 说明 |
| --- | --- | --- | --- |
| `type` | 否 | 兼容 | 底图 provider，默认 `tdt` |
| `tdt` | 条件必传 | 兼容 | `type = 'tdt'` 时的配置对象 |
| `gaode` | 条件必传 | 兼容 | `type = 'gaode'` 时的配置对象 |
| `tencent` | 条件必传 | 兼容 | `type = 'tencent'` 时的配置对象 |
| `google` | 条件必传 | 兼容 | `type = 'google'` 时的配置对象 |
| `baidu` | 条件必传 | 兼容 | `type = 'baidu'` 时的配置对象 |
| `arcgis` | 条件必传 | 保留 | 类型已声明，当前未作为主要运行时底图接入 |
| `osm` | 条件必传 | 兼容 | `type = 'osm'` 时的配置对象 |
| `custom` | 条件必传 | 兼容 | `type = 'custom'` 时的配置对象 |

当前实现重点支持：

- `tdt`
- `gaode`
- `tencent`
- `google`
- `baidu`
- `osm`
- `custom`

### MapServiceConfig

```ts
type MapServiceConfig =
  | {
      provider: 'tdt' | 'gaode' | 'baidu' | 'tencent' | 'google';
      serviceKey: string;
      secureKey?: string;
    }
  | {
      provider: 'private';
      offlineMapUrl: string;
    };
```

| 字段 | 必传 | 兼容性 | 说明 |
| --- | --- | --- | --- |
| `provider` | 是 | 推荐 | 在线地图使用 `tdt / gaode / baidu / tencent / google`，私有地图使用 `private` |
| `serviceKey` | 条件必传 | 推荐 | 在线地图服务 key / token |
| `secureKey` | 否 | 推荐 | 在线地图的安全签名字段 |
| `offlineMapUrl` | 条件必传 | 推荐 | `provider = 'private'` 时的离线地图地址 |

说明：

- 新项目优先使用 `mapService`
- `mapService` 不能与旧 `layers`、`baseMap`、`mapAuth` 混用
- 在线地图切换成功后自动接管工具栏搜索；私有地图自动隐藏搜索按钮
- 旧 `services.toolbar.callbacks.onSearch` 在 `mapService` 模式下不再允许覆盖组件搜索

#### TDTLayerConfig

```ts
interface TDTLayerConfig {
  mapTypeId?: 'vec' | 'img' | 'ter' | 'tdt3d';
  token: string;
  sk?: string;
  showLabel?: boolean;
}
```

| 字段 | 必传 | 兼容性 | 说明 |
| --- | --- | --- | --- |
| `mapTypeId` | 否 | 兼容 | 底图类型，默认 `img` |
| `token` | 条件必传 | 兼容 | 在线使用天地图时建议必传 |
| `sk` | 否 | 兼容 | 安全签名字段 |
| `showLabel` | 否 | 兼容 | 是否显示注记层，默认 `true` |

#### GaodeLayerConfig

```ts
interface GaodeLayerConfig {
  mapTypeId?: 'vector' | 'satellite' | 'terrain';
  token?: string;
  sk?: string;
  showLabel?: boolean;
}
```

| 字段 | 必传 | 兼容性 | 说明 |
| --- | --- | --- | --- |
| `mapTypeId` | 否 | 兼容 | 底图类型，默认 `satellite` |
| `token` | 否 | 兼容 | 高德 key |
| `sk` | 否 | 兼容 | 安全签名字段 |
| `showLabel` | 否 | 兼容 | 是否显示注记层，默认 `true` |

#### TencentLayerConfig

```ts
interface TencentLayerConfig {
  key?: string;
  token?: string;
  mapTypeId?: 'vector' | 'satellite';
  showLabel?: boolean;
}
```

| 字段 | 必传 | 兼容性 | 说明 |
| --- | --- | --- | --- |
| `key` | 否 | 兼容 | 腾讯地图 key |
| `token` | 否 | 兼容 | 旧版兼容字段，等价于 `key` |
| `mapTypeId` | 否 | 兼容 | 底图类型，默认 `satellite` |
| `showLabel` | 否 | 兼容 | 是否显示注记层，默认 `true` |

#### GoogleLayerConfig

```ts
interface GoogleLayerConfig {
  apiKey?: string;
  key?: string;
  token?: string;
  mapTypeId?: 'roadmap' | 'satellite';
  showLabel?: boolean;
}
```

| 字段 | 必传 | 兼容性 | 说明 |
| --- | --- | --- | --- |
| `apiKey` | 否 | 兼容 | Google Maps key |
| `key` | 否 | 兼容 | 兼容别名 |
| `token` | 否 | 兼容 | 兼容别名 |
| `mapTypeId` | 否 | 兼容 | 底图类型，默认 `roadmap` |
| `showLabel` | 否 | 兼容 | 是否显示注记层，默认 `false` |

#### BaiduLayerConfig

```ts
interface BaiduLayerConfig {
  mapTypeId?: 'normal' | 'satellite' | 'terrain';
  token?: string;
  sk?: string;
  showLabel?: boolean;
}
```

| 字段 | 必传 | 兼容性 | 说明 |
| --- | --- | --- | --- |
| `mapTypeId` | 否 | 兼容 | 底图类型，默认 `satellite` |
| `token` | 否 | 兼容 | 百度 `ak` |
| `sk` | 否 | 兼容 | 安全签名字段 |
| `showLabel` | 否 | 兼容 | 是否显示注记层，默认 `true` |

#### ArcGISLayerConfig

```ts
interface ArcGISLayerConfig {
  url: string;
  dynamic?: boolean;
}
```

| 字段 | 必传 | 兼容性 | 说明 |
| --- | --- | --- | --- |
| `url` | 是 | 保留 | ArcGIS 服务地址 |
| `dynamic` | 否 | 保留 | 是否使用动态图层 |

#### OSMLayerConfig

```ts
interface OSMLayerConfig {
  urlTemplate?: string;
  maximumLevel?: number;
}
```

| 字段 | 必传 | 兼容性 | 说明 |
| --- | --- | --- | --- |
| `urlTemplate` | 否 | 兼容 | OSM URL 模板 |
| `maximumLevel` | 否 | 兼容 | 最大层级，默认 `19` |

#### CustomLayerConfig

```ts
interface CustomLayerConfig {
  providers: Cesium.ImageryProvider[];
  type?: 'xyz' | 'wmts' | 'imageryProviders';
  mode?: 'online' | 'offline';
  customUrl?: string;
  urlTemplate?: string;
  rectangle?: BaseMapRectangle;
  minimumLevel?: number;
  maximumLevel?: number;
  credit?: string;
  cameraBounds?: OfflineCameraBoundsConfig;
  wmtsLayer?: string;
  wmtsStyle?: string;
  wmtsFormat?: string;
  tileMatrixSetId?: string;
}
```

| 字段 | 必传 | 兼容性 | 说明 |
| --- | --- | --- | --- |
| `providers` | 是 | 兼容 | 自定义影像源数组 |
| `type` | 否 | 兼容 | 自定义底图类型 |
| `mode` | 否 | 兼容 | 在线 / 离线模式 |
| `customUrl` | 否 | 兼容 | 自定义地址 |
| `urlTemplate` | 否 | 兼容 | 模板地址 |
| `rectangle` | 否 | 兼容 | 图层显示范围 |
| `minimumLevel` | 否 | 兼容 | 最小层级 |
| `maximumLevel` | 否 | 兼容 | 最大层级 |
| `credit` | 否 | 兼容 | 版权说明 |
| `cameraBounds` | 否 | 兼容 | 离线地图初始视域约束 |
| `wmtsLayer` | 否 | 兼容 | WMTS 图层名 |
| `wmtsStyle` | 否 | 兼容 | WMTS 样式 |
| `wmtsFormat` | 否 | 兼容 | WMTS 输出格式 |
| `tileMatrixSetId` | 否 | 兼容 | WMTS 瓦片矩阵集 |

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
- 多语言注入入口位于 `config.useI18n` 与 `config.i18n`

#### ToolbarConfig 中与 i18n 相关的字段

```ts
interface ToolbarConfig {
  // ...其他样式字段
  useI18n?: boolean;
  i18n?: I18nLike;
}
```

说明：

- `MapPlugin.createToolbarService(...)` 当前读取的是 `services.toolbar.config.useI18n`
- `MapPlugin.createToolbarService(...)` 当前读取的是 `services.toolbar.config.i18n`
- 如果把 `i18n` 写到 `services.toolbar` 根级，当前源码不会传给 `ToolbarService`

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
  i18n?: I18nLike;
  useI18n?: boolean;
}
```

字段说明：

- `enabled`: 是否启用 `DrawService`
- `i18n`: 注入给 `DrawService` 的多语言实例
- `useI18n`: 是否启用绘制内部多语言，默认 `true`

## 公开方法

## 多语言装配示例

```ts
import { createMapPlugin, i18n } from '@xingm/vmap-cesium-toolbar';

i18n.configure({
  persist: false,
  useStoredLocale: false,
});

i18n.addMessages('en-US', {
  demo: {
    located: 'Located: {name}',
  },
}, { merge: true });

const mapPlugin = createMapPlugin('cesiumContainer', {
  services: {
    toolbar: {
      enabled: true,
      config: {
        useI18n: true,
        i18n,
      },
    },
    draw: {
      enabled: true,
      useI18n: true,
      i18n,
    },
  },
});
```

说明：

- `ToolbarService` 的 i18n 由 `services.toolbar.config` 传入
- `DrawService` 的 i18n 由 `services.draw` 传入
- `OverlayService` 当前没有独立的 i18n 装配项；如需提示文案，通常在宿主业务中直接调用 `i18n.t(...)`

完整接口见 [i18n API](/api/I18n_API)。

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

> `mapService` 模式下不要再调用 `updateLayers()`、`updateBaseMap()`、`updateMapAuth()` 或 `setMapAuth()`。

### validateMapService

```ts
validateMapService(
  mapService: MapServiceConfig,
  options?: MapServiceValidationOptions,
): Promise<MapServiceValidationResult>
```

说明：

- 用于初始化前或配置页中预校验地图服务
- 默认只校验底图能力，搜索能力返回 `notChecked` 或 `unavailable`
- 返回结构中会区分配置错误、凭证错误、网络故障、代理问题和客户端限制

### setMapService

```ts
setMapService(mapService: MapServiceConfig): Promise<MapServiceUpdateResult>
```

说明：

- 运行时异步切换在线或私有地图服务
- 旧搜索请求在切换开始后立即失效
- 切换失败时保留旧地图、旧工具栏搜索状态和旧配置快照
- 返回值中的 `changed` 表示本次是否真正提交了新地图服务

返回示例：

```ts
const update = await mapPlugin.setMapService({
  provider: 'private',
  offlineMapUrl: '/tiles/{z}/{x}/{y}.png',
});

if (!update.ok) {
  console.warn(update.code, update.capabilities.basemap.message);
}
```

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

### updateToolbarStyle

```ts
updateToolbarStyle(config: Partial<ToolbarConfig>): void
```

运行时更新地图组件内部 toolbar 的 UI 样式，无需重建地图实例。

常见用途：

- 调整 `position`
- 调整 `direction`
- 调整 `buttonSize`
- 调整 `buttonSpacing`
- 调整 `offsetTop` / `offsetRight` / `offsetBottom` / `offsetLeft`

### setToolbarPosition

```ts
setToolbarPosition(
  position: NonNullable<ToolbarConfig['position']>,
  offsets?: Pick<ToolbarConfig, 'offsetTop' | 'offsetRight' | 'offsetBottom' | 'offsetLeft'>,
): void
```

专门用于运行时切换 toolbar 停靠位置和边距偏移。

### getToolbarConfig

```ts
getToolbarConfig(): ToolbarConfig
```

返回当前地图组件中 toolbar 的样式配置快照。

示例：

```ts
const mapPlugin = createMapPlugin('cesiumContainer', {
  services: {
    toolbar: {
      enabled: true,
    },
  },
});

await mapPlugin.initialize();

mapPlugin.updateToolbarStyle({
  direction: 'row',
  buttonSize: 44,
  buttonSpacing: 12,
  backgroundColor: 'rgba(15, 23, 42, 0.72)',
});

mapPlugin.setToolbarPosition('top-left', {
  offsetTop: 20,
  offsetLeft: 20,
});

const toolbarConfig = mapPlugin.getToolbarConfig();
console.log(toolbarConfig.position, toolbarConfig.direction);
```

### 运行时控制 toolbar UI 示例

下面的例子演示了地图初始化完成后，通过 `MapPlugin` 直接控制 toolbar 的样式和位置：

```ts
const mapPlugin = createMapPlugin('cesiumContainer', {
  services: {
    toolbar: {
      enabled: true,
      config: {
        position: 'bottom-right',
        buttonSize: 36,
      },
    },
  },
});

await mapPlugin.initialize();

function enterWorkbenchMode() {
  mapPlugin.updateToolbarStyle({
    direction: 'row',
    buttonSize: 44,
    buttonSpacing: 12,
    zIndex: 1300,
  });

  mapPlugin.setToolbarPosition('top-left', {
    offsetTop: 20,
    offsetLeft: 20,
  });
}

function enterDefaultMode() {
  mapPlugin.updateToolbarStyle({
    direction: 'column',
    buttonSize: 36,
    buttonSpacing: 8,
  });

  mapPlugin.setToolbarPosition('bottom-right', {
    offsetRight: 16,
    offsetBottom: 16,
  });
}
```

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

mapPlugin.updateToolbarStyle({
  direction: 'row',
  buttonSize: 44,
});

mapPlugin.setToolbarPosition('top-left', {
  offsetTop: 20,
  offsetLeft: 20,
});

console.log(mapPlugin.getToolbarConfig().position);
```

## 与 compat 层的关系

- `MapPlugin` 是新架构的主入口
- `initCesium` 是兼容适配入口
- 新业务应优先使用 `createMapPlugin()`
- 旧业务迁移时，可以先把初始化入口替换到 `MapPlugin`，再逐步迁移工具栏、覆盖物和绘制逻辑
