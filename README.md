# CesiumMapToolbar API 文档

## 概述

本文档详细介绍了 `vmap-cesium-tool` 项目中三个核心模块的API接口和使用方法。

## 目录

- [CesiumMapHelper.ts](#cesiummaphelperts)
- [CesiumMapLoader.ts](#cesiummaploaderts)
- [CesiumMapToolbar.ts](#cesiummaptoolbarts)

---

## CesiumMapHelper.ts

### 概述

Cesium绘图辅助工具类，提供绘制点、线、多边形、矩形、视锥体等功能，支持编辑和删除操作。

### 类定义

```typescript
class DrawHelper
```

### 构造函数

```typescript
constructor(viewer: Cesium.Viewer)
```

**参数：**

- `viewer` (Cesium.Viewer): Cesium Viewer 实例

**示例：**

```typescript
import DrawHelper from './libs/CesiumMapHelper';

const drawHelper = new DrawHelper(viewer);
```

### 主要方法

#### 1. 绘制线条

```typescript
startDrawingLine(): void
```

开始绘制线条模式。支持多点折线绘制。

**使用示例：**

```typescript
drawHelper.startDrawingLine();
```

#### 2. 绘制多边形

```typescript
startDrawingPolygon(): void
```

开始绘制多边形模式。绘制带淡绿色填充的多边形区域。

**使用示例：**

```typescript
drawHelper.startDrawingPolygon();
```

#### 3. 绘制矩形

```typescript
startDrawingRectangle(): void
```

开始绘制矩形模式。

**使用示例：**

```typescript
drawHelper.startDrawingRectangle();
```

#### 4. 绘制视锥体

```typescript
drawFrustum(options?: FrustumOptions): void
```

**参数：**

- `options` (FrustumOptions, 可选): 视锥体配置选项

**FrustumOptions 接口：**

```typescript
interface FrustumOptions {
  position?: Cartesian3;           // 视锥体位置
  orientation?: Quaternion;        // 视锥体方向
  fov?: number;                   // 视野角度 (1-179度)
  aspectRatio?: number;           // 宽高比
  near?: number;                  // 近平面距离
  far?: number;                   // 远平面距离
  fillColor?: Color;              // 填充颜色
  outlineColor?: Color;           // 轮廓颜色
  onRightClick?: (position: Cartesian3) => void; // 右键点击回调
}
```

**使用示例：**

```typescript
drawHelper.drawFrustum({
  fov: 60,
  aspectRatio: 1.5,
  near: 10,
  far: 2000,
  fillColor: Cesium.Color.GREEN.withAlpha(0.3),
  outlineColor: Cesium.Color.WHITE,
  onRightClick: (pos) => {
    console.log('视锥体被右键点击:', pos);
  }
});
```

#### 5. 结束绘制

```typescript
endDrawing(): void
```

结束当前绘制操作。

#### 6. 清除所有

```typescript
clearAll(): void
```

清除所有已绘制的实体。

#### 7. 清除视锥体

```typescript
clearFrustum(): void
```

清除所有视锥体相关图形。

#### 8. 删除指定实体

```typescript
removeEntity(entity: Cesium.Entity): void
```

**参数：**

- `entity` (Cesium.Entity): 要删除的实体

#### 9. 获取已完成实体

```typescript
getFinishedEntities(): Cesium.Entity[]
```

返回所有已完成的绘制实体数组。

### 事件回调

#### 设置开始绘制回调

```typescript
onDrawStart(callback: () => void): void
```

#### 设置结束绘制回调

```typescript
onDrawEnd(callback: (entity: Cesium.Entity | null) => void): void
```

#### 设置实体移除回调

```typescript
onEntityRemoved(callback: (entity: Cesium.Entity) => void): void
```

**使用示例：**

```typescript
drawHelper.onDrawStart(() => {
  console.log('开始绘制');
});

drawHelper.onDrawEnd((entity) => {
  if (entity) {
    console.log('绘制完成:', entity);
  } else {
    console.log('绘制被取消');
  }
});

drawHelper.onEntityRemoved((entity) => {
  console.log('实体被移除:', entity);
});
```

### 销毁资源

```typescript
destroy(): void
```

销毁工具实例，清理所有事件监听器和资源。

---

## CesiumMapLoader.ts

### 概述

Cesium地图加载器，提供地图初始化、地形配置、图层管理等功能。

### 主要函数

#### 1. 初始化Cesium地图

```typescript
async function initCesium(
  containerId: string,
  options: InitOptions,
  mapCenter?: MapCenter
): Promise<{ viewer: CesiumViewer; initialCenter: MapCenter }>
```

**参数：**

- `containerId` (string): 地图容器DOM元素ID
- `options` (InitOptions): 地图初始化配置
- `mapCenter` (MapCenter, 可选): 地图中心点配置

**InitOptions 接口：**

```typescript
interface InitOptions {
  terrain?: Terrain;                    // 地形配置
  terrainProvider?: TerrainProvider;    // 地形提供者
  mapType?: string;                     // 地图类型
  imageryProvider?: UrlTemplateImageryProvider; // 自定义影像图层
  imageryLayers?: ImageryLayerCollection; // 自定义影像图层集合
  terrainShadows?: ShadowMode;          // 地形阴影
  contextOptions?: ContextOptions;      // 上下文选项
  scene3DOnly?: boolean;                // 是否只使用3D场景
  selectionIndicator?: boolean;         // 选择指示器
  navigationHelpButton?: boolean;       // 导航帮助按钮
  fullscreenButton?: boolean;           // 全屏按钮
  geocoder?: boolean;                   // 地理编码器
  homeButton?: boolean;                 // 主页按钮
  infoBox?: boolean;                    // 信息框
  sceneModePicker?: boolean;            // 场景模式选择器
  timeline?: boolean;                   // 时间轴
  animation?: boolean;                  // 动画
  baseLayerPicker?: boolean;            // 基础图层选择器
  navigationInstructionsInitiallyVisible?: boolean; // 导航指令初始可见
  clock?: Clock;                        // 时钟
  sceneMode?: SceneMode;                // 场景模式
  screenSpaceEventHandler?: ScreenSpaceEventHandler; // 屏幕空间事件处理器
  useDefaultRenderLoop?: boolean;       // 使用默认渲染循环
  targetFrameRate?: number;             // 目标帧率
  showRenderLoopErrors?: boolean;       // 显示渲染循环错误
  automaticallyTrackDataSourceClocks?: boolean; // 自动跟踪数据源时钟
  dataSources?: DataSourceCollection;   // 数据源集合
  creationTime?: number;                // 创建时间
  useBrowserRecommendedResolution?: boolean; // 使用浏览器推荐分辨率
  resolutionScale?: number;             // 分辨率缩放
  orderIndependentTransparency?: boolean; // 无序透明度
  shadows?: boolean;                    // 阴影
  terrainExaggeration?: number;         // 地形夸张系数
  maximumScreenSpaceError?: number;     // 最大屏幕空间误差
  maximumNumberOfLoadedTiles?: number;  // 最大加载瓦片数量
}
```

**MapCenter 接口：**

```typescript
interface MapCenter {
  latitude: number;     // 纬度
  longitude: number;    // 经度
  height: number;       // 高度
  pitch?: number;       // 俯仰角
  heading?: number;     // 航向角
}
```

**返回值：**

- `viewer`: Cesium Viewer 实例
- `initialCenter`: 初始中心点配置

**使用示例：**

```typescript
import { initCesium } from './libs/CesiumMapLoader';

const { viewer, initialCenter } = await initCesium("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  animation: false,
  baseLayerPicker: false,
  fullscreenButton: false,
  geocoder: false,
  homeButton: false,
  infoBox: false,
  sceneModePicker: false,
  selectionIndicator: false,
  timeline: false,
  navigationHelpButton: false,
  scene3DOnly: false,
}, {
  longitude: 120.2052342,
  latitude: 30.2489634,
  height: 1000,
  pitch: -60,
  heading: 0
});
```

#### 2. 创建天地图

```typescript
function createTianDiMap(): TianDiMap
```

创建天地图配置对象。

**返回值：**

```typescript
interface TianDiMap {
  url: string;           // 瓦片URL模板
  subdomains: string[];  // 子域名数组
  minimumLevel: number;  // 最小缩放级别
  maximumLevel: number;  // 最大缩放级别
  credit: string;        // 版权信息
}
```

#### 3. 创建高德地图

```typescript
function createGaoDeMap(): UrlTemplateImageryProvider
```

创建高德地图影像提供者。

---

## CesiumMapToolbar.ts

### 概述

Cesium地图工具栏类，提供搜索、测量、2D/3D切换、图层切换、定位、缩放、全屏等功能。

### 类定义

```typescript
class CesiumMapToolbar
```

### 构造函数

```typescript
constructor(
  viewer: Viewer,
  container: HTMLElement,
  config?: ToolbarConfig,
  callbacks?: {
    search?: SearchCallback;
    measurement?: MeasurementCallback;
    zoom?: ZoomCallback;
  },
  initialCenter?: { longitude: number; latitude: number; height: number }
)
```

**参数：**

- `viewer` (Viewer): Cesium Viewer 实例
- `container` (HTMLElement): 地图容器元素
- `config` (ToolbarConfig, 可选): 工具栏配置
- `callbacks` (对象, 可选): 回调函数配置
- `initialCenter` (对象, 可选): 初始中心点

### 配置接口

#### ToolbarConfig

```typescript
interface ToolbarConfig {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  buttonSize?: number;           // 按钮大小 (默认40px)
  buttonSpacing?: number;        // 按钮间距 (默认8px)
  backgroundColor?: string;      // 背景色
  borderColor?: string;          // 边框色
  borderRadius?: number;         // 圆角半径
  borderWidth?: number;          // 边框宽度
  boxShadow?: string;           // 阴影
  zIndex?: number;              // 层级
}
```

#### SearchCallback

```typescript
interface SearchCallback {
  onSearch?: (query: string) => Promise<SearchResult[]>;
  onSelect?: (result: SearchResult) => void;
}
```

#### MeasurementCallback

```typescript
interface MeasurementCallback {
  onDistanceComplete?: (positions: Cartesian3[], distance: number) => void;
  onAreaComplete?: (positions: Cartesian3[], area: number) => void;
  onClear?: () => void;
}
```

#### ZoomCallback

```typescript
interface ZoomCallback {
  onZoomIn?: (beforeLevel: number, afterLevel: number) => void;
  onZoomOut?: (beforeLevel: number, afterLevel: number) => void;
}
```

#### SearchResult

```typescript
interface SearchResult {
  name: string;        // 地点名称
  address: string;     // 详细地址
  longitude: number;   // 经度
  latitude: number;    // 纬度
  height?: number;     // 高度
}
```

### 主要方法

#### 1. 设置初始中心点

```typescript
setInitialCenter(center: { longitude: number; latitude: number; height: number }): void
```

#### 2. 获取初始中心点

```typescript
getInitialCenter(): { longitude: number; latitude: number; height: number } | undefined
```

#### 3. 复位到初始位置

```typescript
resetToInitialLocation(): void
```

#### 4. 销毁工具栏

```typescript
destroy(): void
```

### 工具栏按钮功能

工具栏包含以下8个按钮：

1. **🔍 搜索按钮**
   - 鼠标悬停显示搜索框
   - 支持地址搜索
   - 点击搜索结果自动定位

2. **📏 测量按钮**
   - 悬停显示：测面积、测距、清除
   - 测距：支持多点折线，显示每段距离和总距离
   - 测面积：绘制淡绿色填充多边形，显示面积

3. **2D/3D 切换按钮**
   - 一键切换2D和3D视角
   - 按钮文本自动更新

4. **📚 图层切换按钮**
   - 悬停显示地图类型选择菜单
   - 支持：普通地图、三维地图、影像图、地形图

5. **🎯 定位按钮**
   - 复位到地图初始中心点
   - 平滑飞行动画

6. **🔍+ 放大按钮**
   - 地图放大
   - 支持缩放回调

7. **🔍- 缩小按钮**
   - 地图缩小
   - 支持缩放回调

8. **⛶ 全屏按钮**
   - 进入/退出全屏模式
   - 自动检测全屏状态

### 使用示例

#### 基本使用

```typescript
import { CesiumMapToolbar } from './libs/CesiumMapToolbar';

const toolbar = new CesiumMapToolbar(
  viewer,
  container,
  {
    position: 'bottom-right',
    buttonSize: 45,
    buttonSpacing: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: '#4285f4',
    borderRadius: 8,
    zIndex: 1000
  },
  {
    search: {
      onSearch: async (query: string) => {
        // 实现搜索逻辑
        return await searchAPI(query);
      },
      onSelect: (result) => {
        console.log('选择了:', result);
      }
    },
    measurement: {
      onDistanceComplete: (positions, distance) => {
        console.log('测距完成:', distance);
      },
      onAreaComplete: (positions, area) => {
        console.log('测面积完成:', area);
      },
      onClear: () => {
        console.log('清除测量');
      }
    },
    zoom: {
      onZoomIn: (before, after) => {
        console.log('放大:', before, '->', after);
      },
      onZoomOut: (before, after) => {
        console.log('缩小:', before, '->', after);
      }
    }
  },
  {
    longitude: 120.2052342,
    latitude: 30.2489634,
    height: 1000
  }
);
```

#### 动态设置初始中心点

```typescript
toolbar.setInitialCenter({
  longitude: 116.3974,
  latitude: 39.9093,
  height: 1000
});
```

#### 复位到初始位置

```typescript
toolbar.resetToInitialLocation();
```

### 地图类型配置

工具栏内置支持以下地图类型：

1. **天地图-普通** (normal)
2. **天地图-三维** (3d)
3. **天地图-影像** (imagery) - 默认
4. **天地图-地形** (terrain)

### 样式定制

可以通过CSS覆盖工具栏样式：

```css
/* 自定义工具栏样式 */
.cesium-map-toolbar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  border: 2px solid #fff !important;
}

.cesium-toolbar-button {
  background: rgba(255, 255, 255, 0.2) !important;
  color: #fff !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
}

.cesium-toolbar-button:hover {
  background: rgba(255, 255, 255, 0.3) !important;
  transform: scale(1.1) !important;
}
```

### 注意事项

1. **搜索功能**：需要实现 `onSearch` 回调函数，可以集成真实的地理编码API
2. **地图类型**：天地图需要有效的token，请替换示例中的 `your_token`
3. **全屏功能**：需要用户手势触发，某些浏览器可能有限制
4. **测量精度**：面积计算使用球面几何，适合大范围测量
5. **内存管理**：记得在组件销毁时调用 `destroy()` 方法

---

## 完整使用示例

```typescript
import { initCesium } from './libs/CesiumMapLoader';
import { CesiumMapToolbar } from './libs/CesiumMapToolbar';
import DrawHelper from './libs/CesiumMapHelper';

// 初始化地图
const { viewer, initialCenter } = await initCesium("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  animation: false,
  baseLayerPicker: false,
  fullscreenButton: false,
  geocoder: false,
  homeButton: false,
  infoBox: false,
  sceneModePicker: false,
  selectionIndicator: false,
  timeline: false,
  navigationHelpButton: false,
  scene3DOnly: false,
});

// 创建绘图助手
const drawHelper = new DrawHelper(viewer);
drawHelper.onDrawEnd((entity) => {
  console.log('绘制完成:', entity);
});

// 创建工具栏
const container = document.getElementById("cesiumContainer");
const toolbar = new CesiumMapToolbar(
  viewer,
  container,
  {
    position: 'bottom-right',
    buttonSize: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  {
    search: {
      onSearch: async (query) => {
        // 实现搜索逻辑
        return [];
      },
      onSelect: (result) => {
        console.log('定位到:', result.name);
      }
    },
    measurement: {
      onDistanceComplete: (positions, distance) => {
        console.log(`测距完成，总距离: ${distance.toFixed(2)} 米`);
      },
      onAreaComplete: (positions, area) => {
        console.log(`测面积完成，面积: ${area.toFixed(2)} 平方公里`);
      }
    }
  },
  initialCenter
);

// 清理资源
function cleanup() {
  toolbar.destroy();
  drawHelper.destroy();
}
```

---

## 更新日志

### v1.0.0

- 初始版本发布
- 支持完整的绘图功能（点、线、多边形、矩形、视锥体）
- 支持完整的工具栏功能（搜索、测量、2D/3D切换、图层切换、定位、缩放、全屏）
- 完整的回调系统和事件处理
- 可配置的样式选项
- 完善的错误处理和资源管理
