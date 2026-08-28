# 国内可用的 3D Tiles 数据与服务调研

调研日期：2026-08-27  
范围：面向当前 Cesium + Toolbar/瓦片图项目，核查国内可获得的城市三维/倾斜摄影数据和服务。仅引用厂商、标准组织或项目官方页面。

## 先给结论

- 国内确实有大量三维城市和倾斜摄影数据，但公开可下载、无需登录、可直接加载的 `tileset.json` 很少。多数平台提供的是私有云服务或厂商格式（SuperMap S3M、Esri I3S/Scene Layer 等），不是标准 3D Tiles。
- 对当前项目，最稳妥的路径是采购/自建数据后取得标准 3D Tiles 文件（`tileset.json` 及其内容文件），放在项目自己的对象存储/CDN，通过 `Cesium3DTileset.fromUrl()` 加载；底图继续沿用现有 imagery provider。
- 如果只能拿到厂商在线服务，应在 Toolbar 中增加“场景服务”适配器，按厂商 SDK 加载，不能把服务 URL 填入 `UrlTemplateImageryProvider` 或假定其可由 `Cesium3DTileset` 读取。

## 来源对比

| 来源/平台 | 国内数据或地域 | 交付形态 | 是否确认标准 3D Tiles `tileset.json` | 许可/可达性 | Cesium 接入建议 |
| --- | --- | --- | --- | --- | --- |
| **SuperMap（超图）iServer / iClient3D** | 国内项目常见，覆盖城市实景三维、BIM、倾斜摄影 | iServer 三维服务；常见 S3M/缓存服务，也可由工具转换/发布 3D Tiles | 官方产品体系长期以 S3M、三维服务为主；具体版本是否提供 OGC 3D Tiles 端点需按合同和服务元数据确认，不能仅凭“Cesium 支持”判定 | 商业软件/项目授权；服务通常部署在客户内网 | 优先让超图交付标准 `tileset.json`；否则使用 SuperMap iClient3D 的 S3M 图层适配器，与 Cesium 原生 tileset 分开管理。官方入口：[SuperMap iClient](https://iclient.supermap.io/)、[SuperMap 产品与文档](https://www.supermap.com/cn/product/)
| **泰瑞数创（Terra）** | 国内城市级实景三维、数字孪生项目 | 商业数据生产、平台服务或项目交付 | 未在公开官方页面核实到可匿名下载的标准 `tileset.json` 端点；需向供应商索要格式说明和样例 | 商业授权、按项目/区域报价 | 合同中写明“Cesium 3D Tiles 1.0/1.1，入口为 `tileset.json`，含坐标基准和高度基准”；若为其平台 SDK，则按独立引擎方案。官方入口：[泰瑞数创](https://www.terrasolid.com.cn/)
| **易智瑞/Esri ArcGIS** | ArcGIS Enterprise/Online 在中国部署的城市场景 | Scene Layer/I3S（建筑、集成网格、点云等）；ArcGIS JS API 加载 | ArcGIS 官方主格式是 I3S/Scene Layer，不等同于 3D Tiles；即使新版本提供 OGC 3D Tiles 能力，也需验证具体服务的 `tileset.json` 和 Cesium 兼容性 | 商业许可；中国网络、私有化部署取决于客户环境 | 对 I3S 使用 ArcGIS API/Esri SDK；只有拿到标准 3D Tiles URL 才使用 `Cesium3DTileset`。官方文档：[Scene layers](https://developers.arcgis.com/javascript/latest/scene-layers/)、[I3S 规范](https://github.com/Esri/i3s-spec)
| **Cesium ion** | 全球内容，可上传中国自有数据并切片托管 | ion 资产服务，CesiumJS 通过 asset API/ion URL 访问 | ion 会将上传数据切片为 3D Tiles；最终可通过 ion 资产 URL 加载，原始 `tileset.json` 是否可直接下载取决于资产权限 | 全球 SaaS；官方未承诺中国大陆独立区域，需评估网络、数据出境和合规；商业套餐/服务条款适用 | 适合验证和小规模共享；生产中国项目优先自建对象存储/CDN 或确认 ion 网络与合规。官方：[Cesium ion](https://cesium.com/platform/cesium-ion/)、[Cesium ion REST API](https://cesium.com/learn/ion/rest-api/)
| **华为云/阿里云对象存储** | 中国大陆区域可部署自有城市模型 | OBS/OSS 仅提供文件托管和 CDN，不生产三维数据 | 本身不是 3D Tiles 服务；上传自有 `tileset.json` 后才是可被 Cesium 加载的数据源 | 国内区域、企业账号和合规能力较好；需配置 CORS、HTTPS、Referer/签名 | 推荐的生产承载方式：将供应商交付的标准 3D Tiles 放入 OBS/OSS/CDN，配置 `tileset.json` 相对路径和 CORS，再接入 Toolbar 场景开关。官方：[华为云 OBS](https://support.huaweicloud.com/obs/index.html)、[阿里云 OSS](https://www.alibabacloud.com/product/object-storage-service)
| **自然资源/住建政府开放数据** | 自然资源部及地方自然资源、住建部门的基础地理、实景三维、地形和建筑数据 | 常见目录服务、WMS/WMTS、GeoTIFF、LAS/点云、倾斜摄影成果或数据申请 | 公开目录通常不承诺 3D Tiles；需下载后自行转换/切片，或通过项目申请获取 | 受测绘资质、数据分级、授权和地域限制；很多数据只提供目录或申请使用 | 可作为数据来源，不应直接当在线 Cesium tileset。先确认数据许可、坐标系（CGCS2000/地方坐标）和高程基准，再用 Cesium ion、自建流水线或商业切片工具生成 3D Tiles。官方入口：[自然资源部](https://www.mnr.gov.cn/)、[国家地理信息公共服务平台天地图](https://www.tianditu.gov.cn/)
| **CesiumGS 开源 3D Tiles 样例** | 非中国城市数据，适合开发测试 | GitHub 样例 tileset 和规范测试数据 | 是标准 3D Tiles（用于测试，不代表中国地域数据） | 开源仓库按各自 LICENSE；不能用于替代生产城市数据 | 用于 Toolbar/Viewer 回归测试、性能基线和格式兼容性。官方：[3d-tiles-samples](https://github.com/CesiumGS/3d-tiles-samples)、[3d-tiles](https://github.com/CesiumGS/3d-tiles)

## “真 3D Tiles”核验方法

向供应商索取一个可脱离其 SDK 访问的 URL，并逐项验证：

1. URL 返回 JSON，入口文件名通常为 `tileset.json`，内容包含 `asset.version`（1.0/1.1）和 `root`；HTTP `Content-Type` 应为 `application/json`。
2. `root.content.uri`/`contents` 指向的 `.b3dm`、`.i3dm`、`.pnts`、`.glb` 或子 `tileset.json` 可通过同一域名访问，不能依赖 SDK 注入 token 才能解析（如需 token，应提供 Cesium 请求头/代理方案）。
3. 明确坐标参考系和高度基准。国内成果常见 CGCS2000、地方坐标或加密坐标，Cesium 地球默认 WGS84；必要时在切片前完成转换，不要在 Toolbar 中对每个 tile 临时纠偏。
4. 明确 3D Tiles 版本、批处理表（如 `3DTILES_batch_table`）和 glTF 扩展；在目标 Cesium 版本中用最小示例验证加载、拾取、裁剪和销毁。
5. 明确授权范围、缓存/离线部署权利、数据更新频率、版权水印和涉密/测绘合规要求。

“S3M 服务地址”“I3S SceneServer URL”“MVT/WMTS/WMS URL”“平台 WebGL 页面”都不是上述 `tileset.json`，不能直接标为 3D Tiles。

## 对当前 Toolbar/Cesium 方案的选型建议

### 推荐：标准 3D Tiles + 国内对象存储

将城市模型作为独立的 `scene primitive`，底图仍由现有 Toolbar 图层切换控制：

```ts
const tileset = await Cesium.Cesium3DTileset.fromUrl(
  `${modelBaseUrl}/tileset.json`,
  { credit: '数据提供方' },
);
viewer.scene.primitives.add(tileset);
```

建议 Toolbar 提供“城市模型”开关/下拉项，而不是把模型伪装成 imagery provider。模型配置至少包含 `id`、`tilesetUrl`、`rectangle`、`crs`、`heightDatum`、`credit` 和 `license`；切换模型时只替换对应 primitive，保留 Entity、绘制工具和底图状态。

### 备选：厂商私有服务

为 SuperMap S3M、ArcGIS I3S 等建立可插拔 `SceneProvider`，生命周期与当前地图服务类似（`load/show/hide/destroy`）。Toolbar 仅管理状态，不在核心层耦合厂商 SDK。若未来供应商能提供标准 3D Tiles，只需把配置切换到 `Cesium3DTileset`，不改变业务 UI。

### 不建议：抓取平台内部请求或把三维服务当瓦片图

抓取商业平台内部 tile、将 MVT/WMTS 当建筑模型、或销毁并重建 Cesium Viewer 来切换厂商 3D 页面，都会造成授权、坐标、事件和资源生命周期问题；也无法保证服务升级后的兼容性。

## 采购/技术验收清单

- 要求供应商提供一个真实区域的 `tileset.json` 样例、完整依赖文件、CesiumJS 版本和坐标/高程说明。
- 在国内部署网络测试 HTTPS、CORS、并发、跨域鉴权、CDN 缓存和断网行为；记录首屏时间和不同 LOD 的请求数。
- 对北京、上海等样例点与现有 WGS84 标绘叠加，量测平面偏差和高程偏差；确认 CGCS2000/地方坐标转换责任归属。
- 验证模型显示/隐藏、视锥裁剪、拾取属性、相机复位、底图切换、Toolbar 销毁后无残留 WebGL 资源。
- 合同写明数据地域范围、更新周期、商用/离线缓存权利、版权标识、涉密与测绘合规责任，以及服务 SLA。

## 官方来源索引

- [Cesium ion](https://cesium.com/platform/cesium-ion/)；[Cesium ion REST API](https://cesium.com/learn/ion/rest-api/)
- [Cesium 3D Tiles 开源规范与样例](https://github.com/CesiumGS/3d-tiles)；[3d-tiles-samples](https://github.com/CesiumGS/3d-tiles-samples)
- [SuperMap iClient](https://iclient.supermap.io/)；[SuperMap 产品](https://www.supermap.com/cn/product/)
- [泰瑞数创官网](https://www.terrasolid.com.cn/)
- [ArcGIS Scene layers](https://developers.arcgis.com/javascript/latest/scene-layers/)；[Esri I3S specification](https://github.com/Esri/i3s-spec)
- [华为云 OBS 文档](https://support.huaweicloud.com/obs/index.html)；[阿里云 OSS](https://www.alibabacloud.com/product/object-storage-service)
- [自然资源部](https://www.mnr.gov.cn/)；[天地图](https://www.tianditu.gov.cn/)
