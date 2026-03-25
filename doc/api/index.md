---
title: API
---

# VMap Cesium Toolbar API 文档 (新架构 v2.0.0)

基于全新模块化架构的 API 文档。新架构采用 `core/components/services` 分层设计，提供更好的类型安全和开发体验。

## 核心模块

- [MapPlugin（地图插件）](/api/MapPlugin_API) - 主入口插件
- [OverlayService（覆盖物服务）](/api/OverlayService_API) - 覆盖物管理服务
- [DrawService（绘制服务）](/api/DrawService_API) - 绘制功能服务

## 实体模块

- [Marker（点标记）](/api/Marker_API)
- [Label（文本标签）](/api/Label_API)
- [Icon（图标）](/api/Icon_API)
- [SVG（SVG 图标）](/api/SVG_API)
- [InfoWindow（信息窗）](/api/InfoWindow_API)
- [Polyline（折线）](/api/Polyline_API)
- [Polygon（多边形）](/api/Polygon_API)
- [Rectangle（矩形）](/api/Rectangle_API)
- [Circle（圆）](/api/Circle_API)
- [Ring（圆环）](/api/Ring_API)

## 图层模块

- [HeatmapLayer（热力图层）](/api/HeatmapLayer_API)
- [PointClusterLayer（点聚合层）](/api/PointClusterLayer_API)

## 组件模块

- [Toolbar（工具栏组件）](/api/Toolbar_API)
- [SearchBox（搜索框）](/api/SearchBox_API)

## 适配器（向后兼容）

- [DrawHelper（绘制助手）](/api/DrawHelper_API) - 兼容旧版 DrawHelper
- [CesiumOverlayService（覆盖物服务）](/api/CesiumOverlayService_API) - 兼容旧版 CesiumOverlayService

## 顶层导入示例

```ts
import { 
  MapPlugin, 
  createMapPlugin,
  Marker, 
  Polyline,
  OverlayService,
  DrawService 
} from '@xingm/vmap-cesium-toolbar';

// 创建地图插件
const plugin = await createMapPlugin('cesiumContainer', config);

// 创建实体
const marker = new Marker(viewer, { position: [116.3974, 39.9093] });
const polyline = new Polyline(viewer, { positions: [[116.3, 39.9], [116.4, 39.9]] });

// 使用服务
const overlayService = new OverlayService(viewer);
overlayService.addOverlay(marker);
```
