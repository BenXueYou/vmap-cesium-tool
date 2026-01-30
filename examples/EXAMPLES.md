# CesiumMapToolbar 自定义功能示例

本文档展示了如何使用 CesiumMapToolbar 的自定义按钮和搜索功能，以及 DrawHelper 的地图绘制功能。

## 0. 自动恢复（最小接入：onRecovered 重绑 toolbar/overlay/heatmap）

当遇到偶现 `Rendering has stopped` / `NaN render error` 时，可以在 `initCesium` 里启用 `autoRecover`。

关键点：恢复会重建 `viewer`，所以必须在 `onRecovered` 中把所有依赖 viewer 的实例重新创建/绑定。

可直接参考示例文件：`examples/demo-auto-recover.html`。

```ts
import { initCesium, CesiumMapToolbar, CesiumOverlayService, HeatmapLayer } from '@xingm/vmap-cesium-toolbar';

let toolbar: CesiumMapToolbar | null = null;
let overlay: CesiumOverlayService | null = null;
let heatmap: any = null;

function bindAll(viewer: any, container: HTMLElement) {
  toolbar?.destroy?.();
  toolbar = new CesiumMapToolbar(viewer, container);

  overlay?.destroy?.();
  overlay = new CesiumOverlayService(viewer);

  heatmap?.destroy?.();
  heatmap = new HeatmapLayer(viewer, { width: 512, height: 512 });
}

const containerId = 'cesiumContainer';
const container = document.getElementById(containerId)!;

const { viewer } = await initCesium(containerId, {
  autoRecover: {
    enabled: true,
    onRecovered: ({ newViewer }) => bindAll(newViewer, container),
  },
});

bindAll(viewer, container);
```

## 1. 自定义按钮配置

### 1.1 基本自定义按钮

```typescript
import { CesiumMapToolbar, type CustomButtonConfig } from 'vmap-cesium-toolbar';

// 创建工具栏时配置自定义按钮
const toolbar = new CesiumMapToolbar(viewer, container, {
  position: 'bottom-right',
  buttonSize: 40,
  buttons: [
    {
      id: 'custom-action',
      icon: '🎯', // 可以是字符串图标
      title: '自定义操作',
      size: 45,
      color: 'rgba(255, 193, 7, 0.4)',
      hoverColor: 'rgba(255, 193, 7, 0.8)',
      onClick: (buttonId, buttonElement) => {
        console.log('自定义按钮被点击', buttonId);
        // 在这里添加自定义逻辑
      }
    }
  ]
});
```

### 1.2 使用 HTML 元素作为图标

```typescript
// 创建自定义图标元素
const customIcon = document.createElement('div');
customIcon.innerHTML = '🚀';
customIcon.style.fontSize = '16px';
customIcon.style.color = '#ff6b6b';

const toolbar = new CesiumMapToolbar(viewer, container, {
  buttons: [
    {
      id: 'rocket-button',
      icon: customIcon, // 使用 HTMLElement
      title: '火箭发射',
      onClick: (buttonId, buttonElement) => {
        // 火箭发射逻辑
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(120.16, 30.28, 10000),
          duration: 3.0
        });
      }
    }
  ]
});
```

### 1.3 动态添加/移除按钮

```typescript
// 动态添加按钮
toolbar.addCustomButton({
  id: 'dynamic-button',
  icon: '⚡',
  title: '动态按钮',
  onClick: (buttonId, buttonElement) => {
    console.log('动态按钮被点击');
  }
});

// 更新按钮配置
toolbar.updateButtonConfig('dynamic-button', {
  title: '更新后的标题',
  color: 'rgba(76, 175, 80, 0.4)'
});

// 移除按钮
toolbar.removeButton('dynamic-button');
```

## 2. 自定义搜索功能

### 2.1 完全自定义搜索逻辑

