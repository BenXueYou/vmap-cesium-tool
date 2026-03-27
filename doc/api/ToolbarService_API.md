# ToolbarService API 文档

## 概述

`ToolbarService` 是新架构下的工具栏公开服务，负责工具栏 UI 创建、默认按钮注册、搜索/测量/图层菜单协调，以及简单按钮的地图控制联动。

新项目推荐通过 `MapPlugin` 的 `services.toolbar` 配置启用它，而不是继续直接使用旧版 `CesiumMapToolbar`。

顶层导出：

```ts
import {
  ToolbarService,
  createToolbarService,
  type ToolbarServiceOptions,
  type ToolbarCallbacks,
} from '@xingm/vmap-cesium-toolbar';
```

## 推荐接入方式

### 1. 通过 MapPlugin 启用

这是推荐方式。

```ts
import { createMapPlugin } from '@xingm/vmap-cesium-toolbar';

const mapPlugin = createMapPlugin('cesiumContainer', {
  services: {
    toolbar: {
      enabled: true,
      config: {
        position: 'bottom-right',
        buttonSize: 40,
      },
      useDefaultButtons: true,
      callbacks: {
        onSearch: async (query) => [],
        onSelect: (result) => {
          console.log(result);
        },
      },
    },
  },
});

await mapPlugin.initialize();

const toolbarService = mapPlugin.getToolbarService();
```

### 2. 手动创建

适合不走 `MapPlugin` 统一装配、但仍想复用新工具栏服务的场景。

```ts
import { createToolbarService } from '@xingm/vmap-cesium-toolbar';

const toolbarService = createToolbarService(
  {
    viewer,
    container: viewer.container as HTMLElement,
    callbacks: {
      onSearch: async (query) => [],
    },
  },
  {
    useDefaultButtons: true,
  },
);

toolbarService.initialize();
```

## 类定义

```ts
class ToolbarService
```

## 构造参数

```ts
constructor(config: ToolbarServiceConfig, options?: ToolbarServiceOptions)
```

### ToolbarServiceConfig

运行时装配配置，主要用于把 `viewer`、挂载容器和业务回调交给 `ToolbarService`。

```ts
interface ToolbarServiceConfig {
  viewer: any;
  container: HTMLElement;
  drawHelper?: any;
  search?: SearchServiceConfig;
  measurement?: MeasurementServiceConfig;
  layers?: LayersServiceConfig;
  noFlyZone?: NoFlyZoneServiceConfig;
  mapController?: MapControllerConfig;
  i18n?: I18nLike;
  useI18n?: boolean;
  callbacks?: ToolbarCallbacks;
}
```

关键字段：

- `viewer`: Cesium Viewer 实例
- `container`: 工具栏挂载容器
- `layers`: 图层菜单的当前地图类型、token、路网状态和回调
- `callbacks`: 搜索、测量、缩放、全屏、复位等公开回调入口
- `i18n` / `useI18n`: 多语言开关和实例注入

### ToolbarServiceOptions

面向工具栏 UI 和按钮层面的增强配置。

```ts
interface ToolbarServiceOptions {
  toolbarStyle?: Partial<ToolbarConfig>;
  buttonConfigs?: CustomButtonConfig[];
  useDefaultButtons?: boolean;
  searchPanelStyle?: SearchPanelStyleConfig;
  searchIdleActionIcon?: string | HTMLElement;
  searchClearActionIcon?: string | HTMLElement;
  layersPanelStyle?: LayersPanelStyleConfig;
}
```

关键字段：

- `toolbarStyle`: 工具栏整体布局与外观
- `buttonConfigs`: 覆盖默认按钮配置，或替换默认按钮样式
- `useDefaultButtons`: 是否初始化默认按钮，默认 `true`
- `searchPanelStyle`: 搜索面板样式细项
- `layersPanelStyle`: 图层菜单样式细项

## 通过 MapPlugin 暴露的 toolbar 配置

当使用 `createMapPlugin` 时，toolbar 的公开接入入口是 `services.toolbar`。

