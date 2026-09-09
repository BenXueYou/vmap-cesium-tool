---
title: 多厂商与坐标 API
---

# 多厂商与坐标 API

## BaseMapConfig

```ts
interface BaseMapConfig {
  provider: 'tdt' | 'gaode' | 'tencent' | 'baidu' | 'google' | 'custom';
  type?: string;
  key?: string;
  token?: string;
  ak?: string;
  sk?: string;
  subdomains?: string[];
  customUrl?: string;
  urlTemplate?: string;
  rectangle?: { west: number; south: number; east: number; north: number };
  minimumLevel?: number;
  maximumLevel?: number;
  credit?: string;
  mode?: 'online' | 'offline';
  showLabel?: boolean;
  providers?: Cesium.ImageryProvider[];
  wmtsLayer?: string;
  wmtsStyle?: string;
  wmtsFormat?: string;
  tileMatrixSetId?: string;
  cameraBounds?: OfflineCameraBoundsConfig;
}
```

## MapServiceConfig

新接入推荐直接使用 `mapService`，让组件统一拥有厂商来源、默认底图和搜索能力。

```ts
type OnlineMapServiceProvider =
  | 'tdt'
  | 'gaode'
  | 'baidu'
  | 'tencent'
  | 'google';

type MapServiceConfig =
  | {
      provider: OnlineMapServiceProvider;
      serviceKey: string;
      secureKey?: string;
    }
  | {
      provider: 'private';
      offlineMapUrl: string;
    };
```

约束：

- `mapService` 不能与旧 `baseMap`、`mapAuth`、`layers` 混用
- 在线厂商统一使用 `provider/serviceKey/secureKey`
- 私有地图必须显式传 `provider: 'private'` 和 `offlineMapUrl`
- 私有地图不提供厂商地点搜索

## MapAuthConfig

```ts
interface MapAuthConfig {
  tdt?: { token?: string; sk?: string };
  gaode?: { key?: string };
  tencent?: { key?: string };
  baidu?: { ak?: string };
  google?: { apiKey?: string; mapId?: string };
}
```

高德签名场景还支持 `securityKey`：

```ts
gaode?: { key?: string; securityKey?: string };
```

所有鉴权字符串会在组件边界自动清除首尾空白。

## ProviderSearchOptions

```ts
interface ProviderSearchOptions {
  enabled?: boolean; // 默认 false
  defaultRegion?: string; // 默认“全国”
  endpoints?: Partial<Record<BaseMapProviderId, string>>;
  request?: (
    provider: BaseMapProviderId,
    url: string,
    init?: RequestInit,
  ) => Promise<Response>;
}
```

内置支持天地图、高德、腾讯、百度和 Google。自定义/离线底图返回空结果。业务 `onSearch` 优先于内置搜索。

## CreditsOptions

```ts
interface CreditsOptions {
  visible?: boolean; // 默认 true
}
```

## MapPlugin 新增方法

### `validateMapService(mapService, options?)`

校验底图可用性并返回结构化能力状态。默认只校验底图，不主动调用搜索接口。

```ts
import { validateMapService } from '@xingm/vmap-cesium-toolbar';

const result = await validateMapService({
  provider: 'tdt',
  serviceKey: 'YOUR_TDT_TOKEN',
  secureKey: 'YOUR_TDT_SK',
});
```

返回结构：

```ts
interface MapServiceValidationResult {
  ok: boolean;
  provider: MapServiceProvider;
  code?:
    | 'INVALID_CONFIG'
    | 'INVALID_CREDENTIALS'
    | 'NETWORK_ERROR'
    | 'SERVICE_UNAVAILABLE'
    | 'CLIENT_RESTRICTION'
    | 'PROXY_REQUIRED';
  capabilities: {
    basemap: {
      status: 'available' | 'unavailable' | 'unknown' | 'notChecked';
      credentialVerified?: boolean;
      message?: string;
    };
    search: {
      status: 'available' | 'unavailable' | 'unknown' | 'notChecked';
      requiresEnablement: boolean;
      requiredProduct?: string;
      setupUrl?: string;
      message?: string;
    };
  };
}
```

### `setMapService(mapService)`

异步切换当前地图服务，返回带 `changed` 标记的结构化结果。

```ts
const update = await plugin.setMapService({
  provider: 'private',
  offlineMapUrl: '/tiles/{z}/{x}/{y}.png',
});
```

