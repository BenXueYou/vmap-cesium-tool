# vmap-cesium-tool 天地图三维改造方案（对齐 TDT_3D 实现）

## 1. 目标与范围

### 1.1 改造目标
将当前项目中的 `tdt3d` 地图能力，改造为与参考方案一致的“可配置、可降级、可观测”的三维服务装配模式，确保以下能力稳定可用：

1. 三维底图（影像/矢量）
2. 三维注记（GeoWTFS）
3. 三维地形（GeoTerrainProvider）
4. 异常时自动降级（仅底图）
5. 统一配置入口（token、子域名、URL 模板、超时、重试）

### 1.2 影响范围

1. `src/core/layers/TDTMapLayer.ts`
2. `src/core/MapPlugin.ts`
3. `src/core/utils/tdt3dRuntime.ts`
4. `src/core/types.ts`
5. `src/core/constants.ts`
6. `src/core/services/toolbar/config.ts`

---

## 2. 现状评估（与参考方案差异）

### 2.1 已有基础能力（可复用）

1. 已支持 `tdt3d` 地图类型切换。
2. 已有运行时插件加载 `ensureTDT3DPluginLoaded`。
3. 已有地形/地名实例生命周期管理（`syncGeoWTFS`、`destroyGeoWTFS`）。
4. 已有降级日志（缺依赖时回落影像模式）。

### 2.2 关键差异与风险点

1. **配置分散且不可声明化**
   现状把 URL 与参数写死在 `TDTMapLayer` 的工厂函数中，缺少参考方案里的全局配置对象（协议、子域名、超时、重试、URL 模板）。

2. **地形服务参数模型与参考方案不一致**
   现状 `GeoTerrainProvider` 传参为 `urls` 数组（`...mapservice/swdx?T=elv_c&tk=...`），而参考方案强调 `url + subdomains + token` 的模板化配置，后续替换服务地址不方便。

3. **GeoWTFS 初始化方式偏“写死覆盖”**
   现状通过覆盖 `getTileUrl/getIcoUrl` + `initTDT(TDT_3D_INIT_TILES)`，与参考方案的 `url/icoUrl` 直传方式有偏差，不利于兼容不同插件版本。

4. **Cesium 版本门槛过于严格**
   `tdt3dRuntime` 当前使用 `startsWith('1.134.1')`，当小版本漂移时可能直接禁用三维扩展，即使实际兼容也被误判。

5. **缺少请求层容错参数下沉**
   参考方案提到 `requestTimeoutMs/retry/backoff`，现状无统一入口，问题排查依赖浏览器默认行为。

---

## 3. 改造设计

### 3.1 设计原则

1. 对外 API 保持兼容，优先“增量配置”而非破坏式改造。
2. 将三维相关地址与策略集中在一处配置管理。
3. 把插件差异（不同 `GeoWTFS/GeoTerrainProvider` 构造方式）收敛到适配层。
4. 默认可降级，且降级原因可追踪（日志 + 错误码）。

### 3.2 新增配置模型（建议）

在 `src/core/types.ts` 增加以下类型：

1. `TDTGlobalConfig`
2. `TDTSceneConfig`
3. `TDTRequestRetryConfig`
4. `TDT3DProviderMode`（用于插件构造策略切换）

建议结构（示意）：

- `TDTGlobalConfig`
  - `token: string`
  - `protocol?: 'http' | 'https'`
  - `subdomains?: string[]`
  - `tileMatrixSet?: 'w' | 'c'`
  - `requestTimeoutMs?: number`
  - `retry?: { maxAttempts: number; backoffMs: number }`

- `TDTSceneConfig`
  - `baseMapMode?: 'img' | 'vec' | 'ter' | 'tdt3d'`
  - `terrainEnabled?: boolean`
  - `terrainUrl?: string`
  - `annotation3DEnabled?: boolean`
  - `annotation3DUrl?: string`
  - `annotation3DIcoUrl?: string`
  - `tilesetUrl?: string`
  - `pluginMode?: 'legacy-override' | 'constructor-url' | 'auto'`

将 `layers.tdt` 从“仅 mapTypeId/token/showLabel”升级为“基础参数 + scene 参数”，但保留旧字段。

### 3.3 统一 URL 构建器

在 `TDTMapLayer.ts` 中抽出 URL 构建函数：

1. `buildTdtWmtsUrl(layer, cfg)`
2. `buildTdtTerrainUrl(cfg, sceneCfg)`
3. `buildTdtAnnotation3DUrl(cfg, sceneCfg)`
4. `buildTdtAnnotation3DIcoUrl(cfg, sceneCfg)`

目标：

1. 避免 URL 模板散落。
2. 便于支持环境切换（内外网、代理网关）。
3. 便于单元测试 URL 正确性。

### 3.4 GeoTerrainProvider 适配器

新增 `createTdtTerrainProvider` 适配逻辑：

1. 优先尝试参考方案签名：`new GeoTerrainProvider({ url, subdomains, token })`
2. 失败后回退现状签名：`new GeoTerrainProvider({ urls })`
3. 两者都失败则返回 `null`，并打出结构化告警。

### 3.5 GeoWTFS 适配器

