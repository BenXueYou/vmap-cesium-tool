职责划分

core
目标职责：稳定内核、类型系统、实体模型、地图主编排。
包含内容：

MapPlugin.ts:1：唯一地图插件主入口，负责 viewer 生命周期和服务装配。
types.ts:1：唯一类型源。
constants.ts:1：唯一默认配置源。
entities：覆盖物实体模型。
layers：地图图层 provider 封装。
原则：
不依赖 libs
不承载兼容逻辑
不直接暴露历史 API 形态
components
目标职责：纯 UI 基元，不关心业务状态来源。
包含内容：

BaseComponent.ts:1
Toolbar.ts:1
ToolbarButton.ts:1
SearchBox.ts
原则：
只处理 DOM、样式、交互表现
不感知 Cesium 业务对象
不直接访问 legacy service
services
目标职责：业务能力服务层。
包含内容：

toolbar
overlay
draw
原则：
依赖 core/types、core/entities、components
不依赖 libs
对外提供稳定能力边界
adapters
目标职责：旧 API 到新架构的桥。
包含内容：

DrawHelperAdapter.ts:1
OverlayServiceAdapter.ts:1
后续应新增：
MapLoaderAdapter
ToolbarAdapter
原则：
允许依赖 core/services
允许暴露旧方法名
不允许把 libs 直接重新导出给最终用户
libs
目标职责：遗留实现冻结区。
当前用途：

给 adapter 提供迁移参考
作为过渡版本行为基准
最终状态：
不再作为公共 API 面的一部分
仅内部保留一到两个版本周期
原则：
不新增功能
只修阻塞迁移的兼容 bug
不再扩展类型定义和默认配置
依赖方向约束

建议固定成这条链：

