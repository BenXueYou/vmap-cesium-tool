# CesiumMapLoader API 文档

## 概述

`CesiumMapLoader` 是Cesium地图加载器模块，提供地图初始化、地形配置、图层管理等功能。

## 主要函数

### 1. 初始化Cesium地图
```typescript
async function initCesium(
  containerId: string,
  options: InitOptions,
  mapCenter?: MapCenter
): Promise<{ viewer: CesiumViewer; initialCenter: MapCenter }>
```

#### 参数
- `containerId` (string): 地图容器DOM元素ID
- `options` (InitOptions): 地图初始化配置
- `mapCenter` (MapCenter, 可选): 地图中心点配置

#### 返回值
- `viewer`: Cesium Viewer 实例
- `initialCenter`: 初始中心点配置

### InitOptions 接口
```typescript
interface InitOptions {
  // 地形配置
  terrain?: Terrain;                    // 地形配置
  terrainProvider?: TerrainProvider;    // 地形提供者
  
  // 地图类型和图层
  mapType?: string;                     // 地图类型
  imageryProvider?: UrlTemplateImageryProvider; // 自定义影像图层
  imageryLayers?: ImageryLayerCollection; // 自定义影像图层集合
  
  // 渲染配置
  terrainShadows?: ShadowMode;          // 地形阴影
  contextOptions?: ContextOptions;      // 上下文选项
  scene3DOnly?: boolean;                // 是否只使用3D场景
  shadows?: boolean;                    // 阴影
  terrainExaggeration?: number;         // 地形夸张系数
  
  // UI控件配置
  selectionIndicator?: boolean;         // 选择指示器
  navigationHelpButton?: boolean;       // 导航帮助按钮
  fullscreenButton?: boolean;           // 全屏按钮
  geocoder?: boolean;                   // 地理编码器
  homeButton?: boolean;                 // 主页按钮
  infoBox?: boolean;                    // 信息框
  sceneModePicker?: boolean;            // 场景模式选择器
  baseLayerPicker?: boolean;            // 基础图层选择器
  
  // 时间和动画
  timeline?: boolean;                   // 时间轴
  animation?: boolean;                  // 动画
  clock?: Clock;                        // 时钟
  
  // 导航配置
  navigationInstructionsInitiallyVisible?: boolean; // 导航指令初始可见
  sceneMode?: SceneMode;                // 场景模式
  
  // 事件处理
  screenSpaceEventHandler?: ScreenSpaceEventHandler; // 屏幕空间事件处理器
  
  // 性能配置
  useDefaultRenderLoop?: boolean;       // 使用默认渲染循环
  targetFrameRate?: number;             // 目标帧率
  showRenderLoopErrors?: boolean;       // 显示渲染循环错误
  automaticallyTrackDataSourceClocks?: boolean; // 自动跟踪数据源时钟
  
  // 数据源
  dataSources?: DataSourceCollection;   // 数据源集合
  creationTime?: number;                // 创建时间
  
  // 渲染质量
  useBrowserRecommendedResolution?: boolean; // 使用浏览器推荐分辨率
  resolutionScale?: number;             // 分辨率缩放
  orderIndependentTransparency?: boolean; // 无序透明度
  maximumScreenSpaceError?: number;     // 最大屏幕空间误差
  maximumNumberOfLoadedTiles?: number;  // 最大加载瓦片数量
}
```

### MapCenter 接口
```typescript
interface MapCenter {
  latitude: number;     // 纬度
  longitude: number;    // 经度
  height: number;       // 高度
  pitch?: number;       // 俯仰角（默认-30度）
  heading?: number;     // 航向角（默认0度）
}
```

### 使用示例
```typescript
import { initCesium } from './libs/CesiumMapLoader';

// 基本使用
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

// 自定义中心点
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
  longitude: 116.3974,  // 北京
  latitude: 39.9093,
  height: 1000,
  pitch: -45,
  heading: 0
});

// 使用高德地图
const { viewer, initialCenter } = await initCesium("cesiumContainer", {
  mapType: 'gaode',
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
```

### 2. 创建天地图
```typescript
function createTianDiMap(): TianDiMap
```
创建天地图配置对象。

#### 返回值
```typescript
interface TianDiMap {
  url: string;           // 瓦片URL模板
  subdomains: string[];  // 子域名数组
  minimumLevel: number;  // 最小缩放级别
  maximumLevel: number;  // 最大缩放级别
  credit: string;        // 版权信息
}
```

