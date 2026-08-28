# 百度 3D 城市地图接入当前 Toolbar/Cesium 方案：官方资料研究

访问日期：2026-08-27  
研究范围：百度地图开放平台 JS API GL、百度 Web 服务/坐标说明、Cesium 官方 API/3D Tiles 规范，以及当前仓库的 toolbar 与多厂商瓦片实现。本文只写接入判断和方案，不修改业务代码。

> 说明：百度公开页面当前将 JSAPI GL 标注为历史版本。新项目应先在百度控制台确认 JSAPI 4.0 或其他当前可用产品；本文引用 GL 文档是为了核对其公开的 3D 能力边界。

## 结论摘要

1. 百度官方所谓“3D 城市地图”属于 **JavaScript API GL（BMapGL）** 的 WebGL 地图能力。官方服务介绍称 JS API GL 利用 WebGL 实现地图和覆盖物的 3D 渲染，并支持 3D 视角；其“地图影像”能力列表包含 3D 城市地图。来源：[JSAPI GL 服务介绍](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/index)；[百度开放平台首页地图影像说明](https://lbsyun.baidu.com/index.php?title=jspopularGL/guide/3D)。
2. JS API GL 的官方示例通过加载 `https://api.map.baidu.com/api?v=1.0&type=webgl&ak=...` 创建 `BMapGL.Map`，再使用 `setTilt`、`setHeading`、`BMAP_EARTH_MAP` 等 API 控制 3D/地球视角。它是独立的百度渲染引擎，不是 Cesium `Cesium3DTileset` 数据源。百度当前页面将 JSAPI GL 标为历史版本并提示新项目关注新版 JSAPI，实施时应以控制台和新版文档的可用产品为准。来源：[展示地图](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/guide/show)；[变更地图类型](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/guide/maptype)；[Hello World/脚本加载](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/guide/helloworld)。
3. 在本次核查到的百度官方公开文档中，未发现“百度 3D 城市建筑”以 OGC 3D Tiles 服务、可直接传给 Cesium `Cesium3DTileset.fromUrl` 的公开标准端点。百度 JSAPI GL 文档公开的是地图渲染、3D 覆盖物（如 `Marker3D`、`Prism`）和 MVT 图层，而非 3D Tiles tileset。这个结论是对官方文档产品边界的核查结果，不代表百度不存在面向特定客户的私有/行业数据产品；商业授权和数据交付必须向百度确认。
4. 因此，当前项目的推荐接入是：**继续使用 Cesium 作为唯一 Viewer，在 toolbar 图层菜单中增加“百度矢量/百度影像”底图；3D 城市建筑使用自有/获授权的 3D Tiles、glTF 或其他 Cesium 原生数据。** 不能把“切换百度 3D 城市地图”误实现为替换一个 Cesium imagery provider。
5. 如果业务必须显示百度官方 3D 城市场景，只能把 BMapGL 作为独立渲染面（例如单独路由/弹窗/同页分栏或 iframe），通过消息传递同步中心点、缩放和选择状态；不应把百度 WebGL canvas 当作 Cesium imagery layer 叠加。双引擎会带来相机同步、输入事件、性能、版权展示和坐标转换成本。

## 百度官方能力与授权

### JS API GL 是独立 WebGL 地图引擎

百度文档将 JS API GL 描述为一套 JavaScript 接口，基于 WebGL 渲染地图与覆盖物，支持 3D 视角及地图展示、定位、覆盖物、检索和路线规划：[服务介绍](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/index)。官方“使用须知”示例要求在脚本 URL 中携带 `ak`，并指出该页面是历史版本、仅用于维护现有项目，新项目应核对新版 JSAPI：[使用须知](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/guide/usage)。

官方展示示例中的关键形态是 `BMapGL.Map` 和 `BMapGL.Point`，并通过 `map.centerAndZoom`、`map.enableScrollWheelZoom` 等方法操作地图：[展示地图](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/guide/show)。这意味着百度 3D 城市底图的相机、瓦片调度和 WebGL 上下文由 BMapGL 管理，Cesium 无法直接取得其建筑几何或内部 tile 请求。

### 3D 相关 API 是覆盖物/视角，不是 Cesium 3D Tiles

- `BMapGL.Marker3D` 用于“带有高度的点”，可自定义高度、大小、形状、颜色、透明度和纹理：[带高度的点](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/guide/Marker3d)。
- `Prism` 文档提供 3D 棱柱绘制：[3D 棱柱绘制](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/guide/Prism)。
- `MVTLayer` 用于加载 MVT 矢量瓦片并做个性化展示，示例 URL 包含百度项目 `ak`、`x/y/z` 和 `tileSize` 参数：[MVT 标准图层](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/guide/mvtLayer)。MVT 是矢量瓦片格式，不能据此推断存在可供 Cesium 直接渲染的建筑 3D Tiles tileset。

### AK、产品开通和安全

百度底图 JSAPI GL 与地点检索 Web 服务是不同产品面。JSAPI GL 需要应用 AK；地点检索应单独开通/校验 Place API：[获取 AK（百度开放平台入口）](https://lbsyun.baidu.com/index.php?title=jspopularGL/guide/getkey)；[坐标转换服务](https://lbsyun.baidu.com/index.php?title=webapi/guide/changeposition)；[地点检索服务](https://lbsyun.baidu.com/index.php?title=webapi/guide/webservice-placeapi)。生产环境应按百度控制台的应用类型、域名/IP 白名单和配额配置，AK 不应写死到可提交源码中；当前项目已有 `mapAuth.baidu.ak`/环境变量注入约定。

## 坐标系与瓦片兼容性

### 百度服务坐标是 BD09

百度官方坐标说明区分：WGS84（GPS 常用）、GCJ02（加密坐标）和 BD09（百度在 GCJ02 基础上的再次加密）；百度对外接口坐标为 BD09，包含 `bd09ll`（经纬度）和 `bd09mc`（百度墨卡托米制），非中国地区统一使用 WGS84。官方要求其他坐标先转换到百度坐标，并提示使用官方转换接口：[坐标转换说明](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/guide/coorinfo)。

当前仓库已具备相应适配：

- `src/core/coordinates/CoordinateService` 支持 WGS84/GCJ02/BD09 转换；业务 API 默认 WGS84，百度搜索结果需标注 `coordSystem: 'BD09'` 后统一转换。
- `src/core/mapProviders/tilingSchemes/baidu.ts` 为百度墨卡托范围定义自定义 `WebMercatorTilingScheme`，并对投影/反投影做 BD09 转换。
- `src/core/mapProviders/registry.ts` 使用 `UrlTemplateImageryProvider` 与 `customTags` 生成百度 `x/y/z`，当前登记了 `baidu-vector` 和 `baidu-satellite`。

这与 Cesium 官方 `UrlTemplateImageryProvider` 的设计一致：该 provider 从 URL 模板请求瓦片，支持 `tilingScheme`、`rectangle`、`minimumLevel`/`maximumLevel` 和 `customTags`。来源：[Cesium UrlTemplateImageryProvider API](https://cesium.com/learn/cesiumjs/ref-doc/UrlTemplateImageryProvider.html)。百度瓦片不是标准 XYZ/TMS 的简单同义物，必须保留当前自定义瓦片编号和投影适配。

### 坐标转换边界

建议在 toolbar/MapPlugin 边界保持以下约定：

| 数据 | 输入/输出坐标 | 处理 |
| --- | --- | --- |
| Cesium 相机、Entity、业务标绘 | WGS84 | 直接使用 Cesium `Cartographic`/`Cartesian3` |
| 百度 Place API 搜索结果 | BD09 | 解析结果后调用 `CoordinateService.toWGS84`，再交给 toolbar 定位 |
| 百度瓦片索引 | 百度 BD09 墨卡托米制/自定义范围 | 仅由 `BaiduWebMercatorProjection` 和 `createBaiduTilingScheme` 处理，业务不要手工改 x/y |
| BMapGL 双引擎同步 | BMapGL 侧 BD09，Cesium 侧 WGS84 | 同步中心点前做 BD09<->WGS84 转换；控制同步频率并避免反馈循环 |

## 与当前 Toolbar 的接入建议

### 推荐架构：Cesium 单 Viewer + 百度影像/矢量底图 + Cesium 3D 数据

当前 `mapService` 模式已支持：

```ts
createMapPlugin('cesiumContainer', {
  mapService: {
    provider: 'baidu',
    serviceKey: import.meta.env.VITE_BAIDU_AK,
  },
  services: { toolbar: { enabled: true } },
});
```

通过 toolbar 图层菜单切换 `baidu-vector` / `baidu-satellite`；若需要 3D 城市建筑，应另外加载已获授权的 Cesium 3D Tiles：

```ts
const tileset = await Cesium.Cesium3DTileset.fromUrl('/licensed-city/tileset.json');
viewer.scene.primitives.add(tileset);
```

Cesium 官方将 3D Tiles 定义为流式传输大规模异构 3D 地理空间数据的开放规范，并由 `Cesium3DTileset` 加载 tileset JSON：[Cesium 3D Tiles](https://cesium.com/learn/3d-tiling/)、[Cesium3DTileset API](https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html)。百度城市建筑数据只有在百度明确交付符合 3D Tiles/自定义 Cesium adapter 的授权数据时，才可走这条路径。

Toolbar 只负责触发底图/场景状态变化，建议增加一个业务级“城市模型”开关（或自定义按钮）来控制 `tileset.show`，不要把它伪装成普通 imagery type。切换底图时保留 tileset；切换城市模型时只替换 `scene.primitives` 中的模型集合。

### 备选架构：BMapGL 独立视图

若采购的是只能由百度 JS API GL 渲染的官方 3D 城市地图：

1. 主页面保留当前 Cesium Viewer/toolbar；新增“百度 3D 城市”模式，打开独立 DOM 容器并异步加载 `api.map.baidu.com/api?v=1.0&type=webgl&ak=...`。
2. 在 BMapGL 视图中使用其 `Map`、地球模式/倾斜 API 和官方 3D 覆盖物；不要尝试读取或重绘其内部 canvas。
3. 以 WGS84 作为跨引擎消息协议，进入/退出模式时转换为 BD09；相机同步使用节流后的中心点、heading、tilt、zoom，设置来源标记防止双向回写循环。
4. 明确只显示一个引擎的交互层，避免 Cesium 与 BMapGL 同时捕获鼠标/触摸事件；销毁模式时移除 BMapGL 监听和脚本引用。
5. 版权/Logo/服务条款按百度要求在 BMapGL 视图中保留，Cesium 的 `credits` 设置不能替代百度版权要求。

该方案的主要代价是两个 WebGL 上下文和两套相机/事件模型，移动端显存与帧率风险明显高于单 Viewer；建议只在需求明确要求“百度官方 3D 城市场景”且授权允许时采用。

## 不建议的方案及原因

| 方案 | 结论 | 原因 |
| --- | --- | --- |
| 把百度 3D 城市 URL 填入 `UrlTemplateImageryProvider` | 不可行 | imagery provider 只能得到栅格瓦片；百度 3D 城市由 BMapGL 引擎管理，且未核查到公开 3D Tiles URL |
| 用百度 MVTLayer URL 当 Cesium 3D 建筑数据 | 不等价 | MVT 是矢量瓦片；百度文档描述的是 BMapGL `MVTLayer`，Cesium 不会自动把它变成建筑实体/3D Tiles |
| 通过抓取百度内部 tile/接口反向接入 | 不建议/需法务确认 | 可能违反服务条款、版权和接口稳定性约束；官方文档未承诺这些内部接口可供第三方引擎使用 |
| 让 toolbar 同时销毁/重建 Cesium Viewer 以切换百度 3D | 不建议 | Viewer 重建会使 overlay、draw、toolbar、tileset 引用全部失效，且仍无法加载 BMapGL 场景 |

## 实施前验收清单

- 向百度确认“3D 城市地图”具体产品、AK 类型、域名白名单、配额、商用授权、版权展示要求，以及是否能交付标准 3D Tiles/可部署数据。
- 若只购买 JSAPI GL：确认允许的页面嵌入方式和是否允许与 Cesium 同页；按 BMapGL 独立视图方案评估性能。
- 若交付 3D Tiles：拿到 `tileset.json`、坐标基准/高度基准、区域范围、LOD 和授权说明，在 Cesium 中做 `Cesium3DTileset` 原型验证。
- 用真实 AK 在部署域名上验证百度底图瓦片、JSAPI GL 和 Place API，分别记录能力状态；底图瓦片可达不代表 Place API 已开通。
- 测试北京/杭州等中国区域的 BD09<->WGS84 偏差、搜索定位、相机复位、测量和模型叠加；境外范围按百度文档使用 WGS84。
- 保留 `Credit('Baidu Maps')` 与百度要求的官方版权信息，不以组件默认隐藏 credit 作为生产配置。

## 来源索引

- 百度地图开放平台： [JSAPI GL 服务介绍](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/index)、[使用须知](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/guide/usage)、[Hello World](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/guide/helloworld)、[展示地图](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/guide/show)、[变更地图类型](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/guide/maptype)、[带高度的点](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/guide/Marker3d)、[3D 棱柱绘制](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/guide/Prism)、[MVT 标准图层](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/guide/mvtLayer)、[坐标转换说明](https://lbs.baidu.com/docs/jsapi?title=jspopularGL/guide/coorinfo)、[坐标转换服务概览](https://lbsyun.baidu.com/index.php?title=webapi/guide/changeposition)、[地点检索服务](https://lbsyun.baidu.com/index.php?title=webapi/guide/webservice-placeapi)。
- Cesium： [UrlTemplateImageryProvider](https://cesium.com/learn/cesiumjs/ref-doc/UrlTemplateImageryProvider.html)、[3D Tiling](https://cesium.com/learn/3d-tiling/)、[Cesium3DTileset](https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html)。
- 当前仓库实现：[`src/core/mapProviders/tilingSchemes/baidu.ts`](../../src/core/mapProviders/tilingSchemes/baidu.ts)、[`src/core/mapProviders/registry.ts`](../../src/core/mapProviders/registry.ts)、[`doc/guide/Multi_Map_Provider_Guide.md`](../../doc/guide/Multi_Map_Provider_Guide.md)、[`doc/api/MapProvider_API.md`](../../doc/api/MapProvider_API.md)。
