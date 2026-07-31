# 多厂商底图与地点搜索能力校验研究

访问日期：2026-07-30  
范围：天地图、高德、百度、腾讯、Google 的官方文档与官方 API。本文刻意把“厂商主机可达”“底图产品可用”“地点搜索产品可用”分为三个不同结论。

## 结论摘要

1. `validateMapService()` 的基础连通性校验**可以且应该不依赖地点搜索接口**：默认只校验配置结构与底图实际能力。
2. 但“底图能加载”不能证明地点搜索已经开通。搜索应作为独立 capability，返回 `unknown/notChecked`，并给出产品名称、开通提示和官方文档链接。
3. 未找到任何一家公开的、跨产品通用的“只校验 key 而不消费具体 API 能力”的官方 introspection 端点。可靠校验必须调用该凭证所对应产品的真实端点；可以选择最小、低成本请求，但不能用 A 产品成功推导 B 产品有权限。
4. Google 有明确且适合底图探测的 `createSession`；天地图 WMTS/DataServer 请求本身携带 `tk`（以及项目所用的 `sk`），可以请求单张固定瓦片。当前组件的高德、百度、腾讯底图实现使用不带业务 `serviceKey` 的裸瓦片地址，因此它们最多证明瓦片主机可达，**不能验证传入的 serviceKey/secureKey**，也不应据此宣称“底图凭证有效”。
5. 高德尤其需要区分凭证类型：JS API 的 `securityJsCode` 与 Web 服务签名/搜索能力不能混为同一个“secureKey”语义；组件的新三字段 DTO 必须在适配层明确其用途。

## 厂商能力矩阵

