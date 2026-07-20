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

### `updateBaseMap(baseMap)`

合并底图配置，并在组件内部触发影像、地形、注记和离线约束刷新。方法返回 `void`。

```ts
plugin.updateBaseMap({ provider: 'gaode', type: 'satellite' });
```

### `updateMapAuth(mapAuth)`

合并鉴权配置，并在组件内部刷新当前底图。方法返回 `void`。

```ts
plugin.updateMapAuth({ gaode: { key: 'YOUR_KEY' } });
```

### `setMapAuth(mapAuth)`

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
