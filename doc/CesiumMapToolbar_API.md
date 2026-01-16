# CesiumMapToolbar API 文档

## 概述

`CesiumMapToolbar` 是一个 Cesium 地图工具栏组件，提供搜索、测量（测距/测面）、2D/3D 切换、图层切换、定位复位、缩放、全屏等功能。

源码位于 `src/libs/CesiumMapToolbar.ts`，类型定义主要来自 `src/libs/CesiumMapModel.ts`。

## 类定义

```typescript
class CesiumMapToolbar
```

## 构造函数

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

### 参数

- `viewer` (Viewer): Cesium Viewer 实例
- `container` (HTMLElement): 地图容器元素
- `config` (ToolbarConfig, 可选): 工具栏配置
- `callbacks` (对象, 可选): 回调函数配置
- `initialCenter` (对象, 可选): 初始中心点

## 配置接口

### ToolbarConfig

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
  buttons?: CustomButtonConfig[]; // 按钮配置（可用于“只显示部分按钮”或“加入自定义按钮”）
}
```

### SearchCallback

```typescript
interface SearchCallback {
  onSearch?: (query: string) => Promise<SearchResult[]>;
  onSelect?: (result: SearchResult) => void;
  // 可选：在输入/结果阶段自定义 DOM
  onSearchInput?: (query: string, container: HTMLElement) => void;
  onSearchResults?: (results: SearchResult[], container: HTMLElement) => void;
}
```

### MeasurementCallback

```typescript
interface MeasurementCallback {
  onMeasurementStart?: (positions?: Cartesian3[]) => void;
  onDistanceComplete?: (positions: Cartesian3[], distance: number) => void;
  onAreaComplete?: (positions: Cartesian3[], area: number) => void;
  onClear?: () => void;
}
```

### ZoomCallback

```typescript
interface ZoomCallback {
  // 当前实现回调传入的是相机高度与层级（由 CesiumMapController 计算）
  onZoomIn?: (beforeHeight: number, afterHeight: number, currentLevel: number) => void;
  onZoomOut?: (beforeHeight: number, afterHeight: number, currentLevel: number) => void;
}
```

### SearchResult

```typescript
interface SearchResult {
  name: string;        // 地点名称
  address: string;     // 详细地址
  longitude: number;   // 经度
  latitude: number;    // 纬度
  height?: number;     // 高度
}
```

## 主要方法

### 1. 设置初始中心点

```typescript
setInitialCenter(center: { longitude: number; latitude: number; height: number }): void
```

#### 参数

- `center`: 中心点坐标对象

#### 使用示例

```typescript
toolbar.setInitialCenter({
  longitude: 116.3974,
  latitude: 39.9093,
  height: 1000
});
```

### 2. 获取初始中心点

```ts
getInitialCenter(): { longitude: number; latitude: number; height: number } | undefined
```

### 3. 复位到初始位置

```ts
resetToInitialLocation(): void
```

等价于内部的“定位/复位”逻辑。

### 4. 设置天地图 Token

```ts
setTDToken(token: string): void
```

用于图层服务切换天地图底图时的鉴权。

### 5. 覆盖可选的地图类型列表

```ts
setMapTypes(mapTypes: MapType[]): void
```

`mapTypes` 用于图层菜单中展示可切换的底图类型。

### 6. 动态更新按钮样式

```ts
updateButtonConfig(buttonId: string, config: Partial<CustomButtonConfig>): void
```

可更新 `title/icon/size/color/backgroundColor/border...` 等。

### 7. 添加/更新自定义按钮

```ts
addCustomButton(config: CustomButtonConfig): void
```

- 支持 `sort` 控制按钮顺序（值越小越靠前）
- 若 id 已存在，会替换旧配置并重建该按钮

### 8. 移除按钮

```ts
removeButton(buttonId: string): void
```

### 9. 销毁

```ts
destroy(): void
```

销毁工具栏实例并释放事件监听器/DOM（建议在组件卸载时调用）。

## 工具栏按钮功能

### 1. 🔍 搜索按钮

**功能**：地理位置搜索

- 鼠标悬停显示搜索框
- 支持地址搜索
- 点击搜索结果自动定位

**使用示例**：

```typescript
const toolbar = new CesiumMapToolbar(viewer, container, config, {
  search: {
    onSearch: async (query: string) => {
      // 实现搜索逻辑
      const results = await searchAPI(query);
      return results;
    },
    onSelect: (result) => {
      console.log('定位到:', result.name);
    }
  }
});
```

### 2. 📏 测量按钮

**功能**：距离和面积测量

- 悬停显示：测面积、测距、清除
- 测距：支持多点折线，显示每段距离和总距离
- 测面积：绘制淡绿色填充多边形，显示面积

**使用示例**：

```typescript
const toolbar = new CesiumMapToolbar(viewer, container, config, {
  measurement: {
    onDistanceComplete: (positions, distance) => {
      console.log(`测距完成，总距离: ${distance.toFixed(2)} 米`);
    },
    onAreaComplete: (positions, area) => {
      console.log(`测面积完成，面积: ${area.toFixed(2)} 平方公里`);
    },
    onClear: () => {
      console.log('清除测量');
    }
  }
});
```

也可以通过 `toolbar.measurement.getMeasureMode()` 查询当前测量状态：`none | distance | area`。

### 3. 2D/3D 切换按钮

**功能**：视角切换

- 一键切换2D和3D视角
- 按钮文本自动更新

### 4. 📚 图层切换按钮

**功能**：地图类型切换

- 悬停显示地图类型选择菜单
- 支持：普通地图、三维地图、影像图、地形图

### 5. 🎯 定位按钮

**功能**：复位定位

- 复位到地图初始中心点
- 平滑飞行动画

### 6. 🔍+ 放大按钮

**功能**：地图放大

- 地图放大
- 支持缩放回调

### 7. 🔍- 缩小按钮

**功能**：地图缩小

- 地图缩小
- 支持缩放回调

**使用示例**：

```typescript
const toolbar = new CesiumMapToolbar(viewer, container, config, {
  zoom: {
    onZoomIn: (beforeHeight, afterHeight, currentLevel) => {
      console.log(`放大: ${beforeHeight} -> ${afterHeight}, level=${currentLevel}`);
    },
    onZoomOut: (beforeHeight, afterHeight, currentLevel) => {
      console.log(`缩小: ${beforeHeight} -> ${afterHeight}, level=${currentLevel}`);
    }
  }
});
```

### 8. ⛶ 全屏按钮

**功能**：全屏模式

- 进入/退出全屏模式
- 自动检测全屏状态

## 地图类型配置

工具栏内置支持以下地图类型：

1. **天地图-普通** (normal)
2. **天地图-三维** (3d)
3. **天地图-影像** (imagery) - 默认
4. **天地图-地形** (terrain)

## 使用示例

### 基本使用

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

### 动态设置初始中心点

```typescript
toolbar.setInitialCenter({
  longitude: 116.3974,
  latitude: 39.9093,
  height: 1000
});
```

### 复位到初始位置

```typescript
toolbar.resetToInitialLocation();
```

### 获取初始中心点

```typescript
const center = toolbar.getInitialCenter();
if (center) {
  console.log('初始中心点:', center);
}
```

## 样式定制

### CSS覆盖

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

### 配置样式

```typescript
const toolbar = new CesiumMapToolbar(viewer, container, {
  position: 'top-left',
  buttonSize: 50,
  buttonSpacing: 12,
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  borderColor: '#fff',
  borderRadius: 10,
  borderWidth: 2,
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
  zIndex: 2000
});
```

## 搜索功能实现

### 基本搜索实现

```typescript
const toolbar = new CesiumMapToolbar(viewer, container, config, {
  search: {
    onSearch: async (query: string) => {
      // 模拟搜索API调用
      const results = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(response => response.json());
      
      return results.map(item => ({
        name: item.name,
        address: item.address,
        longitude: item.longitude,
        latitude: item.latitude,
        height: item.height || 100
      }));
    },
    onSelect: (result) => {
      console.log('定位到:', result.name);
      // 可以在这里添加额外的定位逻辑
    }
  }
});
```

### 地理编码API集成

```typescript
const toolbar = new CesiumMapToolbar(viewer, container, config, {
  search: {
    onSearch: async (query: string) => {
      try {
        // 使用高德地图地理编码API
        const response = await fetch(
          `https://restapi.amap.com/v3/geocode/geo?key=YOUR_API_KEY&address=${encodeURIComponent(query)}`
        );
        const data = await response.json();
        
        return data.geocodes.map(geocode => ({
          name: geocode.formatted_address,
          address: geocode.formatted_address,
          longitude: parseFloat(geocode.location.split(',')[0]),
          latitude: parseFloat(geocode.location.split(',')[1]),
          height: 100
        }));
      } catch (error) {
        console.error('搜索失败:', error);
        return [];
      }
    },
    onSelect: (result) => {
      console.log('定位到:', result.name);
    }
  }
});
```

## 完整使用示例

```typescript
import { CesiumMapToolbar } from './libs/CesiumMapToolbar';

