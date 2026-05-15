# 天地图三维影像与地形接入方案

> 本文档基于 `vmap-cesium-tool` 中现有实现，梳理天地图三维（`tdt3d`）影像、地形、路网注记的完整接入链路，可直接迁移到其他 Cesium 项目中使用。

---

## 一、方案总览

天地图三维模式由以下三层能力组合而成：

| 层级 | 数据来源 | 实现方式 |
|------|---------|---------|
| 三维影像底图 | 天地图 WMTS（`img_w`） | `WebMapTileServiceImageryProvider` |
| 三维影像注记 | 天地图 WMTS（`cia_w`） | `WebMapTileServiceImageryProvider` |
| 三维地形高程 | 天地图 `mapservice/swdx` | `tdt-terrain-cesium-plugin` → `GeoTerrainProvider` |
| 三维路网注记（可选）| 天地图 `mapservice/GetTiles` | `tdt-terrain-cesium-plugin` → `GeoWTFS` |

- 影像和注记：标准 WMTS，无需额外插件，直接用 Cesium 内置 Provider 加载。
- 地形和路网：依赖 `tdt-terrain-cesium-plugin`，支持自动懒加载或显式注入，插件不可用时自动降级为仅影像模式。

---

## 二、依赖安装

```bash
# npm
npm install tdt-terrain-cesium-plugin

# pnpm
pnpm add tdt-terrain-cesium-plugin

# 或从 GitHub 直接安装
npm install github:BenXueYou/tdt-terrain-cesium-plugin
```

TypeScript 项目还需要增加模块声明（例如在 `src/models.d.ts`）：

```ts
declare module 'tdt-terrain-cesium-plugin' {
  const value: any;
  export default value;
}
```

---

## 三、推荐文件结构

```
src/
  tdt/
    tdtPlugin.ts        # 插件加载、能力检测
    tdtProviders.ts     # 影像 / 地形 / GeoWTFS 工厂函数
    tdtController.ts    # 图层切换、2D3D 状态同步、生命周期管理
```

UI 层只需传入 `token`、`sk`（可选）、`mapTypeId`、`showLabel`，与底层实现解耦。

---

## 四、核心实现代码

### 4.1 插件管理器（`tdtPlugin.ts`）

```ts
import * as Cesium from 'cesium';

// ---- 类型定义 ----
type TDTPluginModule = {
  GeoTerrainProvider?: new (options: {
    url: string;
    subdomains?: string[];
    token?: string;
  }) => Cesium.TerrainProvider;
  GeoWTFS?: new (viewer: Cesium.Viewer, options: Record<string, unknown>) => any;
};

type TDTPluginImport = TDTPluginModule & { default?: TDTPluginModule };

// ---- 模块级单例 ----
let TDT_PLUGIN: TDTPluginModule | null = null;
let tdtPluginLoadPromise: Promise<TDTPluginModule | null> | null = null;

// ---- 能力检测 ----
export const isTDTPluginReady = (plugin: TDTPluginModule | null): boolean => {
  return plugin !== null
    && typeof plugin.GeoTerrainProvider === 'function'
    && typeof plugin.GeoWTFS === 'function';
};

// ---- UMD / default export 兼容处理 ----
const normalizeTDTPlugin = (plugin: unknown): TDTPluginModule | null => {
  const m = plugin as TDTPluginImport;
  return m?.default || m || null;
};

/**
 * 显式注入插件（适用于 UMD 全局变量、微前端、CDN 引入等场景）
 * 在应用入口调用一次即可，之后所有工厂函数可直接使用。
 *
 * @example
 * import Tdt3dPlug from 'tdt-terrain-cesium-plugin';
 * setTDTPlugin(Tdt3dPlug);
 */
export function setTDTPlugin(plugin: unknown): void {
  TDT_PLUGIN = normalizeTDTPlugin(plugin);
  if (isTDTPluginReady(TDT_PLUGIN)) {
    console.debug('天地图插件已设置');
  }
}

/**
 * 确保插件已加载（懒加载 + 单例 Promise，防止并发重复 import）
 * 返回 true 表示插件可用，false 表示不可用（仅影像模式）。
 */
export async function ensureTDT3DExtensionLoaded(): Promise<boolean> {
  if (isTDTPluginReady(TDT_PLUGIN)) return true;

  if (!tdtPluginLoadPromise) {
    tdtPluginLoadPromise = import('tdt-terrain-cesium-plugin')
      .then((mod) => {
        const plugin = normalizeTDTPlugin(mod);
        TDT_PLUGIN = plugin;
        console.debug('成功加载 tdt-terrain-cesium-plugin');
        return plugin;
      })
      .catch((e) => {
        console.debug('未找到 tdt-terrain-cesium-plugin，天地图三维功能将不可用', e);
        return null;
      })
      .finally(() => {
        tdtPluginLoadPromise = null;
      });
  }

  TDT_PLUGIN = await tdtPluginLoadPromise;
  return isTDTPluginReady(TDT_PLUGIN);
}

export function getTDTPlugin(): TDTPluginModule | null {
  return TDT_PLUGIN;
}
```

