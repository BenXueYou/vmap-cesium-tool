# 多语言（i18n）使用说明

## 概述

库内置一个轻量 i18n 实现，默认包含 `zh-CN` / `en-US` 两套文案。发布为插件时建议：

- **默认不持久化**（避免污染宿主系统的本地存储）
- **允许注入词典**（自定义业务文案）
- **可关闭 i18n**（完全使用纯文本）

## 基本用法

```ts
import { i18n, CesiumMapToolbar } from 'vmap-cesium-tool';

// 建议：插件/库默认不持久化
i18n.configure({
  persist: false,
  useStoredLocale: false,
});

// 切换语言
i18n.setLocale('en-US');

const toolbar = new CesiumMapToolbar(viewer, container, {
  useI18n: true,
  i18n
});
```

## 注入自定义词典

```ts
i18n.addMessages('en-US', {
  toolbar: { search: 'Search' },
  layers: { title: 'Map types' }
}, { merge: true });

// 如需覆盖默认文案，请保持同一 key
i18n.addMessages('zh-CN', {
  toolbar: { search: '自定义搜索' }
}, { merge: true });
```

说明：

- `merge: true` 会深度合并到当前语言的现有词典
- 不传 `merge` 时会直接替换该语言已注册的词典

## 关闭 i18n

```ts
const toolbar = new CesiumMapToolbar(viewer, container, {
  useI18n: false
});
```

## 持久化语言（可选）

```ts
// 启用本地存储
i18n.configure({ persist: true, useStoredLocale: true });

// 切换时可单次覆盖
i18n.setLocale('zh-CN', { persist: true });
```

## 关键 API

- `i18n.configure({ persist, useStoredLocale })`
- `i18n.setLocale(locale, { persist? })`
- `i18n.addMessages(locale, dict, { merge? })`
- `i18n.onLocaleChange(callback)`
- `i18n.bindElement(element, key, attribute)`
- `i18n.updateTree(element)`
- `i18n.t(key, params?, locale?)`

## 与地图插件的关系

`src` 目录里和多语言直接相关的插件能力主要有三条链路：

### 1. ToolbarService / CesiumMapToolbar

- 工具栏按钮标题、图层菜单、测量菜单、搜索框占位文案都走 `i18n`
- 语言切换后，工具栏会通过 `onLocaleChange(...) + updateTree(...)` 自动刷新 DOM

`MapPlugin` 装配时，需要把 i18n 放在 `services.toolbar.config` 中：

```ts
import { createMapPlugin, i18n } from '@xingm/vmap-cesium-toolbar';

const mapPlugin = createMapPlugin('cesiumContainer', {
  services: {
    toolbar: {
      enabled: true,
      config: {
        useI18n: true,
        i18n,
      },
    },
  },
});
```

### 2. DrawService

- 绘制提示文案和测量标签文案走 `draw.hint.*`、`draw.measurement.*`
- `MapPlugin` 装配时，`DrawService` 的 i18n 放在 `services.draw`

```ts
const mapPlugin = createMapPlugin('cesiumContainer', {
  services: {
    draw: {
      enabled: true,
      useI18n: true,
      i18n,
    },
  },
});
```

### 3. 宿主业务主动翻译

插件外层业务也可以直接调用：

```ts
const message = i18n.t('overlay.marker_added', {
  lon: 120.13,
  lat: 30.24,
});
```

这类做法常见于：

- 搜索成功后的业务提示
- 覆盖物操作反馈
- Vue/React 页面上的语言切换面板

## 当前限制

根据 `src/i18n/index.ts` 的现有实现，需要注意：

1. 内置词典只有 `zh-CN` 和 `en-US`
2. `configure(...)` 当前没有 `fallbackLocale`、`locale` 之类配置项
3. 刷新页面时，`useStoredLocale` 只会恢复 `zh-CN` / `en-US`
4. 未命中的语言会回退到 `zh-CN`，未命中的 key 会直接返回 key 本身

更完整的接口和装配说明见 [i18n API](/api/I18n_API)。

## 绘制提示文案（CesiumMapDraw）

绘制过程中跟随鼠标的提示文案由 `DrawService` 使用内置 i18n 读取：

- `draw.hint.circle_start`
- `draw.hint.circle_radius`
- `draw.hint.rectangle_start`
- `draw.hint.rectangle_end`
- `draw.hint.finish_or_undo`
- `draw.hint.polygon_start`
- `draw.hint.polygon_add`
- `draw.hint.polygon_continue`
- `draw.hint.line_start`
- `draw.hint.line_add`
- `draw.hint.line_continue`
- `draw.hint.polygon_no_intersection`

如需自定义文案，可通过 `i18n.addMessages` 覆盖：

```ts
i18n.addMessages('zh-CN', {
  draw: {
    hint: {
      polygon_no_intersection: '多边形不允许自相交'
    }
  }
}, { merge: true });
```
