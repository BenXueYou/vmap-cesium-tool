# i18n API 文档

## 概述

插件在 `src/i18n/index.ts` 中内置了一个轻量多语言实现，并在顶层导出为单例 `i18n`。

当前源码里的多语言能力主要覆盖三类场景：

- 工具栏按钮、菜单、搜索框占位文案
- 绘制服务的提示气泡、测距/测面标签
- 业务层主动调用 `i18n.t(...)` 输出消息文案

默认内置两套词典：

- `zh-CN`
- `en-US`

顶层导出：

```ts
import { i18n, type I18nLike } from '@xingm/vmap-cesium-toolbar';
```

## 源码中的接入位置

按 `src` 目录的实际实现，当前多语言链路如下：

### 1. i18n 核心模块

- `src/i18n/index.ts`
- `src/i18n/zh-CN.ts`
- `src/i18n/en-US.ts`

职责：

- 管理当前语言
- 注册和合并词典
- 执行 key 查询与参数插值
- 将文案绑定到 DOM 节点
- 在语言切换后批量刷新绑定节点

### 2. MapPlugin 装配层

- `src/core/MapPlugin.ts`
- `src/core/types.ts`

职责：

- 把 `services.toolbar.config.i18n` / `services.toolbar.config.useI18n` 传给 `ToolbarService`
- 把 `services.draw.i18n` / `services.draw.useI18n` 传给 `DrawService`

说明：

- `MapPlugin` 本身不直接提供翻译方法
- 它的作用是把多语言实例装配到工具栏和绘制服务

### 3. ToolbarService 与 compat 工具栏

- `src/core/services/toolbar/ToolbarService.ts`
- `src/adapters/ToolbarAdapter.ts`
- `src/libs/CesiumMapToolbar.ts`

职责：

- 通过 `bindElement(...)` 给按钮标题、菜单文本、占位符绑定 i18n key
- 通过 `onLocaleChange(...)` 监听语言切换
- 在切换后调用 `updateTree(...)` 自动刷新整个工具栏 DOM

### 4. DrawService

- `src/core/services/draw/DrawService.ts`
- `src/core/services/draw/labels/measurementLabelFactory.ts`
- `src/core/services/draw/labels/drawHint.ts`

职责：

- 为绘制提示气泡读取 `draw.hint.*`
- 为测距、测面标签读取 `draw.measurement.*`

### 5. 业务层手动调用

例如：

- `examples/vue3-usage/src/App.vue`
- `src/hooks/useOverlayHelper.ts`

职责：

- 在宿主业务里直接调用 `i18n.t(...)`
- 组合插件事件回调文案、提示消息、状态反馈

## 类型定义

```ts
interface I18nLike {
  t(key: string, params?: Record<string, any>, locale?: string): string;
  getLocale(): string;
  setLocale(locale: string, options?: { persist?: boolean }): void;
  onLocaleChange(callback: (locale: string) => void): () => void;
  addMessages(locale: string, messages: I18nMessages, options?: { merge?: boolean }): void;
  configure(config: I18nConfig): void;
  bindElement(element: HTMLElement, key: string, attribute: string): void;
  updateTree(element: HTMLElement): void;
}

interface I18nConfig {
  persist?: boolean;
  useStoredLocale?: boolean;
}
```

## 核心方法

### configure

```ts
configure(config: { persist?: boolean; useStoredLocale?: boolean }): void
```

用途：配置语言持久化策略。

字段说明：

- `persist`: 是否允许在 `setLocale(...)` 时写入 `localStorage`
- `useStoredLocale`: 是否在初始化或重新配置时优先读取本地已保存语言

示例：

```ts
i18n.configure({
  persist: false,
  useStoredLocale: false,
});
```

说明：

- 当前源码中 `configure(...)` 只支持 `persist` 和 `useStoredLocale`
- 文档或业务示例里不要传 `fallbackLocale`、`locale`、`setFallbackLocale(...)` 之类不存在的 API

### addMessages

```ts
addMessages(
  locale: string,
  messages: Record<string, any>,
  options?: { merge?: boolean },
): void
```

用途：注册或扩展某个语言的词典。

字段说明：

- `locale`: 语言标识，例如 `zh-CN`、`en-US`
- `messages`: 多语言对象
- `options.merge`: 为 `true` 时深度合并到已有词典；否则直接替换该语言词典

示例：

```ts
i18n.addMessages('en-US', {
  demo: {
    title: 'Toolbar demo',
  },
}, { merge: true });
```

说明：

- 如果你只是想覆盖默认内置文案，推荐传 `{ merge: true }`
- 不传 `merge` 时会整包替换该语言已注册内容

### t

```ts
t(key: string, params?: Record<string, any>, locale?: string): string
```

用途：根据 key 读取文案，并支持模板参数替换。

示例：

```ts
const text = i18n.t('overlay.marker_added', {
  lon: 120.13,
  lat: 30.24,
});
```

行为说明：

- 默认使用当前语言
- 传第三个参数时，可临时按指定语言查询
- 如果目标语言不存在，会回退到 `zh-CN` 词典对象
- 如果 key 仍不存在，直接返回 key 本身
- 插值格式为 `{name}`、`{value}` 这类占位符