```ts
interface MapServiceUpdateResult extends MapServiceValidationResult {
  changed: boolean;
}
```

行为约定：

- 切换开始后，旧搜索请求立即失效
- 切换失败时保留旧底图、旧地图服务配置和旧搜索入口状态
- 切到私有地图时隐藏搜索；切回在线地图时恢复为厂商搜索入口
- `changed: false` 表示本次未提交新地图服务

### `onSearchResultSelected`

`mapService` 模式下，工具栏搜索选中后组件只定位一次，并通过该回调返回标准结果：

```ts
onSearchResultSelected?: (result: {
  provider: OnlineMapServiceProvider;
  name: string;
  address: string;
  longitude: number;
  latitude: number;
  height?: number;
  coordSystem?: 'WGS84';
}) => void;
```

业务不再需要二次 `flyTo()`，也不应再次做坐标系判断。

### `updateBaseMap(baseMap)`

> `mapService` 模式下已禁用；仅保留给旧 `baseMap/mapAuth` 接入路径。

合并底图配置，并在组件内部触发影像、地形、注记和离线约束刷新。方法返回 `void`。

```ts
plugin.updateBaseMap({ provider: 'gaode', type: 'satellite' });
```

### `updateMapAuth(mapAuth)`

> `mapService` 模式下已禁用；仅保留给旧 `baseMap/mapAuth` 接入路径。

合并鉴权配置，并在组件内部刷新当前底图。方法返回 `void`。

```ts
plugin.updateMapAuth({ gaode: { key: 'YOUR_KEY' } });
```

### `setMapAuth(mapAuth)`

> `mapService` 模式下已禁用；仅保留给旧 `baseMap/mapAuth` 接入路径。

替换全部厂商鉴权配置并刷新当前底图，适合只允许一个当前服务商的配置中心。

```ts
plugin.setMapAuth({ tencent: { key: 'NEW_KEY' } });
```

### `updateCredits(credits)`

运行时更新 Cesium credit/版权区域显示状态。

```ts
plugin.updateCredits({ visible: false });
```

## 搜索工具导出

```ts
import {
  ProviderSearchService,
  createAmapSignature,
  normalizeMapAuth,
} from '@xingm/vmap-cesium-toolbar';
```

- `ProviderSearchService`：多厂商搜索及 WGS84 结果归一化。
- `createAmapSignature`：按高德规则生成 UTF-8 MD5 数字签名。
- `normalizeMapAuth`：清理各厂商鉴权字符串首尾空白。

### `getLayersServiceBridge()`

返回兼容图层控制对象，包含 `setMapType`、`setPlaceNameVisible`、`togglePlaceNameVisibility`、禁飞区显隐等方法。

## baseMapRegistry

顶层导出的 `baseMapRegistry` 用于获取可用底图类型：

```ts
import { baseMapRegistry } from '@xingm/vmap-cesium-toolbar';

const types = baseMapRegistry.getMapTypes(
  { provider: 'tdt', type: 'img' },
  { tdt: { token: 'YOUR_TOKEN' } },
  viewer,
);

const allTypes = baseMapRegistry.getAllMapTypes(mapAuth, viewer);
```

## CoordinateService

支持 `WGS84`、`GCJ02`、`BD09` 三种坐标系。

```ts
import { CoordinateService, coordinateService } from '@xingm/vmap-cesium-toolbar';

const wgs84 = coordinateService.toWGS84(
  { longitude: 116.404, latitude: 39.915 },
  'GCJ02',
);

const bd09 = coordinateService.fromWGS84(wgs84, 'BD09');
const converted = coordinateService.transform(wgs84, 'WGS84', 'GCJ02');

const geometry = coordinateService.transformGeometry(
  [[{ longitude: 116.4, latitude: 39.9 }]],
  'WGS84',
  'BD09',
);
```

| 方法 | 说明 |
| --- | --- |
| `toWGS84(point, source?)` | 将指定坐标转换为 WGS84 |
| `fromWGS84(point, target?)` | 将 WGS84 转换为目标坐标 |
| `transform(point, source, target)` | 在任意受支持坐标系间转换 |
| `transformGeometry(value, source, target)` | 递归转换数组或经纬度对象 |

`LngLat` 使用 `{ longitude, latitude, height? }` 结构。转换是前端数学转换，境外坐标按转换实现的边界规则处理。
