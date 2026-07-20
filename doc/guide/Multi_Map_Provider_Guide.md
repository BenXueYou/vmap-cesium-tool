---
title: 多厂商地图接入
---

# 多厂商地图接入

组件通过 `baseMap` 描述底图，通过 `mapAuth` 集中管理鉴权。目前支持天地图、高德、腾讯、百度、Google，以及自定义在线/离线瓦片。

> 请通过环境变量或业务配置中心注入密钥，不要把真实密钥提交到仓库或打进前端公开包。

## 快速接入

```ts
import { initCesium } from '@xingm/vmap-cesium-toolbar';

const { viewer, mapPlugin } = await initCesium('cesiumContainer', {
  baseMap: {
    provider: 'tdt',
    type: 'img',
    showLabel: true,
  },
  mapAuth: {
    tdt: { token: import.meta.env.VITE_TDT_TOKEN },
  },
  mapCenter: {
    longitude: 120.15,
    latitude: 30.24,
    height: 5000,
  },
});
```

新架构也可直接使用 `createMapPlugin`：

```ts
import { createMapPlugin } from '@xingm/vmap-cesium-toolbar';

const plugin = createMapPlugin('cesiumContainer', {
  baseMap: { provider: 'gaode', type: 'satellite', showLabel: true },
  mapAuth: { gaode: { key: import.meta.env.VITE_GAODE_KEY } },
  camera: { center: [120.15, 30.24, 5000], coordSystem: 'WGS84' },
});

const viewer = await plugin.initialize();
```

## 厂商配置对照

| 厂商 | `provider` | 常用 `type` | 鉴权字段 | 坐标特性 |
| --- | --- | --- | --- | --- |
| 天地图 | `tdt` | `vec`、`img`、`ter`、`tdt3d` | `mapAuth.tdt.token/sk` | WGS84 |
| 高德 | `gaode` | `vector`、`satellite` | `mapAuth.gaode.key` | GCJ02 瓦片适配 |
| 腾讯 | `tencent` | `vector`、`satellite` | `mapAuth.tencent.key` | GCJ02 瓦片适配 |
| 百度 | `baidu` | `vector`、`satellite` | `mapAuth.baidu.ak` | BD09 瓦片适配 |
| Google | `google` | `roadmap`、`satellite` | `mapAuth.google.apiKey/mapId` | WGS84 |
| 自定义 | `custom` | `xyz`、`wmts`、`imageryProviders` | 由服务端决定 | 由数据源决定 |

厂商密钥也可写在 `baseMap.key/token/ak/sk` 中，但推荐统一放到 `mapAuth`，便于切换底图和更新凭据。

## 各厂商示例

```ts
// 天地图影像（含注记）
const tdt = {
  baseMap: { provider: 'tdt', type: 'img', showLabel: true },
  mapAuth: { tdt: { token: 'YOUR_TDT_TOKEN', sk: 'YOUR_TDT_SK' } },
};

// 高德矢量
const gaode = {
  baseMap: { provider: 'gaode', type: 'vector', showLabel: true },
  mapAuth: { gaode: { key: 'YOUR_GAODE_KEY' } },
};

// 腾讯影像
const tencent = {
  baseMap: { provider: 'tencent', type: 'satellite', showLabel: true },
  mapAuth: { tencent: { key: 'YOUR_TENCENT_KEY' } },
};

// 百度矢量
const baidu = {
  baseMap: { provider: 'baidu', type: 'vector', showLabel: true },
  mapAuth: { baidu: { ak: 'YOUR_BAIDU_AK' } },
};

// Google Map Tiles API
const google = {
  baseMap: { provider: 'google', type: 'satellite' },
  mapAuth: { google: { apiKey: 'YOUR_GOOGLE_API_KEY', mapId: 'YOUR_MAP_ID' } },
};
```

Google 接入需要在 Google Cloud 中启用 Map Tiles API。组件会在加载时创建 session，因此初始化和切换底图是异步过程。

## 自定义 XYZ 与 WMTS