### getLocale

```ts
getLocale(): string
```

返回当前语言。

### setLocale

```ts
setLocale(locale: string, options?: { persist?: boolean }): void
```

用途：切换当前语言，并触发语言变更订阅。

字段说明：

- `locale`: 目标语言
- `options.persist`: 当前这次切换是否写入本地存储

示例：

```ts
i18n.setLocale('en-US', { persist: false });
```

持久化规则：

- 当 `configure({ persist: true })` 后，`setLocale(...)` 默认会写入 `localStorage`
- 若本次调用传 `persist: false`，则跳过写入
- 即使全局未开启持久化，也可在单次调用中传 `persist: true`

### onLocaleChange

```ts
onLocaleChange(callback: (locale: string) => void): () => void
```

用途：监听语言切换，并返回取消订阅函数。

示例：

```ts
const unsubscribe = i18n.onLocaleChange((locale) => {
  console.log('locale changed:', locale);
});

unsubscribe();
```

### bindElement

```ts
bindElement(element: HTMLElement, key: string, attribute: string): void
```

用途：把 DOM 节点绑定到某个 i18n key。

常见属性：

- `textContent`
- `title`
- `innerHTML`
- 其他任意属性名，例如 `placeholder`

说明：

- 该方法会写入 `data-i18n-key` 和 `data-i18n-attr`
- `ToolbarService` 的按钮标题、菜单文本等都依赖这套机制

### updateTree

```ts
updateTree(element: HTMLElement): void
```

用途：刷新某个根节点及其子节点上所有已绑定的 i18n 文案。

典型场景：

- 工具栏在收到语言切换事件后，对整个工具栏根节点执行一次刷新

## 插件接入方式

## 通过 MapPlugin 装配 ToolbarService

`ToolbarService` 的 i18n 注入入口不在 `services.toolbar` 根级，而是在 `services.toolbar.config` 内。

```ts
import { createMapPlugin, i18n } from '@xingm/vmap-cesium-toolbar';

i18n.configure({
  persist: false,
  useStoredLocale: false,
});

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

说明：

- `MapPlugin.createToolbarService(...)` 实际读取的是 `options.config?.i18n` 和 `options.config?.useI18n`
- 如果写到 `services.toolbar.i18n` 这一层，当前源码不会传递给 `ToolbarService`

## 通过 MapPlugin 装配 DrawService

`DrawService` 的 i18n 注入入口在 `services.draw` 根级。

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

## 直接使用 ToolbarService

```ts
import { ToolbarService, i18n } from '@xingm/vmap-cesium-toolbar';

const toolbarService = new ToolbarService({
  viewer,
  container: viewer.container as HTMLElement,
  useI18n: true,
  i18n,
});

toolbarService.initialize();
```

## 直接使用 DrawService

```ts
import { DrawService, i18n } from '@xingm/vmap-cesium-toolbar';

const drawService = new DrawService(viewer, {
  useI18n: true,
  i18n,
});
```

## 兼容层 CesiumMapToolbar

compat 层仍然支持：

```ts
import { CesiumMapToolbar, i18n } from '@xingm/vmap-cesium-toolbar';

const toolbar = new CesiumMapToolbar(viewer, container, {
  useI18n: true,
  i18n,
});
```

## 内置 key 范围

当前内置词典大致分为：

- `toolbar.*`: 工具栏按钮、搜索框文案
- `layers.*`: 图层面板文案
- `map.types.*`: 底图类型名称
- `measurement.menu.*`: 测量菜单项
- `draw.hint.*`: 绘制过程提示
- `draw.measurement.*`: 测距/测面标签
- `overlay.*`: 覆盖物辅助消息
- `app.*`、`ui.*`: 示例或业务辅助文案

示例：

```ts
i18n.t('toolbar.search');
i18n.t('layers.no_fly_zone');
i18n.t('draw.hint.line_continue');
i18n.t('draw.measurement.total_area', { value: '12.4 km²' });
```

## 当前行为限制

以下内容是根据现有源码整理出的行为边界，文档中建议明确知晓：

1. 当前默认内置词典只有 `zh-CN` 和 `en-US`。
2. `localStorage` 恢复语言时，源码只识别 `zh-CN` / `en-US` 两个值。
3. 因此自定义语言即使可以通过 `addMessages(...)` 和 `setLocale(...)` 在当前会话中工作，刷新页面后未必会被自动恢复。
4. `t(...)` 的兜底语言固定是 `zh-CN`，当前没有独立的 `fallbackLocale` 配置项。

## 推荐实践

1. 插件作为嵌入式能力接入宿主系统时，优先使用 `persist: false`，避免污染宿主应用的本地存储。
2. 覆盖默认词典时优先使用 `addMessages(..., { merge: true })`，不要整包替换。
3. 需要让工具栏随语言切换自动刷新时，务必传入统一的 `i18n` 单例，并保持 `useI18n: true`。
4. 如果业务侧消息提示也要统一语言，直接在宿主代码中调用 `i18n.t(...)`，不要只依赖工具栏内部文案。
