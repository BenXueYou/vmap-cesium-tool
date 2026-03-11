---
title: API
---

- [CesiumMapLoader（地图加载器）](/api/CesiumMapLoader_API)
- [CesiumMapToolbar （工具栏）](/api/CesiumMapToolbar_API)
- [DrawHelper/CesiumMapHelper（绘制工具）](/api/CesiumMapHelper_API)
- [CesiumOverlayService（覆盖物管理）](/api/CesiumOverlayService_API)
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
- [PointClusterLayer（点聚合）](/api/CesiumPointClusterLayer_API)

## 顶层导入示例

```ts
import { MapMarker, MapCircle } from '@xingm/vmap-cesium-toolbar';

const markerTool = new MapMarker(viewer);
const circleTool = new MapCircle(viewer);

markerTool.add({
	position: [116.3974, 39.9093],
	pixelSize: 10,
});

circleTool.add({
	position: [116.3974, 39.9093],
	radius: 800,
});
```