```typescript
const toolbar = new CesiumMapToolbar(viewer, container, {}, {
  search: {
    onSearchInput: (query: string, container: HTMLElement) => {
      // 自定义搜索输入处理
      container.innerHTML = `<div style="padding: 8px; color: #666;">正在搜索: "${query}"</div>`;
      
      // 模拟异步搜索
      setTimeout(() => {
        const results = performCustomSearch(query);
        if (toolbar['searchCallback']?.onSearchResults) {
          toolbar['searchCallback'].onSearchResults(results, container);
        }
      }, 500);
    },
    
    onSearchResults: (results: SearchResult[], container: HTMLElement) => {
      // 自定义搜索结果显示
      container.innerHTML = '';
      
      results.forEach(result => {
        const resultItem = document.createElement('div');
        resultItem.style.cssText = `
          padding: 8px;
          border-bottom: 1px solid #f0f0f0;
          cursor: pointer;
          background: linear-gradient(90deg, #e3f2fd, #f3e5f5);
        `;
        
        resultItem.innerHTML = `
          <div style="font-weight: bold; color: #1976d2;">${result.name}</div>
          <div style="font-size: 12px; color: #666;">${result.address}</div>
        `;

        resultItem.addEventListener('click', () => {
          // 自定义点击处理
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              result.longitude,
              result.latitude,
              result.height || 1000
            ),
            duration: 1.0
          });
          container.parentElement?.remove();
        });

        container.appendChild(resultItem);
      });
    },
    
    onSelect: (result: SearchResult) => {
      console.log('选择了搜索结果:', result);
    }
  }
});
```

### 2.2 混合使用默认和自定义搜索

```typescript
const toolbar = new CesiumMapToolbar(viewer, container, {}, {
  search: {
    // 使用默认的搜索逻辑
    onSearch: async (query: string) => {
      // 调用外部 API
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      return data.results;
    },
    
    // 自定义结果显示
    onSearchResults: (results: SearchResult[], container: HTMLElement) => {
      // 自定义样式和交互
      container.innerHTML = '';
      
      results.forEach(result => {
        const item = document.createElement('div');
        item.className = 'custom-search-result';
        item.innerHTML = `
          <div class="result-name">${result.name}</div>
          <div class="result-address">${result.address}</div>
        `;
        
        item.addEventListener('click', () => {
          // 自定义点击行为
          selectSearchResult(result);
        });
        
        container.appendChild(item);
      });
    }
  }
});
```

## 3. 完整示例

```typescript
import { CesiumMapToolbar, type CustomButtonConfig, type SearchResult } from 'vmap-cesium-toolbar';

// 创建自定义按钮配置
const customButtons: CustomButtonConfig[] = [
  {
    id: 'weather',
    icon: '🌤️',
    title: '天气信息',
    color: 'rgba(33, 150, 243, 0.4)',
    hoverColor: 'rgba(33, 150, 243, 0.8)',
    onClick: (buttonId, buttonElement) => {
      showWeatherInfo();
    }
  },
  {
    id: 'traffic',
    icon: '🚦',
    title: '交通状况',
    color: 'rgba(255, 152, 0, 0.4)',
    hoverColor: 'rgba(255, 152, 0, 0.8)',
    onClick: (buttonId, buttonElement) => {
      toggleTrafficLayer();
    }
  }
];

// 创建工具栏
const toolbar = new CesiumMapToolbar(viewer, container, {
  position: 'bottom-right',
  buttonSize: 40,
  buttonSpacing: 8,
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  buttons: customButtons
}, {
  search: {
    onSearchInput: (query: string, container: HTMLElement) => {
      // 显示加载状态
      container.innerHTML = `
        <div style="padding: 8px; text-align: center;">
          <div style="color: #666;">🔍 搜索中...</div>
        </div>
      `;
      
      // 执行搜索
      performAdvancedSearch(query, container);
    },
    
    onSearchResults: (results: SearchResult[], container: HTMLElement) => {
      displayAdvancedSearchResults(results, container);
    },
    
    onSelect: (result: SearchResult) => {
      // 选择结果后的处理
      console.log('选择了位置:', result);
      addLocationMarker(result);
    }
  }
});

// 高级搜索函数
async function performAdvancedSearch(query: string, container: HTMLElement) {
  try {
    // 调用多个搜索服务
    const [poiResults, addressResults] = await Promise.all([
      searchPOI(query),
      searchAddress(query)
    ]);
    
    const allResults = [...poiResults, ...addressResults];
    
    if (toolbar['searchCallback']?.onSearchResults) {
      toolbar['searchCallback'].onSearchResults(allResults, container);
    }
  } catch (error) {
    container.innerHTML = `
      <div style="padding: 8px; color: #f44336;">
        ❌ 搜索失败，请重试
      </div>
    `;
  }
}

// 高级结果显示
function displayAdvancedSearchResults(results: SearchResult[], container: HTMLElement) {
  container.innerHTML = '';
  
  if (results.length === 0) {
    container.innerHTML = `
      <div style="padding: 8px; color: #666; text-align: center;">
        😔 未找到相关结果
      </div>
    `;
    return;
  }
  
  // 按类型分组
  const poiResults = results.filter(r => r.name.includes('POI'));
  const addressResults = results.filter(r => !r.name.includes('POI'));
  
  // 显示 POI 结果
  if (poiResults.length > 0) {
    const poiSection = document.createElement('div');
    poiSection.innerHTML = '<div style="font-weight: bold; padding: 4px 8px; background: #f5f5f5;">📍 兴趣点</div>';
    
    poiResults.forEach(result => {
      const item = createSearchResultItem(result, 'poi');
      poiSection.appendChild(item);
    });
    
    container.appendChild(poiSection);
  }
  
  // 显示地址结果
  if (addressResults.length > 0) {
    const addressSection = document.createElement('div');
    addressSection.innerHTML = '<div style="font-weight: bold; padding: 4px 8px; background: #f5f5f5;">🏠 地址</div>';
    
    addressResults.forEach(result => {
      const item = createSearchResultItem(result, 'address');
      addressSection.appendChild(item);
    });
    
    container.appendChild(addressSection);
  }
}

// 创建搜索结果项
function createSearchResultItem(result: SearchResult, type: string): HTMLElement {
  const item = document.createElement('div');
  item.style.cssText = `
    padding: 8px;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    transition: background-color 0.2s;
  `;
  
  const icon = type === 'poi' ? '📍' : '🏠';
  
  item.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 16px;">${icon}</span>
      <div style="flex: 1;">
        <div style="font-weight: bold; margin-bottom: 2px;">${result.name}</div>
        <div style="font-size: 12px; color: #666;">${result.address}</div>
      </div>
    </div>
  `;
  
  item.addEventListener('mouseenter', () => {
    item.style.backgroundColor = '#f5f5f5';
  });
  
  item.addEventListener('mouseleave', () => {
    item.style.backgroundColor = 'transparent';
  });
  
  item.addEventListener('click', () => {
    // 飞行到位置
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        result.longitude,
        result.latitude,
        result.height || 1000
      ),
      duration: 1.0
    });
    
    // 触发选择回调
    if (toolbar['searchCallback']?.onSelect) {
      toolbar['searchCallback'].onSelect(result);
    }
    
    // 关闭搜索框
    container.parentElement?.remove();
  });
  
  return item;
}
```

## 4. DrawHelper 地图绘制功能

### 4.1 绘制监控圆形区域

```typescript
import { DrawHelper } from 'vmap-cesium-toolbar';

