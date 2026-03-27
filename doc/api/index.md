---
title: API
---

## VMap Cesium Toolbar API 文档 (新架构 v2.0.0)

基于全新模块化架构的 API 文档。当前文档页已经完成“新架构说明”和“兼容 API 参考”的切换，新的逐项 API 页面会继续补齐。

## 推荐入口

- [架构说明](/guide/Architecture) - 先了解重构后的模块边界和依赖方向
- [迁移指南](/guide/Migration_Guide) - 查看旧 API 与新 API 的替换关系

## 新架构顶层导出

- `createMapPlugin`
- `MapPlugin`
- `ToolbarService`
- `OverlayService`
- `DrawService`
- `Marker`、`Label`、`Icon`、`SVG`、`InfoWindow`、`Polyline`、`Polygon`、`Rectangle`、`Circle`、`Ring`
- `HeatmapLayer`、`PointClusterLayer`
- `Toolbar`、`ToolbarButton`、`SearchBox`

## 当前可直接查看的 API 页面

### 新架构服务与内核

- [MapPlugin（地图插件内核）](/api/MapPlugin_API)
- [ToolbarService（工具栏服务）](/api/ToolbarService_API)
- [OverlayService（覆盖物服务）](/api/OverlayService_API)
- [DrawService（绘制服务）](/api/DrawService_API)

### 兼容层 API

- [CesiumMapLoader（地图加载器）](/api/CesiumMapLoader_API)
- [CesiumMapToolbar（工具栏）](/api/CesiumMapToolbar_API)
- [DrawHelper / CesiumMapHelper（绘制）](/api/CesiumMapHelper_API)
- [CesiumOverlayService（覆盖物）](/api/CesiumOverlayService_API)

### 实体与图层参考

- [PointClusterLayer（点聚合）](/api/CesiumPointClusterLayer_API)
- [MapMarker（点标记）](/api/MapMarker_API)
- [MapLabel（文本标签）](/api/MapLabel_API)
- [MapIcon（图标）](/api/MapIcon_API)
- [MapSVG（SVG 图标）](/api/MapSVG_API)
- [MapInfoWindow（信息窗）](/api/MapInfoWindow_API)
- [MapPolyline（折线）](/api/MapPolyline_API)
- [MapPolygon（多边形）](/api/MapPolygon_API)
- [MapRectangle（矩形）](/api/MapRectangle_API)
- [MapCircle（圆）](/api/MapCircle_API)
- [MapRing（圆环）](/api/MapRing_API)

## 兼容导出说明

下列导出仍然保留，但它们现在通过 adapters 暴露，定位是兼容层：

- `initCesium`
- `CesiumMapToolbar`
- `CesiumOverlayService`
- `DrawHelper`

## 顶层导入示例

```ts
import { 
  createMapPlugin,
  ToolbarService,
  OverlayService,
  DrawService,
  Marker,
} from '@xingm/vmap-cesium-toolbar';

const plugin = createMapPlugin('cesiumContainer', {
  camera: {
    center: [116.3974, 39.9093, 1000],
    pitch: -45,
    heading: 0,
  },
  layers: {
    type: 'tdt',
    tdt: {
      mapTypeId: 'img',
      token: 'your-tianditu-token',
      showLabel: true,
    },
  },
  services: {
    toolbar: {
      enabled: true,
    },
    overlay: true,
    draw: true,
  },
});

const viewer = await plugin.initialize();

const toolbarService: ToolbarService | null = plugin.getToolbarService();
const overlayService: OverlayService = plugin.getOverlayService();
const drawService: DrawService = plugin.getDrawService();

const marker: Marker = overlayService.addMarker({
  position: [116.3974, 39.9093],
  pixelSize: 12,
  color: '#ff4d4f',
});

overlayService.addPolyline({
  positions: [[116.3, 39.9], [116.4, 39.9]],
  width: 3,
  color: '#1677ff',
});

drawService.startDrawingPolygon({
  lineColor: '#1677ff',
  fillColor: 'rgba(22, 119, 255, 0.20)',
  clampToGround: true,
});

console.log(marker.getId());
console.log(Boolean(toolbarService));
console.log(viewer.scene.mode);
```

如果你仍在迁移旧项目，请把 compat 用法放到 [迁移指南](/guide/Migration_Guide) 和对应 compat API 页面中查看；API 首页示例默认只展示新架构写法。
