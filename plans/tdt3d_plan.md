# 天地图三维图层对接方案

## 1. 目标

在当前插件 `src/core/layers` 已支持天地图二维矢量、影像、地形底图的基础上，新增一个可在底图面板中切换的“天地图三维地图”类型。该类型不是单一影像瓦片，而是一组联动能力：

1. 影像底图：`img_w`
2. 国界叠加：`ibo_w`
3. 三维地形：`mapservice/swdx?T=elv_c`
4. 三维路网注记：`GeoWTFS + GetTiles/GetIcon`
5. 视图模式：自动切换到 Cesium `SCENE3D`

最终效果应与 `examples/demo-108.html`、`examples/demo-122.html` 中的天地图三维服务接入方式保持一致，同时兼容当前插件的 `MapPlugin`、工具栏图层面板和现有底图切换逻辑。

## 2. 现状分析

当前仓库中与天地图图层相关的核心代码如下：

1. `src/core/layers/TDTMapLayer.ts`
2. `src/core/MapPlugin.ts`
3. `src/core/types.ts`
4. `src/core/services/toolbar/config.ts`
5. `src/adapters/MapLoaderAdapter.ts`

现状特点：

1. `TDTMapLayer` 当前只支持 `vec`、`img`、`ter` 三种二维底图。
2. `MapPlugin.addTDTLayers()` 当前只处理 `ImageryProvider`，未真正消费 `terrainProvider`。
3. `MapType` 类型已预留 `terrainProvider` 和 `geoWTFS` 扩展点，说明现有架构已经具备接入三维底图的基础。
4. `MapPlugin` 已存在 `syncGeoWTFS()`、`destroyGeoWTFS()` 生命周期逻辑，但默认底图未配置 `geoWTFS` 工厂。
5. 当前“2D/3D”按钮仅控制 `scene.morphTo2D/3D`，并不等同于“切换到三维地图底图”。

结论：

当前项目不需要另起一套新的图层架构，最合理的方式是扩展现有 `MapType` 和 `TDTLayerConfig`，新增 `tdt3d` 底图类型，并将影像、地形、三维路网三部分统一纳入该类型的资源描述中。

## 3. 参考示例提炼出的真实接法

### 3.1 三维影像底图

参考 `examples/demo-108.html` 和 `examples/demo-122.html`，三维底图的主影像使用：

```text
https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk={token}
```

并叠加国界图层：

```text
https://t{s}.tianditu.gov.cn/DataServer?T=ibo_w&x={x}&y={y}&l={z}&tk={token}
```

因此，三维地图不建议直接复用当前二维模式中的 `img + cia`，而应单独定义为：

1. 主底图：`img_w`
2. 辅助叠加：`ibo_w`

### 3.2 三维地形服务

参考示例，天地图三维地形使用：

```text
https://t{s}.tianditu.gov.cn/mapservice/swdx?T=elv_c&tk={token}
```

使用方式为：

```js
const urls = subdomains.map(
	s => `https://t${s}.tianditu.gov.cn/mapservice/swdx?T=elv_c&tk=${token}`
)