```ts
// 在线或本地 XYZ
await initCesium('cesiumContainer', {
  baseMap: {
    provider: 'custom',
    type: 'xyz',
    mode: 'online',
    urlTemplate: 'https://tiles.example.com/{z}/{x}/{y}.png',
    minimumLevel: 0,
    maximumLevel: 18,
    credit: 'Example Maps',
  },
});

// WMTS
await initCesium('cesiumContainer', {
  baseMap: {
    provider: 'custom',
    type: 'wmts',
    customUrl: 'https://example.com/wmts',
    wmtsLayer: 'base',
    wmtsStyle: 'default',
    wmtsFormat: 'image/png',
    tileMatrixSetId: 'EPSG:4326',
  },
});
```

已有 Cesium Provider 可直接传入：

```ts
baseMap: {
  provider: 'custom',
  type: 'imageryProviders',
  providers: [myImageryProvider],
}
```

## 离线地图与相机范围

离线模式可限制可视范围和缩放距离；离线时组件会隐藏依赖在线能力的搜索、图层按钮。

```ts
await initCesium('cesiumContainer', {
  baseMap: {
    provider: 'custom',
    type: 'xyz',
    mode: 'offline',
    urlTemplate: '/tiles/{z}/{x}/{y}.png',
    rectangle: { west: 118, south: 29, east: 123, north: 33 },
    minimumLevel: 0,
    maximumLevel: 18,
    cameraBounds: {
      enabled: true,
      clamp: true,
      enableTilt: false,
      minimumZoomDistance: 50,
      maximumZoomDistance: 1_000_000,
      initialFlyTo: true,
      initialHeight: 200_000,
    },
  },
});
```

## 运行时切换

```ts
plugin.updateBaseMap({
  provider: 'tencent',
  type: 'vector',
  showLabel: true,
});

plugin.updateMapAuth({
  tencent: { key: 'NEW_TENCENT_KEY' },
});
```

单一当前服务商的配置中心建议使用 `setMapAuth` 替换全部鉴权，避免保留上一厂商凭据：

```ts
plugin.setMapAuth({ baidu: { ak: 'NEW_BAIDU_AK' } });
```

## 内置多厂商搜索

内置搜索默认关闭，且业务传入的 `services.toolbar.callbacks.onSearch` 始终优先。显式启用后，组件会根据当前 `baseMap.provider` 请求对应厂商，并将高德/腾讯 GCJ02、百度 BD09 结果统一转换为 WGS84。

```ts
createMapPlugin('cesiumContainer', {
  baseMap: { provider: 'tencent', type: 'vector' },
  mapAuth: { tencent: { key: 'YOUR_KEY' } },
  providerSearch: {
    enabled: true,
    endpoints: {
      // 代理地址由业务部署环境注入，组件不会写死项目路径
      tencent: '/tencent-map-api/ws/place/v1/search',
      baidu: '/baidu-map-api/place/v2/search',
    },
  },
  services: { toolbar: { enabled: true } },
});
```

也可以注入统一请求函数，将请求交给业务后端：

```ts
providerSearch: {
  enabled: true,
  request: (provider, url, init) => authorizedFetch(url, init),
}
```

高德开启数字签名时传入 `securityKey`。组件仅在运行时计算签名，不持久化密钥：

```ts
mapAuth: {
  gaode: { key: 'YOUR_KEY', securityKey: 'YOUR_SECURITY_KEY' },
}
```

## Credit / 版权区域

组件默认显示 Cesium 和地图厂商 credit。仅在确认符合相关授权要求后显式关闭：

```ts
credits: { visible: false }
```

运行时可调用：

```ts
plugin.updateCredits({ visible: true });
```

工具栏图层菜单使用的 ID 为：天地图直接使用 `vec/img/ter/tdt3d`，其他厂商使用 `gaode-vector`、`tencent-satellite`、`baidu-vector`、`google-roadmap` 等 `{provider}-{type}` 格式。

## 坐标约定

业务输入和输出默认都是 `WGS84`。输入属于高德/腾讯坐标或百度坐标时，需要显式声明：

```ts
plugin.updateCamera({
  center: [116.404, 39.915, 3000],
  coordSystem: 'GCJ02',
});

overlayService.addMarker([116.404, 39.915], {
  coordSystem: 'GCJ02',
});
```

更多转换和标绘输出方式见 [多厂商与坐标 API](/api/MapProvider_API) 和 [MarkService / CesiumMapMark API](/api/MarkService_API)。

## 旧配置迁移

旧版 `layers.type/tdt/gaode/baidu/custom` 仍兼容。新项目建议改用 `baseMap + mapAuth`，它能够覆盖腾讯、Google、离线范围和统一鉴权等新增能力。