### 4.2 Provider 工厂（`tdtProviders.ts`）

```ts
import * as Cesium from 'cesium';
import { isTDTPluginReady, getTDTPlugin } from './tdtPlugin';

const TDT_SUBDOMAINS = ['0', '1', '2', '3', '4', '5', '6', '7'];
const TDT_BASE_URL = 'https://t{s}.tianditu.gov.cn/';

// ---- 公共工具 ----

/** 拼接天地图鉴权参数（tk / sk） */
const buildTDTAuthParams = (token: string, sk?: string, includeSk = true): string => {
  const params: string[] = [];
  if (token?.trim()) params.push(`tk=${encodeURIComponent(token)}`);
  if (includeSk && sk?.trim()) params.push(`sk=${encodeURIComponent(sk)}`);
  return params.length > 0 ? `&${params.join('&')}` : '';
};

/** 校验 token，无效时打印告警并返回 false */
const hasValidToken = (token: string): boolean => {
  const ok = !!token && token.trim().length > 0;
  if (!ok) console.warn('天地图 token 未提供，图层可能无法正常加载');
  return ok;
};

// ---- 影像图层 ----

/**
 * 创建三维影像图层 Provider 数组（WMTS 影像底图 + 注记）
 * 该 Provider 不依赖插件，任何模式下均可使用。
 */
export const createTDT3DImageryProviders = (
  token: string,
  sk?: string,
): Cesium.ImageryProvider[] => {
  if (!hasValidToken(token)) return [];
  const auth = buildTDTAuthParams(token, sk);

  return [
    // 影像底图
    new Cesium.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}${auth}`,
      layer: 'img',
      style: 'default',
      format: 'tiles',
      subdomains: TDT_SUBDOMAINS,
      tileMatrixSetID: 'GoogleMapsCompatible',
      minimumLevel: 1,
      maximumLevel: 18,
      credit: '© 天地图',
    }),
    // 影像注记
    new Cesium.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}${auth}`,
      layer: 'cia',
      style: 'default',
      format: 'tiles',
      subdomains: TDT_SUBDOMAINS,
      tileMatrixSetID: 'GoogleMapsCompatible',
      minimumLevel: 1,
      maximumLevel: 18,
      credit: '© 天地图',
    }),
  ];
};

// ---- 三维地形 ----

/**
 * 创建天地图三维地形 Provider（依赖 tdt-terrain-cesium-plugin）
 * 调用前请先执行 ensureTDT3DExtensionLoaded()。
 * 插件不可用时返回 null，调用方应回退到 EllipsoidTerrainProvider。
 */
export const createTDT3DTerrainProvider = (
  token: string,
  sk?: string,
): Cesium.TerrainProvider | null => {
  if (!hasValidToken(token)) return null;

  const plugin = getTDTPlugin();
  if (!isTDTPluginReady(plugin)) {
    console.warn('未检测到 tdt-terrain-cesium-plugin，tdt3d 模式将只加载影像底图。');
    return null;
  }

  return new plugin!.GeoTerrainProvider!({
    url: `${TDT_BASE_URL}mapservice/swdx?T=elv_c&x={x}&y={y}&l={z}${buildTDTAuthParams(token, sk)}`,
    subdomains: TDT_SUBDOMAINS,
    token,
  });
};

// ---- 三维路网注记（GeoWTFS） ----

/**
 * 创建天地图三维路网注记实例（依赖 tdt-terrain-cesium-plugin）
 * 调用前请先执行 ensureTDT3DExtensionLoaded()。
 * 调用方需持有返回实例，并在图层切换或组件销毁时调用 destroy()/remove()。
 */
export const createTDT3DGeoWTFS = (
  token: string,
  viewer: Cesium.Viewer,
  sk?: string,
): any | null => {
  if (!hasValidToken(token)) return null;

  const plugin = getTDTPlugin();
  if (!isTDTPluginReady(plugin)) {
    console.warn('未检测到 tdt-terrain-cesium-plugin，三维路网注记不可用。');
    return null;
  }

  const wtfs = new plugin!.GeoWTFS!(viewer, {
    url: `${TDT_BASE_URL}mapservice/GetTiles?lxys={z},{x},{y}&version=1.0.0${buildTDTAuthParams(token, sk)}`,
    icoUrl: `${TDT_BASE_URL}mapservice/GetIcon?id={id}&version=1.0.0${buildTDTAuthParams(token, sk)}`,
    subdomains: TDT_SUBDOMAINS,
    token,
  });
  wtfs.initTDT?.();
  return wtfs;
};
```