新增 `createTdtAnnotation3D` 适配逻辑：

1. `constructor-url` 模式：
   - `new GeoWTFS(viewer, { url, icoUrl, subdomains, token, ... })`
2. `legacy-override` 模式：
   - `new GeoWTFS({ viewer, ... })`
   - 覆盖 `getTileUrl/getIcoUrl`
   - `initTDT(tiles)` 前增加参数保护
3. `auto` 模式：先尝试 `constructor-url`，失败再回退 `legacy-override`

### 3.6 Runtime 依赖加载策略优化

`tdt3dRuntime.ts` 调整：

1. 版本判断改为白名单区间或可配置策略，不再严格锁死 `1.134.1` 前缀。
2. 加载完成后增加能力探针：
   - `hasGeoTerrainProvider`
   - `hasGeoWTFS`
3. 对外返回 `LoadReport`，包含：
   - `loaded`
   - `degraded`
   - `reason`

### 3.7 MapPlugin 装配策略调整

在 `MapPlugin.addTDTLayers` 中：

1. 拆分“底图层装配”和“三维能力装配”。
2. 先确保底图可见，再异步装配地形与地名。
3. 地名展示开关由 `annotation3DEnabled + showLabel + forcePlaceName` 三者共同决定。
4. 退出 `tdt3d` 时确保彻底释放：
   - `GeoWTFS` 实例
   - terrain provider 回退

---

## 4. 分阶段实施计划

### Phase 1：配置模型与兼容层（低风险）

1. 扩展 `types.ts/constants.ts`，增加 `TDTGlobalConfig/TDTSceneConfig`。
2. 保持旧参数可用（自动映射到新结构）。
3. 新增 URL 构建函数，不改变现有调用语义。

验收：旧示例无感运行，新配置可驱动 URL 变化。

### Phase 2：Provider 适配改造（中风险）

1. 改造 `createTDT3DTerrainProvider` 为双模式适配。
2. 改造 `createTDT3DGeoWTFS` 为三模式（auto/constructor-url/legacy-override）。
3. 增加参数保护和异常捕获。

验收：

1. 参考方案 URL 可直接生效。
2. 旧 `cesiumTdt.js` 仍可用。
3. 异常时稳定降级。

### Phase 3：MapPlugin 装配与状态机（中风险）

1. 调整 `addTDTLayers/syncGeoWTFS` 的装配顺序。
2. 引入 `tdt3d` 状态机（idle/loading/ready/degraded）。
3. 补齐切图、2D/3D 形态切换场景的资源清理。

验收：高频切图/形态切换不报错，无“残留地形/残留地名”。

### Phase 4：可观测性与文档（低风险）

1. 统一 warning/error 文案与错误码。
2. 输出对接文档（参数示例、排错指引）。
3. 补充 demo：`tdt3d` 开关、脚本加载失败模拟、token 失效模拟。

---

## 5. 验收标准（必须满足）

1. `tdt3d` 模式下可见：
   - 影像底图
   - 三维地形
   - 三维地名
2. 关闭地名开关后仅隐藏地名，不影响底图/地形。
3. 缺 token 或脚本加载失败时：
   - 页面不崩溃
   - 自动降级
   - 控制台输出可定位原因
4. `vec/img/ter/tdt3d` 四种地图类型切换稳定，连续切换 30 次无异常。
5. 打包后 `dist/static/cesiumTdt.js` 仍可被运行时定位。

---

## 6. 关键风险与规避

1. **风险：第三方插件签名不一致**
   - 规避：适配层双签名 + auto 回退。

2. **风险：Cesium 升级造成插件失效**
   - 规避：版本策略配置化 + 能力探针代替硬编码版本。

3. **风险：运行时脚本路径在不同宿主下失效**
   - 规避：支持显式传入 `runtimeScripts`，默认路径仅作为兜底。

---

## 7. 建议对外配置示例（改造后）

```ts
createMapPlugin('map', {
  cesiumToken: 'your-cesium-token',
  layers: {
    type: 'tdt',
    tdt: {
      mapTypeId: 'tdt3d',
      token: 'your-tdt-token',
      showLabel: true,
      global: {
        protocol: 'https',
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        tileMatrixSet: 'w',
        requestTimeoutMs: 8000,
        retry: { maxAttempts: 2, backoffMs: 400 },
      },
      scene: {
        terrainEnabled: true,
        terrainUrl: 'https://t{s}.tianditu.gov.cn/mapservice/swdx?T=elv_c&x={x}&y={y}&l={z}&tk={token}',
        annotation3DEnabled: true,
        annotation3DUrl: 'https://t{s}.tianditu.gov.cn/mapservice/GetTiles?lxys={z},{x},{y}&tk={token}',
        annotation3DIcoUrl: 'https://t{s}.tianditu.gov.cn/mapservice/GetIcon?id={id}&tk={token}',
        pluginMode: 'auto',
      },
    },
  },
});
```

---

## 8. 结论

当前项目已经具备 `tdt3d` 基础能力，但与参考方案相比，核心差距在于“配置中心化、Provider 兼容适配、运行时策略可观测”。按本方案实施后，可以在不破坏现有 API 的前提下，把三维加载稳定性提升到可生产化水平。
