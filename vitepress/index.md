---
layout: home

title: vmap-cesium-tool 文档

hero:
  name: vmap-cesium-tool
  text: 重构后的 Cesium 地图插件文档
  tagline: 以 MapPlugin 为核心，统一管理地图、工具栏、覆盖物与绘制能力
  actions:
    - theme: brand
      text: 架构说明
      link: /guide/Architecture
    - theme: alt
      text: 迁移指南
      link: /guide/Migration_Guide

features:
  - title: 新架构优先
    details: 先理解 MapPlugin、服务层和兼容适配层的职责边界，再进入具体 API。
  - title: 迁移路径清晰
    details: 提供从 initCesium、CesiumMapToolbar、CesiumOverlayService、DrawHelper 迁移到新入口的对应关系。
  - title: 兼容参考保留
    details: 旧 API 文档继续保留，用于过渡期比对和排查；新项目应优先采用新入口。
---

## 快速开始

推荐从下面三个入口阅读。

- [架构说明](/guide/Architecture)
- [迁移指南](/guide/Migration_Guide)
- [API 目录](/api/)

## 新架构速览

重构后公开能力分成三层。

1. 新 API：`createMapPlugin`、`MapPlugin`、`ToolbarService`、`OverlayService`、`DrawService`
2. 实体与图层：`Marker`、`Polygon`、`PointClusterLayer` 等独立能力
3. 兼容 API：`initCesium`、`CesiumMapToolbar`、`CesiumOverlayService`、`DrawHelper`

## 现有文档内容

### 推荐阅读

- [架构说明](/guide/Architecture)
- [迁移指南](/guide/Migration_Guide)
- [GeoJSON 使用说明](/guide/GeoJSON_Usage)
- [多语言（i18n）使用说明](/guide/I18n_Usage)
- [i18n API](/api/I18n_API)

### 兼容 API 参考

- [CesiumMapLoader（地图加载器）](/api/CesiumMapLoader_API)
- [CesiumMapToolbar（工具栏）](/api/CesiumMapToolbar_API)
- [DrawHelper（CesiumMapHelper 绘制）](/api/CesiumMapHelper_API)
- [CesiumOverlayService（覆盖物）](/api/CesiumOverlayService_API)
- [PointClusterLayer（点聚合）](/api/CesiumPointClusterLayer_API)

## 常见问题

- 新项目应该从哪里开始：先看“架构说明”，再看“迁移指南”或 API 目录。
- 旧 API 还能不能用：还能用，但当前定位是 compat 适配层，不建议新业务继续新增依赖。
- 渲染偶现 `Rendering has stopped` / `NaN render error`：见 `CesiumMapLoader API` 中的“自动恢复（最小接入示例）”。
