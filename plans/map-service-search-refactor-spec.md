# Spec: 地图服务配置与厂商地点搜索下沉

## Problem Statement

当前地图组件与业务系统共同承担多厂商底图、鉴权、地点搜索、坐标转换和搜索后的地图定位。业务页面需要分别组装 `baseMap`、厂商嵌套 `mapAuth`、搜索请求参数、厂商响应归一化、坐标系转换和二次相机定位，导致“当前地图服务”存在多个数据源，在线地图与私有地图切换行为不一致，地点搜索入口是否可用也依赖业务分支维护。

这种分工让业务系统很难只用“一份地图服务配置”稳定驱动底图与搜索，也让组件无法独立表达“底图可用但地点搜索尚未开通”这类真实状态。业务如果继续自行发起厂商搜索并再次定位，还会绕过组件内部的标准位置结果和唯一一次定位约束，放大多厂商坐标差异、错误映射和切换时序问题。

本次能力需要把地图服务配置、地图服务校验、地图服务切换、厂商地点搜索和标准位置结果统一收口到地图组件，使业务系统只提供地图服务配置，只接收 WGS-84 的搜索选中结果，并在新旧接口共存的 1.x 周期内获得清晰的迁移路径。

## Solution

地图组件将新增以 `mapService` 为唯一厂商来源的公开接口。在线地图服务通过 `provider/serviceKey/secureKey` 描述，私有地图服务通过 `provider/offlineMapUrl` 描述。组件按当前地图服务配置自动选择厂商默认底图类型，并将底图创建、地图服务校验、厂商地点搜索、搜索能力提示、坐标归一化和搜索后的相机定位统一放在组件内部实现。

组件将提供独立的 `validateMapService()` 与实例级 `setMapService()`。`validateMapService()` 默认只验证底图能力，并返回结构化的地点搜索能力状态与开通提示；`setMapService()` 采用原子切换语义，在新地图服务准备完成前不破坏当前可用底图与搜索状态。地点搜索入口由组件自己决定何时展示、隐藏、提示不可用或允许重试。业务系统只消费标准位置结果和选择通知，不再直接拼接厂商搜索 URL、转换搜索坐标、探测搜索能力或执行第二次地图定位。

## User Stories