| 厂商 | 底图/瓦片能力 | 地点/POI 搜索能力 | 不依赖搜索的凭证校验 | 浏览器与 key 限制 |
|---|---|---|---|---|
| 天地图 | 官方地图服务/WMTS，瓦片请求使用开发者 `tk`；当前项目亦调用官方 `*.tianditu.gov.cn/*_w/wmts`。官方入口：[地图服务](https://lbs.tianditu.gov.cn/server/MapService.html)（访问于 2026-07-30） | 官方搜索服务：[搜索服务](https://lbs.tianditu.gov.cn/server/search.html)（访问于 2026-07-30） | 可用固定层级、固定坐标的单张 WMTS/DataServer 瓦片探测底图凭证与底图服务；它不证明搜索能力。未确认到通用 key introspection 端点。 | 浏览器直连是否成功仍受该 key 的应用配置与官方响应 CORS 影响；不能把 `fetch` 的 CORS 失败直接归类为密钥错误。天地图页面在本次命令行抓取中未稳定返回，具体白名单/CORS规则需实施前再次人工核对官方控制台。 |
| 高德 | 官方网页底图产品是 JavaScript API 2.0，加载方式与 key 见：[JS API 加载](https://lbs.amap.com/api/javascript-api-v2/guide/abc/load)（访问于 2026-07-30）；JS API 安全配置见：[JS API 安全密钥使用](https://lbs.amap.com/api/javascript-api-v2/guide/abc/prepare)（访问于 2026-07-30） | 地点搜索属于独立的 Web 服务 API：[搜索 POI](https://lbs.amap.com/api/webservice/guide/api/search)（访问于 2026-07-30）；地理编码也是另一个 Web 服务能力：[地理/逆地理编码](https://lbs.amap.com/api/webservice/guide/api/georegeo)（访问于 2026-07-30） | 未确认到通用 key introspection 端点。可加载官方 JS API 来校验 JS API key/securityJsCode；若 `serviceKey` 定义为 Web 服务 key，则必须调用一个 Web 服务端点才能可靠校验。当前组件的 `is.autonavi.com/appmaptile` 裸瓦片请求不携带 key，不能校验输入凭证。 | 官方明确要求 JS API 2.0 配置安全密钥；`securityJsCode` 是 JS API 安全配置。浏览器直接调用 Web 服务还涉及 key 类型、安全与跨域，生产组件宜允许应用提供同源代理/自定义 requester。不能把 JS API 的 securityJsCode 直接当作 Web 服务签名私钥使用。 |
| 百度 | 官方网页底图产品为 JavaScript API GL，申请 AK/加载入口：[获取 AK](https://lbsyun.baidu.com/index.php?title=jspopularGL/guide/getkey)（访问于 2026-07-30） | 地点检索属于 Web 服务 Place API：[地点检索服务](https://lbsyun.baidu.com/index.php?title=webapi/guide/webservice-placeapi)（访问于 2026-07-30） | 未确认到通用 AK introspection 端点。可用官方 JS API 的成功加载校验浏览器端 AK；要验证 Place API 权限则仍需真实 Place 请求。当前组件的 `bdimg.com` 裸瓦片地址不携带 AK，不能验证 `serviceKey`。 | AK 的应用类型/白名单应与调用端匹配。浏览器直接请求 Web 服务若受 CORS 或 referer/IP 限制，需通过业务网关代理；代理错误应与 `INVALID_CREDENTIALS` 分开报告。更精确的官方白名单/CORS条款需实施前在百度控制台文档复核。 |
| 腾讯 | 官方网页底图产品为 JavaScript API GL：[基础地图/入门](https://lbs.qq.com/webApi/javascriptGL/glGuide/glBasic)（访问于 2026-07-30） | 地点检索属于 WebService 的 Search 服务：[地点搜索](https://lbs.qq.com/service/webService/webServiceGuide/webServiceSearch)（访问于 2026-07-30） | 未确认到通用 key introspection 端点。可用官方 JS API 加载验证网页端 key；Search 权限只能用 Search 或同一 WebService 产品的真实端点验证。当前组件的 `map.gtimg.com` 裸瓦片地址不携带 key，不能验证 `serviceKey`。 | WebService key 的域名/IP/签名限制与浏览器 CORS 可能使前端直连失败，组件应支持同源代理。实施前需在腾讯控制台的 key 配置页复核当前应用限制规则。 |
| Google | 必须在 Google Cloud 项目启用 **Map Tiles API**；2D 瓦片前先创建 session：[Session tokens](https://developers.google.com/maps/documentation/tile/session_tokens)（访问于 2026-07-30），官方端点为 `POST https://tile.googleapis.com/v1/createSession?key=KEY` | 若产品目标是“地点/POI 文本搜索”，应启用 **Places API (New)** 并调用 Text Search：[Text Search (New)](https://developers.google.com/maps/documentation/places/web-service/text-search)（访问于 2026-07-30）。当前代码使用 Geocoding API 的地址地理编码，它并不等价于完整 POI Text Search：[Geocoding API](https://developers.google.com/maps/documentation/geocoding/start)（访问于 2026-07-30） | `createSession` 是可靠的 Map Tiles 能力探测，但不能证明 Places/Geocoding 已启用。未找到通用 key introspection 端点；搜索能力需对目标 API 做最小真实请求。 | 官方建议同时配置 application restriction 与 API restriction，并为不同调用场景使用合适的 key：[API Security Best Practices](https://developers.google.com/maps/api-security-best-practices)（访问于 2026-07-30）。服务端 Web Service key 不应无保护地暴露在浏览器中；组件应支持后端代理。 |

## 对 `validateMapService()` 的建议

### 默认行为：只校验底图，不调用搜索

```ts
type CapabilityStatus = 'available' | 'unavailable' | 'unknown' | 'notChecked';

interface MapServiceValidationResult {
  ok: boolean; // 默认只代表配置合法且 basemap 可用
  provider: MapServiceProvider;
  capabilities: {
    basemap: {
      status: CapabilityStatus;
      code?: string;
      message?: string;
    };
    search: {
      status: CapabilityStatus; // 默认 notChecked，而不是 available
      requiresEnablement: boolean;
      requiredProduct?: string;
      setupUrl?: string;
      message?: string;
    };
  };
}
```

厂商探测建议：

- 天地图：请求一张固定公开层、固定 z/x/y 的小瓦片，携带 `serviceKey` 和适用的 `secureKey`；检查 HTTP、内容类型及非空图像。
- Google：调用 `createSession`；成功即代表 Map Tiles API 对此 key 可用。
- 高德/百度/腾讯：在当前实现继续使用裸瓦片 URL 时，只能报告 `basemap.status = available` 且附 `credentialVerified = false`。若要真正验证底图产品凭证，应改用各家的官方 JS API/受支持的鉴权产品，而不是把裸瓦片成功当作 key 校验。
- 私有地图：请求 `offlineMapUrl` 对应的元数据或固定瓦片；不产生搜索 capability。

网络错误、CORS、代理 404/502、厂商业务错误码、凭证错误必须分开映射，避免把代理未配置误报为密钥无效。

### 搜索能力提示，而非默认硬校验

默认结果应主动向业务提供提醒材料：

```ts
search: {
  status: 'notChecked',
  requiresEnablement: true,
  requiredProduct: '高德 Web服务 API / 搜索POI',
  setupUrl: 'https://lbs.amap.com/api/webservice/guide/api/search',
  message: '底图校验不包含地点搜索；使用工具栏搜索前请开通并单独验证该能力。'
}
```

UI 文案建议：

> 底图连接正常。地点搜索属于厂商的独立接口能力，当前尚未校验；请确认已开通“{requiredProduct}”。

可另提供显式的 `validateSearchCapability()`，或 `validateMapService(config, { capabilities: ['basemap', 'search'] })`。只有用户主动要求时才发送最小真实搜索请求。搜索失败不应让“底图连通性”变成失败，而应使搜索按钮隐藏/禁用，并通过能力状态通知业务。

## 尚待实施阶段复核

- 天地图、百度、腾讯控制台中最新的 key 应用类型、白名单和 CORS 原文；本次公开页面未能稳定暴露所有控制台细则，因此本文没有将推断写成确定规则。
- 高德后端的 `secureKey` 究竟代表 JS API `securityJsCode` 还是 Web 服务数字签名私钥。两者必须在 DTO 契约中二选一或拆字段，不能靠组件猜测。
- Google 搜索产品最终选择 Places Text Search 还是 Geocoding。若需求是“杭州滨江公园”等 POI，优先采用 Places Text Search；Geocoding 更适合地址到坐标。