### 4.3 图层控制器（`tdtController.ts`）

```ts
import * as Cesium from 'cesium';
import { ensureTDT3DExtensionLoaded } from './tdtPlugin';
import {
  createTDT3DImageryProviders,
  createTDT3DTerrainProvider,
  createTDT3DGeoWTFS,
} from './tdtProviders';

export interface TDT3DLayerOptions {
  token: string;
  sk?: string;
  /** 是否显示路网注记，默认 true */
  showPlaceName?: boolean;
}

export class TDT3DLayerController {
  private viewer: Cesium.Viewer;
  private currentGeoWTFS: any = null;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
  }

  /**
   * 挂载天地图三维图层（影像 + 地形 + 可选路网注记）
   * 会自动确保场景进入 3D 模式。
   */
  async mount(options: TDT3DLayerOptions): Promise<void> {
    const { token, sk, showPlaceName = true } = options;

    // 1. 确保插件加载完成（失败不阻断，仅影像降级）
    await ensureTDT3DExtensionLoaded();

    // 2. 强制进入 3D 场景（0 = 立即切换，无动画）
    if (this.viewer.scene.mode !== Cesium.SceneMode.SCENE3D) {
      this.viewer.scene.morphTo3D(0);
    }

    // 3. 清空旧影像层，添加三维影像 + 注记
    this.viewer.imageryLayers.removeAll();
    const providers = createTDT3DImageryProviders(token, sk);
    providers.forEach((p) => this.viewer.imageryLayers.addImageryProvider(p));

    // 4. 挂载地形
    const terrainProvider = createTDT3DTerrainProvider(token, sk);
    this.viewer.terrainProvider = terrainProvider ?? new Cesium.EllipsoidTerrainProvider();

    // 5. 挂载路网注记（可选，仅 3D 模式下有效）
    this.destroyGeoWTFS();
    if (showPlaceName) {
      try {
        this.currentGeoWTFS = createTDT3DGeoWTFS(token, this.viewer, sk);
      } catch (e) {
        console.warn('创建三维路网注记失败:', e);
        this.currentGeoWTFS = null;
      }
    }
  }

  /**
   * 切换路网注记显示状态（无需重建地形和影像）
   */
  async setPlaceNameVisible(visible: boolean, token: string, sk?: string): Promise<void> {
    this.destroyGeoWTFS();
    if (visible && this.viewer.scene.mode === Cesium.SceneMode.SCENE3D) {
      try {
        this.currentGeoWTFS = createTDT3DGeoWTFS(token, this.viewer, sk);
      } catch (e) {
        console.warn('创建三维路网注记失败:', e);
      }
    }
  }

  /** 销毁当前 GeoWTFS 实例（兼容 destroy / remove 两种接口） */
  private destroyGeoWTFS(): void {
    if (!this.currentGeoWTFS) return;
    try {
      if (typeof this.currentGeoWTFS.destroy === 'function') {
        this.currentGeoWTFS.destroy();
      } else if (typeof this.currentGeoWTFS.remove === 'function') {
        this.currentGeoWTFS.remove();
      }
    } catch (e) {
      console.warn('销毁三维路网注记失败:', e);
    } finally {
      this.currentGeoWTFS = null;
    }
  }

  /** 完全卸载：清影像、还原地形、销毁 GeoWTFS */
  unmount(): void {
    this.destroyGeoWTFS();
    this.viewer.imageryLayers.removeAll();
    this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
  }

  dispose(): void {
    this.unmount();
  }
}
```

