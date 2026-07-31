# 地图服务与厂商地点搜索下沉实施计划

## 1. 目标

将 `map-config` 页面中的多厂商搜索、鉴权字段映射、坐标归一化、重复定位和连通性厂商分支下沉到地图组件。完成后，业务以一份地图服务配置驱动底图和搜索，并只消费 WGS-84 搜索选中结果。

关联资料：

- [领域词汇表](../CONTEXT.md)
- [架构决策](../docs/adr/0001-component-owned-map-service-search.md)
- [厂商能力研究](./provider-capability-research.md)

## 2. 已确认的接口契约

### 2.1 地图服务配置

```ts
export type OnlineMapServiceProvider =
  | 'tdt'
  | 'gaode'
  | 'baidu'
  | 'tencent'
  | 'google';

export type MapServiceProvider = OnlineMapServiceProvider | 'private';

export type MapServiceConfig =
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

- `provider` 只接受六个标准值，未知值为 `INVALID_CONFIG`，不得回退到天地图。
- 在线配置裁剪密钥首尾空格；天地图消费 `serviceKey/secureKey`，高德消费 WebService `serviceKey/secureKey`，其他厂商只消费 `serviceKey`。
- 私有地图不接收公网厂商凭证，不提供厂商地点搜索。
- 新接口中 `mapService.provider` 是唯一厂商来源。
- 新旧配置同时出现时立即报错，不定义优先级。

### 2.2 厂商默认底图类型

| 厂商 | 默认类型 | 默认注记 |
|---|---|---|
| 天地图 | `img` | 开启 |
| 高德 | `satellite` | 开启 |
| 百度 | `satellite` | 开启 |
| 腾讯 | `satellite` | 开启 |
| Google | `satellite` | 按厂商能力处理 |
| 私有地图 | `xyz` | 关闭 |

底图类型继续作为组件内部状态和图层切换能力存在，但新业务接入不必传入。旧 `baseMap.type` 在 1.x 兼容路径中继续生效。

### 2.3 底图校验结果

```ts
export type CapabilityStatus =
  | 'available'
  | 'unavailable'
  | 'unknown'
  | 'notChecked';

export interface MapServiceValidationResult {
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
      status: CapabilityStatus;
      credentialVerified?: boolean;
      message?: string;
    };
    search: {
      status: CapabilityStatus;
      requiresEnablement: boolean;
      requiredProduct?: string;
      setupUrl?: string;
      message?: string;
    };
  };
}
```

`ok` 默认只描述本次底图校验，不调用搜索接口。搜索默认返回 `notChecked`，同时返回需开通的厂商产品、提示和官方链接。

### 2.4 动态更新

```ts
export interface MapServiceUpdateResult extends MapServiceValidationResult {
  changed: boolean;
}

mapPlugin.setMapService(next: MapServiceConfig): Promise<MapServiceUpdateResult>;
```

行为：

1. 校验配置结构和底图能力。
2. 在未修改当前已提交状态前准备新厂商资源。
3. 成功后一次性提交厂商、凭证、底图、搜索 Adapter 和能力状态。
4. 失败时保留旧底图、旧搜索和旧凭证，返回结构化结果。
5. 切换开始后，所有旧搜索请求立即作废；失败回滚也不恢复旧请求结果。
6. 切换到私有地图时隐藏搜索；切回在线地图时恢复为 `notChecked`。

旧 `setMapAuth()`、`updateMapAuth()` 和 `updateBaseMap()` 在 1.x 保留并标记废弃。

### 2.5 搜索选择通知

```ts
export interface MapSearchResult {
  provider: OnlineMapServiceProvider;
  name: string;
  address: string;
  longitude: number;
  latitude: number;
}