#### 使用示例
```typescript
import { createTianDiMap } from './libs/CesiumMapLoader';

const tianDiMap = createTianDiMap();
console.log(tianDiMap.url); // 天地图瓦片URL
```

### 3. 创建高德地图
```typescript
function createGaoDeMap(): UrlTemplateImageryProvider
```
创建高德地图影像提供者。

#### 使用示例
```typescript
import { createGaoDeMap } from './libs/CesiumMapLoader';

const gaoDeMap = createGaoDeMap();
viewer.imageryLayers.addImageryProvider(gaoDeMap);
```

## 配置说明

### 默认配置
```typescript
const defaultOptions = {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  animation: false,
  baseLayerPicker: false,
  fullscreenButton: false,
  vrButton: false,
  geocoder: false,
  homeButton: false,
  infoBox: false,
  sceneModePicker: false,
  selectionIndicator: false,
  timeline: false,
  navigationHelpButton: false,
  navigationInstructionsInitiallyVisible: false,
  scene3DOnly: false,
};
```

### 默认中心点
```typescript
const defaultMapCenter = {
  longitude: 120.2052342,  // 中国中心
  latitude: 30.2489634,
  height: 1000,
  pitch: -60,
  heading: 0
};
```

## 地图类型支持

### 1. 默认地图
使用Cesium默认的Bing Maps或OpenStreetMap。

### 2. 高德地图
设置 `mapType: 'gaode'` 使用高德地图。

### 3. 自定义地图
通过 `imageryProvider` 参数传入自定义的影像提供者。

## 地形配置

### 1. 世界地形
```typescript
terrain: Cesium.Terrain.fromWorldTerrain()
```

### 2. 椭球体地形
```typescript
terrain: Cesium.Terrain.fromEllipsoid()
```

### 3. 自定义地形
```typescript
terrainProvider: new Cesium.CesiumTerrainProvider({
  url: 'your-terrain-server-url'
})
```

## 性能优化配置

### 1. 渲染质量
```typescript
{
  useBrowserRecommendedResolution: true,
  resolutionScale: 1.0,
  maximumScreenSpaceError: 2.0,
  maximumNumberOfLoadedTiles: 1000
}
```

### 2. 帧率控制
```typescript
{
  useDefaultRenderLoop: true,
  targetFrameRate: 60,
  showRenderLoopErrors: false
}
```

### 3. 透明度优化
```typescript
{
  orderIndependentTransparency: true
}
```

## 错误处理

### 常见错误
1. **容器ID不存在**：确保DOM元素存在
2. **Cesium Token未设置**：需要设置 `Cesium.Ion.defaultAccessToken`
3. **网络连接问题**：检查网络连接和防火墙设置

### 错误处理示例
```typescript
try {
  const { viewer, initialCenter } = await initCesium("cesiumContainer", options);
  console.log('地图初始化成功');
} catch (error) {
  console.error('地图初始化失败:', error);
}
```

## 完整使用示例

```typescript
import { initCesium, createGaoDeMap } from './libs/CesiumMapLoader';

async function initializeMap() {
  try {
    // 设置Cesium Token
    Cesium.Ion.defaultAccessToken = 'your-cesium-token';
    
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
    }, {
      longitude: 120.2052342,
      latitude: 30.2489634,
      height: 1000,
      pitch: -60,
      heading: 0
    });
    
    console.log('地图初始化成功');
    console.log('初始中心点:', initialCenter);
    
    // 可以在这里添加其他地图配置
    // 例如添加自定义图层
    const gaoDeMap = createGaoDeMap();
    viewer.imageryLayers.addImageryProvider(gaoDeMap);
    
    return { viewer, initialCenter };
  } catch (error) {
    console.error('地图初始化失败:', error);
    throw error;
  }
}

// 使用
initializeMap().then(({ viewer, initialCenter }) => {
  // 地图初始化完成，可以进行其他操作
  console.log('地图准备就绪');
});
```

## 注意事项

1. **Cesium Token**：使用世界地形需要有效的Cesium Ion Token
2. **网络连接**：确保网络连接正常，能够访问Cesium服务
3. **浏览器兼容性**：确保浏览器支持WebGL
4. **内存管理**：记得在组件销毁时调用 `viewer.destroy()`
5. **性能优化**：根据实际需求调整渲染质量参数