```ts
interface ToolbarPluginOptions {
  enabled?: boolean;
  container?: HTMLElement;
  config?: ToolbarConfig;
  useDefaultButtons?: boolean;
  buttonConfigs?: CustomButtonConfig[];
  searchMenu?: ToolbarSearchMenuOptions;
  layersMenu?: ToolbarLayersMenuOptions;
  callbacks?: ToolbarCallbacks;
}
```

建议理解为三层：

1. `config`: 工具栏壳层样式和基础按钮布局
2. `searchMenu` / `layersMenu`: 搜索面板和图层面板的扩展配置
3. `callbacks`: 业务回调入口

## 公开方法

### initialize

```ts
initialize(): void
```

创建工具栏、注册默认按钮处理器并初始化所有按钮。

### addCustomButton

```ts
addCustomButton(
  config: CustomButtonConfig,
  onClick?: (buttonId: string, buttonElement: HTMLElement) => void,
): void
```

用于动态添加自定义按钮。

说明：

- `config.id` 必须唯一
- `sort` 越小，按钮越靠前
- 可通过 `onClick` 或 `config.onClick` 绑定点击逻辑

### removeButton

```ts
removeButton(buttonId: string): void
```

移除工具栏中的按钮并销毁对应处理器。

### updateButton

```ts
updateButton(buttonId: string, config: Partial<CustomButtonConfig>): void
```

更新单个按钮的标题、图标、尺寸、颜色、排序等配置。

### updateToolbarStyle

```ts
updateToolbarStyle(config: Partial<ToolbarConfig>): void
```

动态更新工具栏外观，避免重新初始化整个工具栏。

常见用途：

- 调整 `position`
- 调整 `buttonSize`
- 调整 `direction`
- 调整 `offsetTop` / `offsetRight` / `offsetBottom` / `offsetLeft`

### enableButton / disableButton

```ts
enableButton(buttonId: string): void
disableButton(buttonId: string): void
```

启用或禁用指定按钮。

### showButton / hideButton

```ts
showButton(buttonId: string): void
hideButton(buttonId: string): void
```

显示或隐藏指定按钮。

### getButtonHandler

```ts
getButtonHandler(id: string): IButtonHandler | null
```

获取某个按钮的处理器实例。高级场景下可用来访问搜索、测量、图层按钮的细粒度行为。

### setMeasurementService

```ts
setMeasurementService(service: MeasurementServiceLike): void
```

注入测量服务，并同步更新测量按钮处理器。

### setSearchService

```ts
setSearchService(service: any): void
```

注入搜索服务，并同步更新搜索按钮处理器。

### setLayersService

```ts
setLayersService(service: any): void
```

注入图层服务，并同步图层菜单的切换逻辑。

### setMapController

```ts
setMapController(controller: MapControllerLike): void
```

为 `view2d3d`、`location`、`zoom-in`、`zoom-out`、`fullscreen` 这些简单按钮注入地图控制器。

### getToolbar / getToolbarElement

```ts
getToolbar(): Toolbar | null
getToolbarElement(): HTMLElement | null
```

分别返回工具栏组件实例和工具栏 DOM 根元素。

### closeAllMenus

```ts
closeAllMenus(): void
```

关闭当前已打开的搜索面板、测量菜单和图层菜单。

### destroy

```ts
destroy(): void
```

销毁所有按钮处理器并销毁工具栏 UI。组件卸载或页面离开时应调用。

## 公开回调 API

```ts
interface ToolbarCallbacks {
  onSearch?: (query: string) => Promise<SearchResult[]>;
  onSelect?: (result: SearchResult) => void;

  onMeasurementStart?: () => void;
  getDistanceDrawOptions?: () => any;
  getAreaDrawOptions?: () => any;
  onDistanceComplete?: (positions: any[], distance: number) => void;
  onAreaComplete?: (positions: any[], area: number) => void;
  onClear?: () => void;

  onZoomIn?: (beforeHeight: number, afterHeight: number) => void;
  onZoomOut?: (beforeHeight: number, afterHeight: number) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onResetLocation?: () => void;
}
```

### 搜索回调

- `onSearch`: 输入关键字后执行搜索
- `onSelect`: 选择搜索结果后触发

### 测量回调