const provider = new Cesium.GeoTerrainProvider({ urls })
viewer.terrainProvider = provider
```

这说明天地图三维地形并不是普通的 `ImageryProvider`，而是一个独立的 `TerrainProvider`。

### 3.3 三维路网服务

示例中的三维路网通过 `Cesium.GeoWTFS` 实现，关键服务为：

```text
https://t{s}.tianditu.gov.cn/mapservice/GetTiles?lxys={z},{x},{y}&VERSION=1.0.0&tk={token}
https://t{s}.tianditu.gov.cn/mapservice/GetIcon?id={id}&tk={token}
```

这说明仓库中已有的 `geoWTFS` 扩展点是天地图三维地图的重要组成部分，不应作为附加能力忽略。

## 4. 关键前置依赖

### 4.1 必须依赖天地图扩展脚本

这里的核心约束是：

1. `Cesium.GeoTerrainProvider`
2. `Cesium.GeoWTFS`

都不是标准 `cesium` npm 包原生导出的通用 API，而是由天地图扩展脚本注入到 `Cesium` 全局对象中的能力。

仓库中已存在一个可复用的本地脚本：

1. `examples/vue3-usage/public/static/cesiumTdt.js`

该脚本内部已经包含 `GeoTerrainProvider` 和 `GeoWTFS` 的实现，因此正式接入方案应优先考虑：

1. 宿主项目显式加载 `cesiumTdt.js`
2. 插件运行时检测相关能力是否存在
3. 若不存在则降级或禁用“三维地图”卡片

### 4.2 运行时能力检查

建议新增运行时检查工具，用于在切换到 `tdt3d` 前进行保护：

```ts
export function hasTDT3DExtension(CesiumNS: typeof Cesium): boolean {
	return typeof (CesiumNS as any).GeoTerrainProvider === 'function'
		&& typeof (CesiumNS as any).GeoWTFS === 'function'
}
```

如果能力不存在，建议行为：

1. 控制台输出警告
2. 工具栏中隐藏“三维地图”项，或将其禁用
3. 不直接调用 `new Cesium.GeoTerrainProvider(...)`

否则运行时会直接报错。

## 5. 推荐的数据模型设计

### 5.1 扩展天地图底图类型

修改 `src/core/types.ts` 中的 `TDTLayerConfig.mapTypeId`，将当前类型：

```ts
'vec' | 'img' | 'ter'
```

扩展为：

```ts
'vec' | 'img' | 'ter' | 'tdt3d'
```

兼容层 `src/adapters/MapLoaderAdapter.ts` 中所有相关断言也需要同步扩展。

### 5.2 三维地图语义定义

建议将 `tdt3d` 的语义定义为：

1. 自动启用三维影像底图
2. 自动启用天地图三维地形
3. 自动启用三维路网注记
4. 自动切换到 `SCENE3D`

这意味着 `tdt3d` 不是“第三种影像图层”，而是一个复合场景类型。

## 6. 建议的代码改造方案

### 6.1 `src/core/layers/TDTMapLayer.ts`

该文件中建议新增以下工厂函数：

1. `createTDT3DImageryConfig(token: string): Cesium.ImageryProvider[]`
2. `createTDT3DTerrainProvider(token: string): Cesium.TerrainProvider | null`
3. `createTDT3DGeoWTFS(token: string, viewer: Cesium.Viewer): any | null`

#### 6.1.1 `createTDT3DImageryConfig`

返回以下两个图层：

1. `img_w` 影像底图
2. `ibo_w` 国界叠加

建议使用 `Cesium.UrlTemplateImageryProvider`，参考实现思路：

```ts
new Cesium.UrlTemplateImageryProvider({
	url: `https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${token}`,
	subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
	tilingScheme: new Cesium.WebMercatorTilingScheme(),
	maximumLevel: 18,
	enablePickFeatures: false,
})
```

以及：

```ts
new Cesium.UrlTemplateImageryProvider({
	url: `https://t{s}.tianditu.gov.cn/DataServer?T=ibo_w&x={x}&y={y}&l={z}&tk=${token}`,
	subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
	tilingScheme: new Cesium.WebMercatorTilingScheme(),
	maximumLevel: 10,
	enablePickFeatures: false,
})
```

#### 6.1.2 `createTDT3DTerrainProvider`

使用示例中的 `elv_c` 地形地址，拼装 `urls` 数组后返回：

```ts
new (Cesium as any).GeoTerrainProvider({ urls })
```

调用前必须做运行时检查。

#### 6.1.3 `createTDT3DGeoWTFS`

按 `demo-108.html` / `demo-122.html` 的参数封装 `GeoWTFS` 创建逻辑，包括：

1. `viewer`
2. `subdomains`
3. `metadata`
4. `aotuCollide`
5. `collisionPadding`
6. `serverFirstStyle`
7. `labelGraphics`
8. `billboardGraphics`
9. `getTileUrl`
10. `getIcoUrl`
11. `initTDT(...)`

其中 `initTDT(...)` 的 level=2 中国范围初始块数据建议提取为常量，例如：

1. `TDT_3D_INIT_TILES`

不要直接把大段 JSON 硬塞进业务函数中。

### 6.2 `src/core/types.ts`

需要改动的点：

1. 扩展 `TDTLayerConfig.mapTypeId`
2. 若项目中存在与 `mapTypeId` 相关的联合类型，全部补充 `tdt3d`
3. 确保 `MapType` 继续保留 `terrainProvider` 和 `geoWTFS` 字段

### 6.3 `src/adapters/MapLoaderAdapter.ts`

兼容旧入口时，如果传入 `tdtMapTypeId: 'tdt3d'`，应能正确透传到新配置模型中。

当前类似如下断言：

```ts
mapTypeId: (options.tdtMapTypeId as 'vec' | 'img' | 'ter' | undefined) || 'img'
```

应扩展为支持 `'tdt3d'`。

### 6.4 `src/core/services/toolbar/config.ts`

在 `DEFAULT_MAP_TYPES` 中新增一个“三维地图”卡片。

建议配置结构：

```ts
{
	id: 'tdt3d',
	name: '三维地图',
	thumbnail: threeDThumbnail,
	provider: (token) => createTDT3DImageryConfig(token),
	terrainProvider: (token) => createTDT3DTerrainProvider(token),
	geoWTFS: (token, viewer) => createTDT3DGeoWTFS(token, viewer),
	forcePlaceName: true,
}
```

说明：

1. `forcePlaceName: true` 可以保证三维路网在该模式下默认启用。
2. 如果运行时没有加载三维扩展，可在生成 `DEFAULT_MAP_TYPES` 时过滤该项，或在点击时给出警告。

### 6.5 `src/core/MapPlugin.ts`

这是本次改造的核心文件，必须补齐 `terrainProvider` 的真实消费逻辑。

当前 `addTDTLayers()` 只会添加 `ImageryProvider`，需要升级为同时处理：

1. 影像底图
2. 地形提供者
3. 三维场景模式
4. `geoWTFS` 生命周期

建议在 `MapPlugin` 中增加统一的资源应用方法，例如：

```ts
private applyMapTypeResources(mapType: MapType): void
```

推荐行为：

1. 清空当前影像层
2. 添加 `mapType.provider(token)` 返回的所有影像图层
3. 如果 `mapType.terrainProvider` 存在，则设置 `viewer.terrainProvider`
4. 如果 `mapType.terrainProvider` 不存在，则回退为 `new Cesium.EllipsoidTerrainProvider()`
5. 如果当前类型为 `tdt3d`，且场景不是 3D，则自动调用 `viewer.scene.morphTo3D(0)`
6. 调用 `syncGeoWTFS()`，根据当前 `MapType.geoWTFS` 决定是否创建三维路网实例

### 6.6 退出三维地图时的恢复逻辑

从 `tdt3d` 切换回 `vec`、`img`、`ter` 时，必须做恢复：

1. 销毁当前 `GeoWTFS`
2. 清理或重置 `viewer.terrainProvider`
3. 恢复二维底图的普通影像加载逻辑

否则会出现以下问题：

1. 三维地形残留在二维底图模式中
2. 三维路网未销毁，造成重复叠加或内存泄漏

## 7. 交互语义建议

建议明确区分两个概念：

### 7.1 `view2d3d` 按钮

职责仅为：

1. 2D / 3D 视角切换
2. 不改变当前底图类型

### 7.2 `tdt3d` 地图卡片

职责为：

1. 切换到天地图三维底图模式
2. 自动切换到三维场景
3. 自动启用地形与三维路网

这样可以避免用户混淆“当前是 3D 视图”与“当前使用的是三维底图模式”这两个概念。

## 8. 推荐的实施顺序

建议按以下顺序实施，风险最低：

1. 增加运行时三维扩展检查能力
2. 扩展 `types.ts` 中的 `tdt3d` 类型定义
3. 在 `TDTMapLayer.ts` 中封装三维影像、地形、路网工厂
4. 在 `MapPlugin.ts` 中补齐 `terrainProvider` 和 `geoWTFS` 的资源应用逻辑
5. 在 `toolbar/config.ts` 中新增“三维地图”卡片
6. 在 `MapLoaderAdapter.ts` 中补齐兼容入口
7. 最后补充示例和文档

## 9. 风险与注意事项

### 9.1 不能把 `ter` 直接当成三维地图

当前 `ter` 的语义是“地形晕渲图层”，仍然属于二维影像底图，不等价于真正的三维地形服务。

因此必须新增 `tdt3d`，不要复用或篡改 `ter` 的既有语义。

### 9.2 不能假设所有宿主都已加载扩展脚本

因为三维能力依赖扩展脚本，插件必须具备检测与降级逻辑。

### 9.3 示例中的初始化方式不能原样照搬

`demo-108.html` 使用了天地图扩展版的 `Cesium.Map`，而当前项目使用标准 `Cesium.Viewer`。因此：

1. 服务地址和 provider 接法可以复用
2. 初始化入口不能原样复制

### 9.4 代码中已有双配置源问题

当前天地图 URL 同时分散在：

1. `src/core/layers/TDTMapLayer.ts`
2. `src/core/services/toolbar/config.ts`

本次如果仅做快速接入，可以先两边都补齐。

但更优方案是后续抽象为统一注册表，例如：

1. `TDT_MAP_TYPE_REGISTRY`

让图层工厂、`MapPlugin` 和工具栏卡片统一消费一份配置，避免未来维护时改漏。

## 10. 最终推荐方案摘要

最终推荐的可落地方案如下：

1. 新增 `tdt3d` 作为天地图子类型。
2. 三维地图底图组合使用 `img_w + ibo_w`。
3. 三维地形通过 `GeoTerrainProvider + elv_c` 接入。
4. 三维路网通过 `GeoWTFS + GetTiles/GetIcon` 接入。
5. 切换到 `tdt3d` 时自动切到 `SCENE3D`。
6. 切换离开 `tdt3d` 时销毁三维路网并恢复普通地形提供者。
7. 运行时检查 `GeoTerrainProvider` 和 `GeoWTFS` 是否存在，避免未加载扩展时直接报错。
8. 保持 `view2d3d` 按钮与底图类型切换职责分离。

该方案与现有插件架构兼容度高，改造范围可控，并且与 `examples/demo-108.html`、`examples/demo-122.html` 的天地图三维服务接入方式一致。