1. As a 业务系统接入开发者, I want to pass one map service config into the map component, so that basemap and provider search always use the same provider source.
2. As a 业务系统接入开发者, I want online map services to use one standard credential shape, so that I do not maintain separate auth DTOs for each provider path.
3. As a 业务系统接入开发者, I want private map services to use an offline map URL without public-provider credentials, so that offline deployments remain explicit and isolated.
4. As a 地图配置页用户, I want map service validation to tell me whether the basemap works, so that I can save a usable configuration confidently.
5. As a 地图配置页用户, I want validation to tell me that provider search is a separate capability, so that I do not mistake basemap success for search enablement.
6. As a 地图配置页用户, I want validation feedback to distinguish invalid config, invalid credentials, network errors, provider service failures, client restrictions and proxy requirements, so that I can fix the real problem faster.
7. As a 地图配置页用户, I want search capability to default to `notChecked`, so that I am not falsely told search is available before any real search flow proves it.
8. As a 地图配置页用户, I want the result to include the provider-specific product name and setup link for search, so that I know what to enable in the provider console.
9. As a 地图组件使用者, I want the component to choose the default basemap type for each provider, so that common integrations do not have to specify imagery type manually.
10. As a 地图组件使用者, I want switching map services to be atomic, so that a failed switch never leaves the map in a half-old, half-new state.
11. As a 地图组件使用者, I want the old basemap to remain visible when a new map service fails validation or preparation, so that users do not see a blank or mixed provider map.
12. As a 地图组件使用者, I want old search requests to be invalidated when the map service changes, so that stale results cannot appear after a provider switch.
13. As a 地图组件使用者, I want the search button hidden on private map services, so that the UI matches the actual absence of provider search capability.
14. As a 地图组件使用者, I want the search button restored when switching back to an online map service, so that search is available again without manual business logic.
15. As a 地图终端用户, I want provider search results to appear through the built-in toolbar search, so that searching feels consistent across providers.
16. As a 地图终端用户, I want provider search to use the current map service provider automatically, so that I never search one provider while viewing another provider's basemap.
17. As a 地图终端用户, I want provider search failures to keep the basemap available, so that a search permission problem does not break map browsing.
18. As a 地图终端用户, I want network and timeout failures to remain retryable, so that temporary issues do not look like permanent authorization failures.
19. As a 地图终端用户, I want search results normalized into a standard location result, so that downstream business UI sees one stable contract.
20. As a 业务系统接入开发者, I want all selected search coordinates delivered in WGS-84, so that I do not perform provider-specific coordinate conversion myself.
21. As a 业务系统接入开发者, I want the component to perform the one map recentering action internally, so that business callbacks do not need to fly the camera a second time.
22. As a 地图终端用户, I want search recentering to preserve the current camera height, so that choosing a place does not unexpectedly zoom me in or out.
23. As a 地图终端用户, I want selecting a search result not to create a temporary search marker by default, so that the map stays visually clean unless business adds its own marker.
24. As a 业务系统接入开发者, I want a dedicated search-result-selected callback, so that I can update business center coordinates after the component has already positioned the map.
25. As a 业务系统接入开发者, I want new `mapService` mode to reject old `onSearch` callbacks, so that search ownership is not split between business code and component code.
26. As a 业务系统接入开发者, I want old `baseMap`, `mapAuth`, `onSearch` and stepwise update APIs to remain available but deprecated during 1.x, so that existing integrations can migrate incrementally.
27. As a 业务系统接入开发者, I want mixed old and new configuration styles to fail clearly, so that there is no ambiguous precedence between them.
28. As a 业务系统接入开发者, I want unknown provider identifiers to fail as invalid config, so that the component never silently falls back to another provider.
29. As a 业务系统接入开发者, I want provider credentials trimmed and normalized by the component, so that accidental whitespace does not become a hidden integration failure.
30. As a 业务系统接入开发者, I want the component to centralize provider-specific request signatures, parameters and response parsing, so that those rules live in one place instead of every business page.
31. As a 业务系统接入开发者, I want the component to support injected proxy endpoints and request functions, so that browser-hostile provider APIs can still work behind an application gateway.
32. As a 地图组件维护者, I want provider-specific basemap and provider-search rules encapsulated behind one internal adapter seam, so that adding or modifying providers does not spread new conditionals across the plugin.
33. As a 地图组件维护者, I want the search normalization step to own source coordinate-system knowledge, so that raw provider coordinates are converted exactly once before becoming standard location results.
34. As a 地图组件维护者, I want Google POI search to use a real place-search product instead of address geocoding, so that Google behavior matches the product goal of provider search.
35. As a 地图组件维护者, I want basemap validation to avoid calling search APIs by default, so that validation cost stays low and its meaning stays precise.
36. As a 地图组件维护者, I want private map services to participate in map service switching without provider-search capabilities, so that offline and online modes share one lifecycle model.
37. As a 地图组件维护者, I want first initialization failure to surface an explicit error instead of silently changing providers, so that invalid configuration is visible and debuggable.
38. As a 地图组件维护者, I want search capability guidance to remain available before the first real search, so that product teams can explain enablement requirements without custom documentation logic.
39. As a 地图组件维护者, I want late provider responses from previous generations ignored, so that asynchronous races never contaminate the committed map service state.
40. As a 地图组件维护者, I want tests focused on public contracts and adapter seams, so that the feature can evolve internally without brittle implementation-detail tests.
41. As a 发布维护者, I want migration and API docs updated together with the feature, so that 1.x consumers know how to adopt `mapService` and which legacy APIs are deprecated.
42. As a 发布维护者, I want the feature to ship as a backward-compatible 1.x minor update, so that consumers can adopt the new contract before the next major cleanup.

## Implementation Decisions

