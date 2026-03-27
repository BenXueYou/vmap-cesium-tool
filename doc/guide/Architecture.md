---
title: 架构说明
---

# 架构说明

## 重构目标

这次重构的核心目标，是把地图初始化、服务装配、UI 组件和旧 API 兼容逻辑拆开，避免继续在一个入口里同时承载新旧实现。

公开层面现在优先推荐两类能力：

1. 以 `MapPlugin` 为中心的插件内核
2. 以 `ToolbarService`、`OverlayService`、`DrawService` 为中心的服务层

## 分层结构

### core

职责：稳定内核、类型系统、实体模型、地图主编排。

包含内容：

- `MapPlugin`：Viewer 生命周期与服务装配中心
- `types`：唯一类型源
- `entities`：覆盖物实体模型
- `layers`：地图图层 provider 封装

原则：

- 不依赖 `libs`
- 不承载兼容逻辑
- 不直接暴露历史 API 形态

### components

职责：纯 UI 基元，不关心业务状态来源。

包含内容：

- `Toolbar`
- `ToolbarButton`
- `SearchBox`

原则：

- 只处理 DOM、样式、交互表现
- 不感知 Cesium 业务对象
- 不直接访问 legacy service

### services

职责：业务能力服务层。

包含内容：

- `ToolbarService`
- `OverlayService`
- `DrawService`

原则：

- 依赖 `core` 和 `components`
- 不直接依赖 `libs` 的运行时实现
- 对外提供稳定能力边界

### adapters

职责：旧 API 到新架构的桥。

当前公开兼容入口：

- `initCesium`
- `CesiumMapToolbar`
- `CesiumOverlayService`
- `DrawHelper`

原则：

- 允许依赖 services
- 允许保留旧方法名
- 不再把 `libs` 直接重新导出给最终用户

### libs

职责：遗留实现冻结区。

当前用途：

- 给 adapter 提供迁移参考
- 作为过渡版本行为基准

原则：

- 不新增功能
- 只修阻塞迁移的兼容问题
- 不再扩展类型定义和默认配置

## 推荐依赖方向

建议遵循下面这条链路：

- `core` 只依赖 `core/*`
- `components` 可以依赖 `core/types`
- `services` 可以依赖 `core` 和 `components`
- `adapters` 可以依赖 `services`
- `libs` 不反向依赖 `core/services`

## 公开 API 面

### 新 API

- `createMapPlugin`
- `MapPlugin`
- `ToolbarService`
- `OverlayService`
- `DrawService`

### 类型与实体

- `MapPluginOptions`
- `ToolbarConfig`
- `LayersConfig`
- `Marker`、`Polygon`、`Circle` 等实体类
- `HeatmapLayer`、`PointClusterLayer` 等图层能力

### 兼容 API

以下导出仍可使用，但只用于迁移窗口：

- `initCesium`
- `CesiumMapToolbar`
- `CesiumOverlayService`
- `DrawHelper`

## MapPlugin 在新架构中的位置

`MapPlugin` 现在不是一个简单的 Viewer 包装器，而是插件内核。

它负责：

- 创建和销毁 `Cesium.Viewer`
- 按 `services` 配置装配工具栏、覆盖物和绘制服务
- 暴露 `getToolbarService()`、`getOverlayService()`、`getDrawService()`
- 统一处理图层切换、初始视角、无飞区和工具栏联动

典型用法如下：

```ts
import { createMapPlugin } from '@xingm/vmap-cesium-toolbar';

const mapPlugin = createMapPlugin('cesiumContainer', {
  camera: {
    center: [116.3974, 39.9093, 1000],
    pitch: -45,
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
    toolbar: { enabled: true },
    overlay: true,
    draw: true,
  },
});

await mapPlugin.initialize();

const toolbarService = mapPlugin.getToolbarService();
const overlayService = mapPlugin.getOverlayService();
const drawService = mapPlugin.getDrawService();
```

## 生命周期建议

推荐把 Viewer 和服务生命周期都交给 `MapPlugin` 管理。

建议：

1. 初始化时统一调用 `await mapPlugin.initialize()`
2. 运行中通过 `getToolbarService()`、`getOverlayService()`、`getDrawService()` 获取能力
3. 卸载时只调用一次 `mapPlugin.destroy()`

这样可以避免旧架构下“业务自己拼装多个 service，分别销毁”的状态漂移问题。