const drawHelper = new DrawHelper(viewer);

// 绘制监控圆形区域
const circle = drawHelper.drawMonitoringCircle(
  120.16,  // 经度
  30.28,   // 纬度
  100,     // 高度
  500,     // 半径500米
  {
    borderColor: '#0062FF',
    fillColor: '#0062FF',
    borderWidth: 2,
    name: '监控区域'
  }
);
```

### 4.2 绘制垂直线条

```typescript
// 绘制垂直线条
const line = drawHelper.drawVerticalLine(
  120.15,  // 经度
  30.25,   // 纬度
  1000,    // 高度1000米
  {
    color: '#0062FF',
    width: 3,
    dashPattern: 0x00FF00FF,
    name: '垂直线条',
    groundHeight: 0
  }
);
```

### 4.3 完整的绘制功能示例

```typescript
import { CesiumMapToolbar, DrawHelper } from 'vmap-cesium-toolbar';

// 初始化
const drawHelper = new DrawHelper(viewer);
const toolbar = new CesiumMapToolbar(viewer, container);

// 绘制各种图形
function drawVariousShapes() {
  // 1. 绘制监控圆形
  const monitoringCircle = drawHelper.drawMonitoringCircle(
    120.16, 30.28, 100, 500,
    {
      borderColor: '#FF6B6B',
      fillColor: '#FF6B6B',
      borderWidth: 3,
      name: '安全监控区域'
    }
  );

  // 2. 绘制垂直线
  const verticalLine = drawHelper.drawVerticalLine(
    120.15, 30.25, 1000,
    {
      color: '#4ECDC4',
      width: 4,
      name: '高度标记线',
      groundHeight: 0
    }
  );

  // 3. 绘制视锥体
  const cameraPosition = viewer.camera.positionWC;
  const cameraOrientation = Cesium.Quaternion.fromRotationMatrix(
    Cesium.Matrix4.getRotation(viewer.camera.transform, new Cesium.Matrix3())
  );
  
  drawHelper.drawFrustum({
    position: cameraPosition,
    orientation: cameraOrientation,
    fov: 60,
    aspectRatio: 1.5,
    near: 10,
    far: 2000,
    fillColor: Cesium.Color.BLUE.withAlpha(0.3),
    outlineColor: Cesium.Color.WHITE
  });

  // 4. 绘制测量线条
  drawHelper.startDrawingLine();
  
  // 5. 绘制测量多边形
  drawHelper.startDrawingPolygon();
}

// 清理所有绘制内容
function clearAllDrawings() {
  drawHelper.clearAll();
  drawHelper.clearFrustum();
}
```

## 5. 最佳实践

### 4.1 按钮设计

- 使用清晰的图标和标题
- 保持一致的视觉风格
- 合理设置按钮大小和间距
- 提供悬停和点击反馈

### 4.2 搜索功能

- 提供加载状态指示
- 处理搜索错误情况
- 支持键盘导航
- 优化搜索性能（防抖、缓存等）

### 4.3 性能优化

- 避免频繁的 DOM 操作
- 使用事件委托
- 合理使用异步操作
- 及时清理事件监听器

这些示例展示了 CesiumMapToolbar 的强大自定义能力，可以根据具体需求灵活配置按钮和搜索功能。
