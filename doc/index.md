---
layout: home

title: vmap-cesium-tool 文档

hero:
  name: vmap-cesium-tool
  text: Cesium 地图工具栏与覆盖物/绘制工具
  tagline: 使用 VitePress 构建的静态 API 文档站点
  actions:
    - theme: brand
      text: CesiumMapToolbar
      link: /api/CesiumMapToolbar_API
    - theme: alt
      text: CesiumOverlayService
      link: /api/CesiumOverlayService_API

features:
  - title: API 文档
    details: 与当前源码导出保持一致的 API 说明
  - title: 示例友好
    details: 提供常见用法与注意事项
  - title: 静态部署
    details: 可直接产出静态站点用于 GitHub Pages/内网部署
---

## 目录

- [CesiumMapToolbar（工具栏） API](/api/CesiumMapToolbar_API)
- [DrawHelper（CesiumMapHelper绘制）API](/api/CesiumMapHelper_API)
- [CesiumMapLoader（地图加载器） API](/api/CesiumMapLoader_API)
- [CesiumOverlayService（覆盖物） API](/api/CesiumOverlayService_API)
- [PointClusterLayer（点聚合）API](/api/CesiumPointClusterLayer_API)
- [GeoJSON 使用说明](/guide/GeoJSON_Usage)
- [多语言（i18n）使用说明](/guide/I18n_Usage)

## 常见问题

- 渲染偶现 `Rendering has stopped` / `NaN render error` 时的自动恢复：见 `CesiumMapLoader API` 中的“自动恢复（最小接入示例）”。
