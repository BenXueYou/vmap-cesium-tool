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
  fallbackLocale: 'zh-CN'
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
});

// 如需覆盖默认文案，请保持同一 key
i18n.addMessages('zh-CN', {
  toolbar: { search: '自定义搜索' }
});
```

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

- `i18n.configure({ persist, useStoredLocale, fallbackLocale, locale })`
- `i18n.setLocale(locale, { persist? })`
- `i18n.addMessages(locale, dict)`
- `i18n.setFallbackLocale(locale)`
- `i18n.t(key, params?)`

## 绘制提示文案（CesiumMapDraw）

绘制过程中跟随鼠标的提示文案已下沉到 libs i18n：

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
});
```