// 创建工具栏
const container = document.getElementById("cesiumContainer");
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
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    zIndex: 1000
  },
  {
    search: {
      onSearch: async (query: string) => {
        // 模拟搜索结果
        const mockResults = [
          {
            name: '人工智能产业园',
            address: '浙江省杭州市西湖区文三路',
            longitude: 120.16,
            latitude: 30.28,
            height: 100
          },
          {
            name: '西湖风景名胜区',
            address: '浙江省杭州市西湖区',
            longitude: 120.15,
            latitude: 30.25,
            height: 50
          }
        ];
        
        return mockResults.filter(result => 
          result.name.includes(query) || result.address.includes(query)
        );
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
        const areaText = area >= 1 ? `${area.toFixed(2)} 平方公里` : `${(area * 1000000).toFixed(2)} 平方米`;
        console.log(`测面积完成，面积: ${areaText}`);
      },
      onClear: () => {
        console.log('清除测量');
      }
    },
    zoom: {
      onZoomIn: (beforeLevel, afterLevel) => {
        console.log(`放大: ${beforeLevel.toFixed(0)}m -> ${afterLevel.toFixed(0)}m`);
      },
      onZoomOut: (beforeLevel, afterLevel) => {
        console.log(`缩小: ${beforeLevel.toFixed(0)}m -> ${afterLevel.toFixed(0)}m`);
      }
    }
  },
  {
    longitude: 120.2052342,
    latitude: 30.2489634,
    height: 1000
  }
);

// 动态更新初始中心点
toolbar.setInitialCenter({
  longitude: 116.3974,
  latitude: 39.9093,
  height: 1000
});

// 复位到初始位置
toolbar.resetToInitialLocation();

// 清理资源
function cleanup() {
  toolbar.destroy();
}
```

## 注意事项

1. **搜索功能**：需要实现 `onSearch` 回调函数，可以集成真实的地理编码API
2. **地图类型**：天地图需要有效的token，请替换示例中的 `your_token`
3. **全屏功能**：需要用户手势触发，某些浏览器可能有限制
4. **测量精度**：面积计算使用球面几何，适合大范围测量
5. **内存管理**：记得在组件销毁时调用 `destroy()` 方法
6. **事件冲突**：工具栏会管理自己的事件处理器，避免与其他组件冲突
7. **样式覆盖**：使用CSS选择器覆盖样式时，注意优先级
8. **响应式设计**：工具栏位置和大小可以根据屏幕尺寸调整
