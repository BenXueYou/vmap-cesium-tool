---
title: 使用说明
---

- [架构说明](/guide/Architecture)
- [迁移指南](/guide/Migration_Guide)
- [Overlay Selection 与重叠拾取](/guide/Overlay_Selection_Guide)
- [12,000 Overlay 性能验收](/guide/Overlay_Selection_Performance_Acceptance)
- [标绘、绘制与编辑](/guide/Mark_Draw_Edit_Guide)
- [多厂商地图接入](/guide/Multi_Map_Provider_Guide)
- [GeoJSON](/guide/GeoJSON_Usage)
- [多语言（i18n）](/guide/I18n_Usage)

## 相关 API

- [i18n API](/api/I18n_API)
- [多厂商与坐标 API](/api/MapProvider_API)
- [MarkService / CesiumMapMark API](/api/MarkService_API)

## 建议阅读顺序

1. 先看“架构说明”，理解 `core / components / services / adapters / libs` 的职责边界
2. 再看“迁移指南”，确定旧 API 到新 API 的替换路径
3. 再看“标绘、绘制与编辑”，确认 rectangle、work area、编辑链路的约定
4. 涉及多底图、离线瓦片或坐标转换时，查看“多厂商地图接入”
5. 最后按需查看 GeoJSON、多语言等专题能力
