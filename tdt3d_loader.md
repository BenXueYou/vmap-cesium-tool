# 天地图三维地图加载逻辑梳理

## 1. 目标与范围

本文档梳理当前项目中 tdt3d（三维地图）在运行时的真实加载逻辑，覆盖：

- 初始化阶段如何加载 tdt3d
- 工具栏切换到 tdt3d 时如何重建图层
- 三维地形与三维路网（GeoWTFS）的创建与销毁
- 2D/3D 视图切换与 tdt3d 底图切换的关系
- 插件能力缺失时的降级行为

相关核心文件：

- src/core/MapPlugin.ts
- src/core/layers/TDTMapLayer.ts
- src/core/services/toolbar/config.ts
- src/core/services/toolbar/buttons/LayersButtonHandler.ts
- src/adapters/MapLoaderAdapter.ts
- src/core/types.ts

## 2. 关键配置模型

### 2.1 地图类型定义

在 src/core/types.ts 中，天地图类型已包含：

- vec
- img
- ter
- tdt3d

即 tdt3d 与二维底图处于同一 mapTypeId 体系，由统一图层切换逻辑处理。

### 2.2 工具栏中的 tdt3d 定义

在 src/core/services/toolbar/config.ts 的 DEFAULT_MAP_TYPES 中，tdt3d 具备以下能力描述：

- provider: createTDT3DImageryConfig
- terrainProvider: createTDT3DTerrainProvider
- geoWTFS: createTDT3DGeoWTFS
- forcePlaceName: true

这表示 tdt3d 是复合场景：影像 + 地形 + 三维路网，并强制开启地名注记开关语义。

## 3. 资源工厂层（TDTMapLayer）

资源创建集中在 src/core/layers/TDTMapLayer.ts：

### 3.1 影像

createTDT3DImageryConfig(token) 返回两层 UrlTemplateImageryProvider：

- img_w（影像底图）
- ibo_w（国界叠加）

### 3.2 地形

createTDT3DTerrainProvider(token) 逻辑：

1. 先检查 hasTDT3DExtension
2. 若缺失 GeoTerrainProvider 或 GeoWTFS，则 warning 并返回 null
3. 存在时创建 GeoTerrainProvider，服务地址为 mapservice/swdx?T=elv_c

### 3.3 三维路网

createTDT3DGeoWTFS(token, viewer) 逻辑：

1. 同样先做 hasTDT3DExtension 检查
2. 创建 GeoWTFS，配置 GetTiles/GetIcon、labelGraphics、billboardGraphics 等参数
3. 调用 initTDT(TDT_3D_INIT_TILES) 进行初始瓦片设置
4. 返回 wtfs 实例

## 4. 初始化阶段加载链路

入口通常有两条：

- 新接口：createMapPlugin(...).initialize()
- 兼容接口：initCesium(...)（内部转调 MapPlugin）

### 4.1 MapPlugin.initialize() 主流程

MapPlugin.initialize() 内与 tdt3d 相关的关键顺序：

1. 创建 Cesium.Viewer
2. 注册 scene.morphComplete 监听：回调中执行 syncGeoWTFS()
3. 调用 addLayers() 重建底图与地形
4. 再执行一次 syncGeoWTFS()（确保初次加载时状态一致）

### 4.2 addLayers() -> addTDTLayers()

当 layers.type 为 tdt：

1. 先清空 imageryLayers
2. 先 resetTerrainProvider() 回退为 EllipsoidTerrainProvider（防止残留上一次地形）
3. 进入 addTDTLayers(config)

在 addTDTLayers 中若 mapTypeId === tdt3d：

1. providers = createTDT3DImageryConfig(token)
2. applyTerrainProvider(createTDT3DTerrainProvider)
3. 若当前不是 SCENE3D，则 scene.morphTo3D(0)
4. 按 showLabel 规则决定是否裁剪注记层（tdt3d 同样受这套逻辑控制）
5. 把最终 providers 逐层 addImageryProvider

## 5. 运行时切换到 tdt3d

运行时主要由图层面板触发：

1. LayersButtonHandler 中点击地图类型卡片
2. 触发 onMapTypeChange(mapTypeId)
3. 回调到 MapPlugin.setMapType(mapTypeId)

MapPlugin.setMapType 的关键动作：

1. 更新 currentMapTypeId
2. mapType.forcePlaceName 为 true 时，强制 placeNameVisible = true
3. 调用 updateLayers(...)，将 layers.tdt.mapTypeId 更新为 tdt3d
4. updateLayers 在已初始化场景会执行 addLayers() + syncGeoWTFS()
5. setMapType 末尾再次执行 syncGeoWTFS()，确保路网状态与最终 mapType 对齐

结论：切换 tdt3d 的本质是一次完整的图层重建，而不是仅替换某个单独 provider。

## 6. GeoWTFS 生命周期

MapPlugin 内部通过以下方法管理三维路网：

- destroyGeoWTFS(): 释放旧实例（优先 destroy，其次 remove）
- syncGeoWTFS(): 根据当前条件决定是否创建新实例

syncGeoWTFS 的启用条件：

1. 当前 mapType 配置了 geoWTFS 工厂
2. forcePlaceName 为 true 或当前 placeNameVisible 为 true
3. scene.mode 必须为 SCENE3D

每次 sync 前会先 destroy 旧实例，避免重复叠加。

## 7. 2D/3D 按钮与 tdt3d 的关系

2D/3D 按钮（view2d3d）调用的是 mapController.toggle2D3D()，只做：

- morphTo2D
- morphTo3D

它不负责切换底图类型。

而 tdt3d 是图层类型切换行为，会触发 addLayers、terrainProvider 切换、GeoWTFS 同步。

两者关系：

- 选中 tdt3d 时会主动 morph 到 3D
- 手工点 2D/3D 按钮不会把 mapType 改成或改离 tdt3d
- morphComplete 事件会驱动 syncGeoWTFS，使路网与当前场景模式保持一致

## 8. 降级与容错

当 vendored 插件导出缺失（GeoTerrainProvider/GeoWTFS 不可用）时：

- createTDT3DTerrainProvider 返回 null
- createTDT3DGeoWTFS 返回 null
- 控制台 warning 提示当前 tdt3d 将仅加载影像底图

因此当前实现支持“影像可用、地形与三维路网降级不可用”的退化路径，不会因扩展缺失直接中断整个地图初始化流程。

## 9. 一句话总结

当前 tdt3d 加载逻辑已经是完整复合链路：

- 底图层面通过 mapTypeId=tdt3d 进入专用影像与地形工厂
- 场景层面强制进入 SCENE3D
- 注记层面通过 syncGeoWTFS 在场景/开关变化时动态创建与销毁
- 扩展能力缺失时自动降级为影像模式