- `onMeasurementStart`: 启动测距或测面时触发
- `getDistanceDrawOptions`: 自定义测距绘制参数
- `getAreaDrawOptions`: 自定义测面绘制参数
- `onDistanceComplete`: 测距完成时触发
- `onAreaComplete`: 测面完成时触发
- `onClear`: 清除测量结果后触发

### 地图控制回调

- `onZoomIn`: 缩放按钮触发放大链路时回调
- `onZoomOut`: 缩放按钮触发缩小链路时回调
- `onFullscreenChange`: 全屏状态变化时回调
- `onResetLocation`: 点击定位/复位按钮后回调

## 公开配置项

### ToolbarConfig

工具栏整体样式配置。

```ts
interface ToolbarConfig {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  direction?: 'row' | 'column';
  buttonSize?: number;
  buttonSpacing?: number;
  padding?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  boxShadow?: string;
  zIndex?: number;
  offsetTop?: number;
  offsetRight?: number;
  offsetBottom?: number;
  offsetLeft?: number;
  buttons?: CustomButtonConfig[];
  useI18n?: boolean;
  i18n?: I18nLike;
}
```

常用项：

- `position`: 工具栏停靠位置
- `direction`: 横向或纵向布局
- `buttonSize`: 按钮尺寸
- `buttonSpacing`: 按钮间距
- `offset*`: 相对于容器边缘的偏移

### CustomButtonConfig

按钮级配置，既可覆盖默认按钮，也可用于自定义按钮。

```ts
interface CustomButtonConfig {
  id: string;
  icon: string | HTMLElement | false;
  title: string;
  titleKey?: string;
  enabled?: boolean;
  visible?: boolean;
  size?: number;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: string;
  padding?: string;
  hoverColor?: string;
  activeColor?: string;
  backgroundColor?: string;
  sort?: number;
  activeIcon?: string | HTMLElement | false;
  callback?: () => void;
  onClick?: (buttonId: string, buttonElement: HTMLElement) => void;
}
```

### ToolbarSearchMenuOptions

搜索面板的公开配置。

```ts
interface ToolbarSearchMenuOptions {
  panelStyle?: SearchPanelStyleConfig;
  idleActionIcon?: string | HTMLElement;
  clearActionIcon?: string | HTMLElement;
}
```

### ToolbarLayersMenuOptions

图层菜单的公开配置。

```ts
interface ToolbarLayersMenuOptions {
  mapTypes?: MapType[];
  defaultPlaceNameChecked?: boolean;
  defaultNoFlyZoneChecked?: boolean;
  panelStyle?: LayersPanelStyleConfig;
}
```

说明：

- `mapTypes`: 用于图层卡片展示和切换的地图类型列表
- `defaultPlaceNameChecked`: 默认是否展示注记/路网
- `defaultNoFlyZoneChecked`: 默认是否展示禁飞区
- `panelStyle`: 图层面板样式覆盖项

## 默认按钮

当前内置默认按钮包括：

- `search`
- `measure`
- `view2d3d`
- `layers`
- `location`
- `zoom-in`
- `zoom-out`
- `fullscreen`

默认排序按 `DEFAULT_BUTTON_SORTS` 执行，顺序从 0 到 7。

## 示例

### 覆盖默认按钮样式

```ts
const mapPlugin = createMapPlugin('cesiumContainer', {
  services: {
    toolbar: {
      enabled: true,
      buttonConfigs: [
        {
          id: 'search',
          title: '搜索',
          icon: searchIcon,
          backgroundColor: 'rgba(0, 0, 0, 0.52)',
          borderColor: 'rgba(9, 109, 236, 0.85)',
          color: '#ffffff',
          sort: 0,
        },
      ],
    },
  },
});
```

### 动态控制按钮

```ts
const toolbarService = mapPlugin.getToolbarService();

toolbarService?.hideButton('layers');
toolbarService?.disableButton('measure');
toolbarService?.updateToolbarStyle({
  position: 'top-right',
  direction: 'row',
});
```

## 与旧版 CesiumMapToolbar 的关系

- `ToolbarService` 是新架构的公开服务
- `CesiumMapToolbar` 是兼容适配层
- 新项目优先使用 `services.toolbar` 和 `mapPlugin.getToolbarService()`
- 旧项目迁移时，可先保留 compat 用法，再逐步切换到 `ToolbarService`