onSearchResultSelected?: (result: MapSearchResult) => void;
```

经纬度始终为 WGS-84。组件完成唯一一次相机定位后发出通知；业务不得通过该通知覆盖组件定位。搜索保持定位前的相机高度，只改变中心经纬度，不创建临时搜索标记。

## 3. 模块设计

### 3.1 外部接口

调用方只需要理解以下入口：

- 初始化参数 `mapService`。
- 独立的 `validateMapService(mapService, options?)`。
- 实例方法 `setMapService(mapService)`。
- `onSearchResultSelected` 通知。
- 可选 `providerSearch.endpoints/request` 部署接入配置。

厂商 URL、参数、签名、响应结构、原始坐标系、底图默认类型和能力提示均隐藏在实现内部。

### 3.2 内部接缝

为每个厂商提供内部 Adapter，并由注册表按标准 `provider` 选择。建议内部接口覆盖：

```ts
interface MapProviderAdapter {
  createDefaultBaseMap(service: MapServiceConfig): BaseMapConfig;
  validateBasemap(service: MapServiceConfig, request: MapRequest): Promise<BasemapCapability>;
  getSearchRequirement(): SearchRequirement;
  search(input: ProviderSearchInput, request: MapRequest): Promise<ProviderSearchResult[]>;
}
```

该接口为内部测试接缝，不导出到业务。HTTP 请求通过已有 `providerSearch.request` 或等价内部端口注入，生产使用 Fetch Adapter，测试使用内存 Adapter。

### 3.3 建议文件落点

- `src/core/mapProviders/mapService/types.ts`
- `src/core/mapProviders/mapService/MapServiceManager.ts`
- `src/core/mapProviders/mapService/validation.ts`
- `src/core/mapProviders/adapters/tdt.ts`
- `src/core/mapProviders/adapters/gaode.ts`
- `src/core/mapProviders/adapters/baidu.ts`
- `src/core/mapProviders/adapters/tencent.ts`
- `src/core/mapProviders/adapters/google.ts`
- `src/core/mapProviders/adapters/private.ts`
- `src/core/mapProviders/registry.ts`
- `src/core/mapProviders/ProviderSearchService.ts`
- `src/core/MapPlugin.ts`
- `src/core/types.ts`
- `src/core/services/toolbar/buttons/SearchButtonHandler.ts`

实际实施时优先演进现有注册表，避免同时保留两套并行厂商分支。

## 4. 实施阶段

### 阶段 A：建立新类型与兼容入口

1. 在公共类型中加入 `MapServiceConfig`、校验结果、更新结果和标准搜索结果。
2. `MapPluginOptions` 加入 `mapService`。
3. 构造阶段检测新旧配置混用并返回明确错误。
4. 将旧 `baseMap/mapAuth` 转换到同一内部规范对象，避免维护两条实现链。
5. 导出新类型和 `validateMapService()`。

完成条件：新旧配置分别能构造相同的内部厂商状态；混用用例稳定失败。

### 阶段 B：统一厂商 Adapter

1. 把默认底图类型、凭证解释、底图创建、搜索能力说明和搜索实现收拢到厂商 Adapter。
2. 保留现有 GCJ-02、BD-09 瓦片投影适配。
3. 厂商原始搜索结果必须携带内部源坐标系，再由单一归一化步骤转换为 WGS-84。
4. 禁止公开标准结果再次携带可变坐标系语义。
5. 高德签名只保留组件内的一份实现，供搜索复用；删除业务重复实现。
6. Google 改用 Places API (New) Text Search，使用 POST、字段掩码及统一响应归一化。

完成条件：五家在线厂商使用同一搜索入口返回标准结果，转换只发生一次。

### 阶段 C：实现基础校验

1. 天地图请求固定小瓦片并携带 `serviceKey/secureKey`。
2. Google 调用 Map Tiles `createSession`。
3. 高德、百度、腾讯当前裸瓦片只报告可达性，并返回 `credentialVerified: false`。
4. 私有地图探测元数据或固定瓦片，不产生搜索能力。
5. 区分 HTTP、代理、CORS、凭证、厂商业务错误，不将所有失败归为密钥错误。
6. 返回静态搜索开通要求，不在默认校验中调用搜索。

完成条件：配置页可以仅凭结构化结果展示底图状态和搜索开通提示。

### 阶段 D：实现原子 `setMapService()`

1. 引入“准备中”和“已提交”状态，避免先清旧图再加载新图。
2. 新厂商验证与资源准备成功后再替换影像图层。
3. Google session、注记层、投影方案及搜索 Adapter 与厂商状态同时提交。
4. 失败恢复旧影像层、旧服务配置和旧搜索能力状态。
5. 使用递增 generation/token 作废切换前的搜索请求和迟到响应。
6. 保留 WGS-84 相机位置和高度。

完成条件：任何准备失败都不会留下混合厂商状态或空白旧地图。

### 阶段 E：收口搜索交互

1. 新 `mapService` 模式检测到旧 `callbacks.onSearch` 时返回配置错误；旧配置模式继续兼容并给出废弃提示。
2. 在线地图搜索入口初始能力为 `notChecked`；私有地图自动隐藏入口。
3. 首次真实搜索成功后标记 `available`。
4. 未开通或未授权时显示厂商产品名、提示和官方链接，并保留底图。
5. 网络、代理或超时错误保持可重试，不误标为权限失败。
6. 搜索使用全国范围，厂商支持时使用当前视口作软排序，不进行硬区域过滤。
7. 不自动选择首项；用户选中后只执行一次定位。
8. 定位保留当前相机高度，并触发 `onSearchResultSelected`。

完成条件：业务不参与搜索请求、坐标转换或相机定位。

### 阶段 F：迁移 `map-config` 业务页

目标项目：`C:\\WORKCODE\\低空侦测\\低空侦测2.2\\vmicro-app-system`

1. 用后端 `provider/serviceKey/secureKey` 组装在线 `mapService`。
2. 私有地图将 `extInfo.offlineMapUrl` 显式转换为顶层 `offlineMapUrl`。
3. 删除 `buildBaseMapConfig()` 和 `buildMapAuthConfig()` 的厂商映射职责。
4. 删除业务 `createAmapSignature()`、搜索 URL 构造、厂商响应判断和搜索探针逻辑。
5. 将配置页校验改为调用组件 `validateMapService()`。
6. 保留 Vite/Nginx 的百度、腾讯代理规则，并通过 `providerSearch.endpoints` 注入。
7. 用 `setMapService()` 替代先 `setMapAuth()` 再 `updateBaseMap()`。
8. 删除 `toolbarButtonConfigsPrivate` 和 `syncToolbarButtons()` 的搜索厂商分支。
9. 将旧 `onSelect` 改为 `onSearchResultSelected`，只更新中心经纬度及 `map-config-center-marker`。
10. 删除回调中的第二次 `camera.flyTo()`，不修改 `defaultZoomLevel`。

完成条件：`map-config` 不再包含已支持厂商的搜索、签名、坐标或工具栏可用性分支。

### 阶段 G：文档与发布

1. 更新 `doc/api/MapProvider_API.md`。
2. 更新 `doc/guide/Multi_Map_Provider_Guide.md`。
3. 增加新旧配置迁移示例和混用错误说明。
4. 记录每家厂商需开通的底图、搜索产品及代理要求。
5. 标记旧 `baseMap.provider/type`、厂商嵌套 `mapAuth`、`onSearch/onSelect` 和分步更新方法为废弃。
6. 以向后兼容的 1.x 次版本发布，下一主版本执行删除。

## 5. 测试计划

### 5.1 常规 CI

- 每家厂商使用固定响应样本测试请求构造和响应归一化。
- 高德使用固定参数和签名向量验证排序、编码与 MD5 结果。
- Google 验证 Places Text Search 的 POST、字段掩码和错误映射。
- 验证百度 BD-09、高德/腾讯 GCJ-02、天地图/Google WGS-84 只转换一次。
- 使用球面距离断言已知坐标往返误差不超过 20 米。
- 验证选中结果只触发一次 `flyTo`，保持相机高度，并只回调 WGS-84。
- 验证新旧配置混用失败、旧配置单独使用仍兼容。
- 验证私有地图隐藏搜索，在线地图恢复搜索。
- 验证首次权限失败提示、网络失败可重试。
- 验证服务切换作废旧请求，迟到响应不能污染新结果。
- 验证原子切换失败后旧影像层、搜索 Adapter 和配置均未改变。
- 验证首次初始化失败不回退其他厂商。

### 5.2 可选真实厂商验收

通过环境变量注入真实密钥，不提交密钥或真实响应中的敏感信息。固定地点：

- 杭州滨江公园
- 杭州西湖
- 北京天安门
- 上海东方明珠

对百度、高德、腾讯、Google 分别检查：

1. 搜索结果名称和地址可识别。
2. 选中点与当前厂商底图同名 POI 视觉对齐。
3. 厂商原始坐标转换为 WGS-84 后，再转换回原厂商坐标的误差不超过 20 米。
4. 业务收到的经纬度与组件实际定位经纬度一致。

## 6. 验收门槛

- `npm test`、`npm run type-check`、`npm run build` 通过。
- 搜索、切换和校验新增行为具有接口级测试，不测试私有内部状态。
- `map-config` 中不存在已支持厂商的搜索请求、签名和坐标转换实现。
- 任一搜索结果不会触发业务层第二次定位。
- 五家在线厂商的能力提示与官方产品匹配。
- 未修改或覆盖工作区中与本改造无关的现有变更。

## 7. 实施前复核项

- 在厂商控制台复核天地图、百度、腾讯最新的白名单和 CORS 规则。
- 确认后端高德 `secureKey` 始终是 WebService 数字签名私钥，而不是 JavaScript API `securityJsCode`。
- 确认 Google 项目启用 Map Tiles API 与 Places API (New)，并为浏览器/代理设置适当的 Key 限制。
- 确认生产 Nginx 具备与开发环境一致的百度、腾讯搜索代理路径。