---

## 五、完整接入示例

### 5.1 Vue 3 组合式写法

```ts
// useMap.ts
import { onMounted, onUnmounted, ref } from 'vue';
import * as Cesium from 'cesium';
import { TDT3DLayerController } from './tdt/tdtController';
import { setTDTPlugin } from './tdt/tdtPlugin';

// 如果项目中插件是全局变量或通过 CDN 引入，可在入口显式注入：
// import Tdt3dPlug from 'tdt-terrain-cesium-plugin';
// setTDTPlugin(Tdt3dPlug);

export function useMap(containerId: string) {
  const viewer = ref<Cesium.Viewer | null>(null);
  let controller: TDT3DLayerController | null = null;

  onMounted(async () => {
    viewer.value = new Cesium.Viewer(containerId, {
      // 关闭默认地形，由控制器统一管理
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      imageryProvider: false as any,
      // 关闭默认 UI
      timeline: false,
      animation: false,
      geocoder: false,
      homeButton: false,
      navigationHelpButton: false,
      baseLayerPicker: false,
    });

    controller = new TDT3DLayerController(viewer.value);

    await controller.mount({
      token: '你的天地图 token',
      showPlaceName: true,
    });
  });

  onUnmounted(() => {
    controller?.dispose();
    viewer.value?.destroy();
  });

  return { viewer, controller };
}
```

### 5.2 纯 TypeScript 写法

```ts
import * as Cesium from 'cesium';
import { TDT3DLayerController } from './tdt/tdtController';

async function initMap() {
  const viewer = new Cesium.Viewer('map-container', {
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    imageryProvider: false as any,
    timeline: false,
    animation: false,
    geocoder: false,
    homeButton: false,
    navigationHelpButton: false,
    baseLayerPicker: false,
  });

  const controller = new TDT3DLayerController(viewer);

  await controller.mount({
    token: '你的天地图 token',
    showPlaceName: true,
  });

  // 关闭路网注记
  // await controller.setPlaceNameVisible(false, token);

  // 卸载三维图层
  // controller.unmount();
}
```

---

## 六、关键流程说明

### 图层切换时序

