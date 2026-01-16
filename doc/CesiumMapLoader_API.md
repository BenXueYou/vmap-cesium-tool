# CesiumMapLoader API 文档

## 概述

该模块实际导出 3 个 API：

- `initCesium`：创建 `Cesium.Viewer` 并完成基础场景/图层初始化
- `setCameraView`：设置相机到指定中心点（无动画）
- `setCameraFlyTo`：相机飞行到指定中心点（带动画）

源码位于 `src/libs/CesiumMapLoader.ts`。

## 1. initCesium

```ts
async function initCesium(
  containerId: string,
  options: InitOptions,
  mapCenterOrCesiumToken?: MapCenter | string,
  cesiumToken?: string
): Promise<{ viewer: Cesium.Viewer; initialCenter: MapCenter }>
```

### 参数

- `containerId`：Cesium 容器元素 id
- `options`：初始化选项（见下方 `InitOptions`）
- `mapCenterOrCesiumToken`：
  - 传 `MapCenter`：覆盖初始视角中心点
  - 传 `string`：作为 Cesium Ion token（兼容旧调用方式）
- `cesiumToken`：Cesium Ion token 的备用入参（当第二个参数未传 token 时生效）

### Token 解析优先级

`Ion.defaultAccessToken` 的取值优先级如下：

1. `options.cesiumToken`
2. `mapCenterOrCesiumToken` 为 `string` 时
3. `cesiumToken`
4. `import.meta.env.VITE_CESIUM_TOKEN`

### 返回值

- `viewer`：创建好的 `Cesium.Viewer`
- `initialCenter`：最终使用的初始中心点（合并默认值/入参后的结果）

### 行为说明（基于当前实现）

- 默认禁用一批 Cesium 内置 UI（`timeline/animation/geocoder/homeButton` 等），并隐藏 credit。
- 当 **未传 `options.terrain` 且未传 `options.terrainProvider`** 时，会自动使用 `createWorldTerrainAsync()`。
- 当 `options.mapType === 'tiandi'` 时，会清空影像图层并使用 `TDTMapTypes` 中 `imagery` 的 provider 叠加天地图影像（需要天地图 token）。
- 初始视角：
  - `options.isFly !== true`：调用 `setCameraView` 直接 setView
  - `options.isFly === true`：调用 `setCameraFlyTo` 进行飞行

## 2. setCameraView

```ts
function setCameraView(viewer: Cesium.Viewer, center: MapCenter): void
```

将相机设置到指定经纬度与高度；`heading/pitch` 以角度制传入（内部会 `toRadians`）。

## 3. setCameraFlyTo

```ts
function setCameraFlyTo(viewer: Cesium.Viewer, center: MapCenter, options: InitOptions): void
```

通过 `viewer.camera.flyTo` 飞行到指定中心点。

- `options.flyDuration`：飞行时长（秒），默认 3
- `options.success`：飞行完成回调
- `options.cancel`：飞行取消回调

## 类型定义

### MapCenter

```ts
interface MapCenter {
  longitude: number;
  latitude: number;
  height: number;
  pitch?: number;
  heading?: number;
}
```

### InitOptions（节选）

`InitOptions` 基本是 `Cesium.Viewer.ConstructorOptions` 的超集，并补充了：

```ts
interface InitOptions {
  mapType?: string;        // 当前实现仅对 'tiandi' 做了内置处理
  token?: string;          // 天地图 token（默认从环境读取）
  cesiumToken?: string;    // Cesium Ion token

  mapCenter?: MapCenter;
  isFly?: boolean;
  flyDuration?: number;
  success?: () => void;
  cancel?: () => void;

  terrain?: Cesium.Terrain;
  terrainProvider?: Cesium.TerrainProvider;
  depthTestAgainstTerrain?: boolean;
  fxaa?: boolean;
}
```

## 使用示例

```ts
import * as Cesium from 'cesium';
import { initCesium } from '@xingm/vmap-cesium-toolbar';

const { viewer } = await initCesium('cesiumContainer', {
  cesiumToken: 'your_cesium_ion_token',
  mapType: 'tiandi',
  token: 'your_tianditu_token',
  isFly: true,
  flyDuration: 2,
  mapCenter: {
    longitude: 116.3974,
    latitude: 39.9093,
    height: 1200,
    pitch: -45,
    heading: 0,
  },
});
```

## 错误处理示例

```ts
try {
  const { viewer } = await initCesium('cesiumContainer', {
    cesiumToken: 'your_cesium_ion_token',
  });
  console.log('地图初始化成功', viewer);
} catch (error) {
  console.error('地图初始化失败:', error);
}
```

## 注意事项

1. **容器 id**：`containerId` 对应 DOM 必须存在。
2. **Cesium Token**：使用世界地形（Ion）等资源时需要有效的 Cesium Ion Token。
3. **天地图 Token**：当 `options.mapType === 'tiandi'` 时，需要传 `options.token`（天地图 token）。
4. **内存管理**：不再使用时调用 `viewer.destroy()` 释放 WebGL 资源。