- `mapService` becomes the only public source of truth for the current 地图服务配置 in the new flow. Online providers use `provider/serviceKey/secureKey`; private maps use `provider/offlineMapUrl`.
- The accepted standard providers are 天地图、 高德、百度、腾讯、Google and 私有地图. Unknown provider values are treated as `INVALID_CONFIG`; there is no silent fallback to another provider.
- The component continues to support 1.x compatibility inputs for `baseMap`, `mapAuth`, legacy search callbacks and stepwise update methods, but new and old configuration styles may not be supplied together in the same integration path.
- Default 底图类型 remains an internal concern of the component. Each provider receives a provider-specific default, and old explicit basemap-type configuration remains available only for compatibility and layer-switching behavior.
- A dedicated map-service manager layer owns normalization, validation, committed state, prepared state and atomic replacement. It coordinates basemap resources, provider-search capability state and toolbar availability as one unit.
- Provider-specific logic is consolidated behind one internal adapter contract. Each adapter is responsible for default basemap creation, basemap validation, provider-search requirement metadata, provider-search request construction and provider-response normalization.
- The internal adapter seam is the highest preferred feature seam. Public callers should not receive provider-specific adapters or provider-specific response shapes.
- Credential normalization trims whitespace and resolves provider-specific field usage inside the component. 天地图 consumes `serviceKey/secureKey`, 高德 consumes WebService-oriented `serviceKey/secureKey`, 百度、腾讯、Google only consume `serviceKey`, and 私有地图 consumes no public-provider credential fields.
- `validateMapService()` defaults to basemap validation only. Its `ok` result describes whether the current basemap validation passed, not whether provider search is enabled.
- Validation returns structured capability data for both basemap and provider search. Search capability starts as `notChecked` by default and includes `requiresEnablement`, optional product metadata, official setup links and user-facing explanatory text.
- Basemap validation uses the lightest provider-specific capability probe that still reflects real basemap availability. It does not attempt to infer search permissions from basemap success.
- For providers whose current basemap implementation does not actually consume the provided credentials, validation may report basemap reachability while explicitly marking that credentials were not truly verified.
- Provider search becomes component-owned behavior. The toolbar search flow resolves the current online provider from the committed 地图服务配置, dispatches through the matching adapter, normalizes raw results and returns only 标准位置结果.
- 标准位置结果 always uses WGS-84 longitude and latitude. Raw provider coordinates may be carried internally only long enough to pass through one centralized normalization step.
- Google search is aligned to a real provider-search product and uses Places API (New) Text Search semantics rather than address-geocoding semantics.
- High-risk provider details such as URL patterns, signatures, field masks, proxy requirements and provider-specific error mapping remain implementation details behind the adapter layer and component-owned requester boundary.
- The component accepts optional injected endpoints and request functions for provider-search calls so applications can route through their own proxy or gateway without taking back ownership of search logic.
- `setMapService()` performs validation and resource preparation before committing anything. The commit swaps provider identity, credentials, basemap resources, provider-search adapter and capability state in one step.
- If `setMapService()` fails, the previous committed basemap, provider-search behavior and capability state remain in effect. The failed switch may report a structured result, but it does not partially mutate runtime state.
- Every map-service switch advances a generation token. In-flight provider-search requests from older generations are discarded and never restored, even if the switch later fails and the old basemap remains visible.
- Switching to a 私有地图服务 hides provider search entirely. Switching from private back to online restores provider search in a `notChecked` state until actual search behavior provides fresher information.
- New `mapService` mode rejects legacy component-owned-search overrides such as business `onSearch` hooks, because those callbacks would split ownership of provider search and standard location results.
- Search interactions do not auto-select the first result. The user still chooses a result explicitly through the toolbar UI.
- After a user selects a provider-search result, the component performs one camera recentering action itself, preserving the existing camera height and updating only the center position.
- Search selection emits one business callback carrying the 标准位置结果 after the component has already completed its own positioning step. Business code should consume the result, not reposition the camera again.
- The feature does not add default temporary search markers. Visual search-result marking remains a separate business concern.
- Online provider search uses national scope by default and may use the current viewport only as a soft relevance signal where a provider supports it. Hard region clipping is not introduced in the first version.
- Error mapping keeps invalid config, invalid credentials, network failures, provider service failures, client restrictions and proxy requirements distinct so the toolbar and config page can present useful remediation guidance.
- Private map services stay within the same runtime lifecycle as online providers, but they expose no provider-search capability and require no provider-product guidance.
- Documentation and migration guidance are treated as part of the feature contract. Legacy API deprecations, mixed-config rejection and provider-specific enablement requirements must be documented alongside the new API.

