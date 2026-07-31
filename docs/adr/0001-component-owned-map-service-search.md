# 由地图组件统一拥有地图服务与厂商地点搜索

业务系统此前分别组装 `baseMap`、厂商嵌套 `mapAuth`、连通性请求和搜索选中后的相机定位，导致厂商选择存在多个数据源，并允许业务绕过坐标归一化。我们决定新增以 `mapService` 为唯一厂商来源的接口，由地图组件统一负责底图厂商适配、前端凭证处理、厂商地点搜索、坐标归一化和唯一一次定位；对外搜索结果始终使用 WGS-84，业务只接收选择通知并更新业务中心点。

`mapService` 对在线厂商使用 `provider/serviceKey/secureKey`，对私有地图使用 `provider/offlineMapUrl`。底图类型由组件按厂商选择默认值。`validateMapService()` 默认只验证底图能力，搜索作为独立能力返回 `notChecked` 及开通提示；`setMapService()` 采用异步原子更新，失败保留旧地图并使旧搜索请求失效。高德 WebService 签名在前端组件内闭环，Google 地点搜索使用 Places API (New) Text Search。

## Consequences

- 1.x 保留旧 `baseMap/mapAuth/onSearch/onSelect` 入口并标记废弃，但禁止与新 `mapService` 混用；下一主版本删除旧入口。
- 应用仍可提供同源搜索代理端点，因为组件不能配置应用的 Vite、Nginx 或网关。
- 高德、百度、腾讯当前裸瓦片不使用传入的服务密钥，基础校验只能证明底图可达，不能宣称凭证或搜索能力已经验证。
- 私有地图自动隐藏搜索；在线地图首次搜索时检查搜索能力，未授权只影响搜索，不破坏底图。
- 首次初始化失败不会静默切换到其他厂商。