```
切换到 tdt3d
  │
  ├─ 1. await ensureTDT3DExtensionLoaded()
  │       ├─ 插件已加载 → 直接返回 true
  │       └─ 未加载 → import('tdt-terrain-cesium-plugin')
  │               ├─ 成功 → TDT_PLUGIN = plugin → true
  │               └─ 失败 → TDT_PLUGIN = null → false（降级）
  │
  ├─ 2. viewer.scene.mode !== SCENE3D → morphTo3D(0)
  │
  ├─ 3. 清空旧影像层 → 加载 img_w + cia_w
  │
  ├─ 4. 插件可用 → createTDT3DTerrainProvider → viewer.terrainProvider
  │       └─ 插件不可用 → EllipsoidTerrainProvider（降级）
  │
  └─ 5. showPlaceName && SCENE3D → createTDT3DGeoWTFS → currentGeoWTFS
```

### GeoWTFS 生命周期

```
切换图层 / 切换注记开关 / 切换 2D↔3D
  │
  └─ destroyGeoWTFS()     ← 先销毁旧实例（防内存泄漏）
       │  try: destroy() || remove()
       └─ currentGeoWTFS = null
            │
            └─ 满足条件（3D模式 && showPlaceName）
                 └─ createTDT3DGeoWTFS() → 新实例
```

---

## 七、常见问题与规避

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 地形不生效，地图变平 | 插件加载失败或 token 无效 | 检查 `ensureTDT3DExtensionLoaded()` 返回值和网络请求 |
| 2D 模式下三维效果消失 | Cesium 2D 模式不支持地形高程 | 切换 `tdt3d` 时强制 `morphTo3D(0)` |
| 切图层后路网注记重叠/堆叠 | GeoWTFS 未销毁就重新创建 | 每次重建前必须先调用 `destroyGeoWTFS()` |
| TS 报 `Cannot find module 'tdt-terrain-cesium-plugin'` | 缺少模块类型声明 | 在 `models.d.ts` 中添加 `declare module 'tdt-terrain-cesium-plugin'` |
| URL 中 `&&tk=...` 参数重复 | `buildTDTAuthParams` 未被调用 | 统一使用 `buildTDTAuthParams` 拼接鉴权参数 |
| `sk` 参数泄漏到日志 | 直接 console 输出了完整 URL | 日志中不要打印完整请求 URL |
| 插件并发加载竞争 | 多处同时 `import(...)` | 用 Promise 单例锁（`tdtPluginLoadPromise`）防并发 |

---

## 八、参数参考

### 天地图服务地址

| 用途 | URL 模板 |
|------|---------|
| 三维影像底图 | `https://t{s}.tianditu.gov.cn/img_w/wmts?...&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk={token}` |
| 三维影像注记 | `https://t{s}.tianditu.gov.cn/cia_w/wmts?...&tk={token}` |
| 三维地形高程 | `https://t{s}.tianditu.gov.cn/mapservice/swdx?T=elv_c&x={x}&y={y}&l={z}&tk={token}` |
| 三维路网注记 | `https://t{s}.tianditu.gov.cn/mapservice/GetTiles?lxys={z},{x},{y}&version=1.0.0&tk={token}` |
| 路网图标 | `https://t{s}.tianditu.gov.cn/mapservice/GetIcon?id={id}&version=1.0.0&tk={token}` |

### 子域名

```
['0', '1', '2', '3', '4', '5', '6', '7']
```

天地图支持 8 个子域名（`t0`~`t7`），Cesium 会自动按 `{s}` 占位符轮询负载均衡。

---

## 九、与本仓库的对应关系

| 本文内容 | 仓库源文件 |
|---------|-----------|
| 插件加载与能力检测 | `src/core/layers/TDTMapLayer.ts` L1–L80 |
| 三维影像 Provider | `src/core/layers/TDTMapLayer.ts` L218–L256 |
| 三维地形 Provider | `src/core/layers/TDTMapLayer.ts` L257–L274 |
| GeoWTFS 创建 | `src/core/layers/TDTMapLayer.ts` L275–L296 |
| 图层切换应用地形 | `src/core/MapPlugin.ts` L820–L840 |
| GeoWTFS 销毁/重建 | `src/core/MapPlugin.ts` L479–L530 |
| 插件原始用法 | `plugin/tdt-cesium-plugin/README.md` |