## Testing Decisions

- Good tests for this feature assert external behavior and stable contracts rather than private state, temporary variables or incidental request implementation details.
- The highest automated seam is the internal map-service manager plus provider-adapter boundary. Tests at that seam should validate normalized inputs, structured capability outputs, switch commit behavior, rollback behavior and generation-based invalidation without depending on Cesium rendering details.
- Provider adapter tests should cover request construction, credential-field interpretation, provider error mapping, search requirement metadata and raw-result normalization for each supported provider.
- Search normalization tests should verify that 百度 BD-09、高德/腾讯 GCJ-02 and 天地图/Google WGS-84 inputs become WGS-84 exactly once before leaving the component.
- Basemap-validation tests should verify that default validation does not call provider-search APIs and that basemap success does not imply search availability.
- Runtime switching tests should verify atomic `setMapService()` success and failure behavior, including no partial state commit, no blank-map regression and old-request invalidation.
- Toolbar integration tests should verify that private map services hide search, online services restore search, new `mapService` mode rejects legacy search callbacks and result selection emits only the standardized callback contract.
- Search-interaction tests should verify that user selection triggers one internal recentering action, preserves camera height and exposes only standardized WGS-84 coordinates to business callbacks.
- Capability-state tests should verify `notChecked`, `available`, `unavailable` and `unknown` transitions where applicable, including retryable network failures and non-retryable configuration failures.
- Compatibility tests should verify that legacy `baseMap`/`mapAuth` integrations still work in 1.x when used alone, and that mixed legacy-plus-`mapService` configurations fail deterministically.
- Prior art in the repository includes the current provider-search service, the basemap registry, coordinate conversion utilities, toolbar search wiring and overlay-service tests that already favor observable behavior. New tests should extend those seams instead of introducing lower-level brittle assertions.
- Real-provider acceptance runs may be added behind environment-controlled credentials, but CI should rely on fixed samples, injected request doubles and deterministic contract assertions.
- Release verification should include type checking, automated tests, build output and manual validation of at least one online provider switch, one private-map switch, one failed switch rollback and one standardized search-selection callback path.

## Out of Scope

- Removing legacy `baseMap`, `mapAuth`, `onSearch`, `onSelect`, `setMapAuth()`, `updateMapAuth()` or `updateBaseMap()` in 1.x.
- Backporting the feature to older major lines.
- Letting business code take back ownership of provider-search URL construction, response parsing or coordinate conversion in the new `mapService` flow.
- Adding business-defined temporary search markers as part of the default component behavior.
- Hard region filtering or cross-provider search ranking customization beyond the first standardized provider-search flow.
- Adding new non-listed map providers in this feature.
- Changing application-level Vite, Nginx or gateway configuration inside the component package.
- Proving provider-search entitlement during default basemap validation.
- Introducing silent provider fallback when initialization or switching fails.

## Further Notes

- This spec follows the repository glossary: 地图服务配置 is the single provider-and-credential description, 地图服务校验 is not the same as provider-search enablement, 厂商地点搜索 is component-owned, and 标准位置结果 always means WGS-84 output for business consumers.
- The corresponding architecture decision is that the map component, not the business page, owns basemap/provider alignment, coordinate normalization and the single positioning action after search selection.
- The implementation should prefer evolving the existing basemap registry, provider-search service, coordinate service and toolbar integration rather than introducing a second parallel provider stack.
- Publishing this spec to an external issue tracker is not part of the current workspace automation, so the local spec document is the source artifact produced here.