core 可以依赖 core/*
components 可以依赖 core/types
services 可以依赖 core 和 components
adapters 可以依赖 services 和少量 libs 参考
libs 不反向依赖 core/services
禁止的方向：

core 依赖 libs
components 依赖 libs
services 直接引用 libs 里的运行时实现
index.ts 同时直接暴露 core 和 libs 同名能力
对外 npm 包交付策略

最终 npm 包只保留三层导出：

新 API

createMapPlugin
MapPlugin
ToolbarService
OverlayService
DrawService
兼容 API

只通过 adapters 暴露
名称上显式标注 legacy 或 compat
类型与常量

全部从 core/types 和 core/constants 汇总导出
过渡期建议：

当前版本：继续保留旧 API，但在文档和类型注释中标 @deprecated
下一个 minor：旧 API 只走 adapter，不再直出 libs
下一个 major：移除 libs 公共导出
迁移路径

先把“旧实现直出”改成“adapter 直出”
再让 MapPlugin 接管 ToolbarService
再把业务 demo 从旧 API 改到新 API
最后移除公共导出中的 libs
可执行重构任务清单

P0：先收敛公共 API 面

改 index.ts:1
目标：

保留唯一正式公共入口
去掉对 libs 的直接公共导出
去掉默认导出对象中的大规模顶层 await import
具体改法：
删除 index.ts:127 和 index.ts:128 的旧实现直出
删除 index.ts:158 到 index.ts:206 的默认聚合对象，改为纯命名导出
新增 compat 命名导出区，仅暴露 adapter
结果：
包入口清晰
bundler 兼容性更好
API surface 可控
处理 entry.ts:1
目标：

消除双入口并存
具体改法：
如果 package.json 未使用它，直接废弃或删除
如果外部仍引用它，则改成简单 re-export from index.ts
结果：
对外入口唯一
P0：建立真正的兼容层，而不是继续暴露 legacy 实现

新增 Toolbar 兼容适配器
目标：

把 CesiumMapToolbar 的公共旧 API 映射到新 ToolbarService
文件：
新建 src/adapters/ToolbarAdapter.ts
具体改法：
对齐旧的构造参数风格
内部转调 ToolbarService
兼容 setTDToken、setInitialCenter、resetToInitialLocation、按钮更新等方法
结果：
迁移从“旧类继续用”变成“旧接口映射到新实现”
新增 MapLoader 兼容适配器
目标：

把 initCesium 平滑映射到 createMapPlugin
文件：
新建 src/adapters/MapLoaderAdapter.ts
具体改法：
输入仍接受旧 InitOptions
内部转换为 MapPluginOptions
返回结构维持 { viewer, initialCenter }
结果：
外部先不改调用形式，也能跑在新内核上
P0：把 MapPlugin 升级为真正的插件编排中心

改 MapPlugin.ts:1
目标：

从 viewer wrapper 升级为 plugin kernel
具体改法：
在 MapPluginOptions 中新增 services 配置段
增加私有字段：
toolbarService
overlayService
drawService
增加方法：
createToolbarService
getToolbarService
getOverlayService
getDrawService
在 destroy() 中先销毁 service，再销毁 viewer
结果：
新 API 有统一主控
demo 层不再自己拼 service 生命周期
改 types.ts:1
目标：

为 MapPlugin 增加服务装配配置
具体改法：
扩展 MapPluginOptions
新增 ToolbarPluginOptions、OverlayPluginOptions、DrawPluginOptions
明确哪些字段是 public API，哪些是 compat only
结果：
类型定义支撑主编排模型
P0：补齐新架构里已经承诺但未落地的能力

改 OverlayService.ts:241
目标：

完成 hover 和 click 交互
具体改法：
从旧版 CesiumOverlayService 迁移最小必要逻辑
建立 Entity -> OverlayInstance 映射
实现点击节流
实现 hover highlight 与 click callback
结果：
新 OverlayService 行为闭环成立
改 index.ts:101
目标：

补完 DOM 绑定能力
具体改法：
bindElement 记录 data-i18n-key 和 data-i18n-attr
updateTree 遍历子树重刷绑定文案
结果：
Toolbar 菜单、按钮标题切语言时可正常刷新
P1：收口类型与默认配置

改 CesiumMapModel.ts
目标：

彻底退化为 type re-export
具体改法：
只从 core/types 重导出
不再维护自己的独立类型实现
结果：
唯一类型源成立
改 CesiumMapConfig.ts:1
目标：

停止维护存根地图类型
具体改法：
直接复用 constants.ts:172 的 DEFAULT_MAP_TYPES
或至少把字段补齐到和 MapType 一致
结果：
不再出现 thumbnail 缺失和 provider 空实现漂移
改 MapToolBarConfig.ts:1
目标：
旧默认按钮不再单独维护
具体改法：
改为从 constants.ts:42 和 constants.ts:150 映射导出
结果：
按钮配置单源化
P1：让 Toolbar 组件真正可扩展

改 Toolbar.ts:1
目标：
去掉部分写死布局
具体改法：
在 ToolbarConfig 中新增：
padding
direction
offsetTop
offsetRight
offsetBottom
offsetLeft
替换 Toolbar.ts:31 和 Toolbar.ts:102 的固定 padding: '8px'
让位置不只依赖四个枚举角，还支持 offset 配置
结果：
样式可配置能力更完整
改 ToolbarButton.ts:1
目标：
统一 icon、activeIcon、状态表现
具体改法：
提取 icon 解析逻辑为内部公共方法
明确图片 icon 与文字 icon 的尺寸策略
激活/非激活状态避免直接覆盖用户自定义样式
结果：
按钮行为更稳定，主题化更容易
P1：补齐 ToolbarService 的服务化设计

改 ToolbarService.ts:1
目标：
让 ToolbarService 成为真正的服务编排层
具体改法：
把当前 mapController 的 contract 抽成正式 interface
把菜单开关、按钮注册、默认按钮集拆成更清晰的小模块
增加 updateToolbarStyle() 方法，避免业务重新初始化
结果：
Toolbar 可持续扩展
改 LayersButtonHandler.ts:1
目标：
让 layers 菜单从“简易列表”升级为可复用面板
具体改法：
支持 thumbnail 展示
支持选中态 UI
把 no-fly-zone 选项和 mapTypes 分成两个明确 section
结果：
更符合未来 npm 包的 UI 输出预期
P1：修复旧 compat 空实现，避免过渡期运行时失效

改 CesiumMapController.ts:1
目标：
至少补齐过渡期必要功能
具体改法：
实现 setInitialCenter
实现 getInitialCenter
实现 resetLocation
实现 toggleFullscreen
实现基本缩放限制监听
结果：
旧业务不会因空实现而悄悄失效
检查并补全这些 legacy service
MapLayersService.ts
MapSearchService.ts
NotFlyZonesService.ts
MeasurementService.ts
目标：
如果 adapter 还要依赖它们，至少不能是存根
结果：
过渡版本窗口期可用
P2：文档和示例同步迁移

改 App.vue:1
目标：
把 demo 变成新架构标准样板
具体改法：
用 createMapPlugin + ToolbarService
不再示范旧 initCesium + CesiumMapToolbar
结果：
仓库示例引导正确
改 README.md
目标：
改写对外推荐用法
具体改法：
首页示例只展示新 API
新增“兼容迁移指南”
标出旧 API 弃用时间线
结果：
npm 包用户不会继续走旧路
改 doc 下 API 文档
目标：
文档结构和架构一致
具体改法：
新增 “Architecture” 和 “Migration Guide”
将旧 API 移到 legacy 章节
结果：
文档即迁移路线图
建议的里程碑

M1：公共 API 收口

完成 index.ts
处理 entry.ts
建立 compat adapter 暴露面
M2：核心服务闭环

MapPlugin 接管 Toolbar/Overlay/Draw
OverlayService 补齐 click/hover
i18n DOM 刷新落地
M3：兼容版本发布

外部旧 API 仍可用
官方文档只推荐新 API
发布一次过渡 minor
M4：移除 legacy 公共导出

major 版本删除旧入口
libs 彻底内聚到内部
你现在最值得先做的 5 个文件

index.ts
MapPlugin.ts
adapters
OverlayService.ts
index.ts