<template>
  <div class="cesium-container">
    <div
      id="cesiumContainer"
      ref="cesiumContainer"
      style="width: 100%; height: 100vh"
    ></div>

    <!-- 提示信息 -->
    <div v-if="message" class="message">{{ message }}</div>
    
    <!-- 功能说明 -->
    <div class="instructions">
      <h3>CesiumMapToolbar 功能演示</h3>
      <ul>
        <li><strong>🔍 搜索按钮:</strong> 鼠标悬停显示搜索框，支持地址搜索</li>
        <li><strong>📏 测量按钮:</strong> 悬停显示测距、测面积、清除选项</li>
        <li><strong>2D/3D 切换:</strong> 点击切换2D和3D视角</li>
        <li><strong>📚 图层切换:</strong> 悬停显示地图类型选择菜单</li>
        <li><strong>🎯 定位按钮:</strong> 复位到初始中心点</li>
        <li><strong>🔍+ 放大按钮:</strong> 地图放大，带回调</li>
        <li><strong>🔍- 缩小按钮:</strong> 地图缩小，带回调</li>
        <li><strong>⛶ 全屏按钮:</strong> 进入/退出全屏模式</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, onBeforeUnmount } from "vue";
import { Cesium } from "../libs/CesiumMapModel"; 
import { initCesium } from "../libs/CesiumMapLoader"; 
import { CesiumMapToolbar, type SearchResult } from '../libs/CesiumMapToolbar'; 

const message = ref("");
let viewer = ref();
let mapToolbar: CesiumMapToolbar | null = null;

// 初始化地图
onMounted(async () => {
  viewer.value = await initCesium("cesiumContainer", {
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
  });

  // 初始化工具栏
  const container = document.getElementById("cesiumContainer");
  if (container) {
    mapToolbar = new CesiumMapToolbar(
      viewer.value,
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
          onSearch: async (query: string): Promise<SearchResult[]> => {
            return await mockGeocodingSearch(query);
          },
          onSelect: (result: SearchResult) => {
            message.value = `已定位到: ${result.name} (${result.address})`;
            setTimeout(() => {
              message.value = "";
            }, 3000);
          }
        },
        measurement: {
          onDistanceComplete: (positions, distance) => {
            message.value = `测距完成，总距离: ${distance.toFixed(2)} 米`;
            setTimeout(() => {
              message.value = "";
            }, 3000);
          },
          onAreaComplete: (positions, area) => {
            const areaText = area >= 1 ? `${area.toFixed(2)} 平方公里` : `${(area * 1000000).toFixed(2)} 平方米`;
            message.value = `测面积完成，面积: ${areaText}`;
            setTimeout(() => {
              message.value = "";
            }, 3000);
          },
          onClear: () => {
            message.value = "已清除所有测量内容";
            setTimeout(() => {
              message.value = "";
            }, 2000);
          }
        },
        zoom: {
          onZoomIn: (beforeLevel, afterLevel) => {
            console.log(`放大操作: ${beforeLevel.toFixed(0)}m -> ${afterLevel.toFixed(0)}m`);
            message.value = `放大: ${beforeLevel.toFixed(0)}m -> ${afterLevel.toFixed(0)}m`;
            setTimeout(() => {
              message.value = "";
            }, 1500);
          },
          onZoomOut: (beforeLevel, afterLevel) => {
            console.log(`缩小操作: ${beforeLevel.toFixed(0)}m -> ${afterLevel.toFixed(0)}m`);
            message.value = `缩小: ${beforeLevel.toFixed(0)}m -> ${afterLevel.toFixed(0)}m`;
            setTimeout(() => {
              message.value = "";
            }, 1500);
          }
        }
      }
    );
  }
});

// 模拟地理编码搜索
async function mockGeocodingSearch(query: string): Promise<SearchResult[]> {
  // 模拟API延迟
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // 模拟搜索结果
  const mockResults: SearchResult[] = [
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
    },
    {
      name: '杭州东站',
      address: '浙江省杭州市江干区',
      longitude: 120.20,
      latitude: 30.30,
      height: 20
    },
    {
      name: '钱塘江大桥',
      address: '浙江省杭州市西湖区',
      longitude: 120.12,
      latitude: 30.22,
      height: 30
    },
    {
      name: '雷峰塔',
      address: '浙江省杭州市西湖区',
      longitude: 120.14,
      latitude: 30.23,
      height: 40
    }
  ];

  // 根据查询过滤结果
  return mockResults.filter(result => 
    result.name.includes(query) || result.address.includes(query)
  );
}

// 清理资源
onBeforeUnmount(() => {
  if (mapToolbar) {
    mapToolbar.destroy();
  }
});
</script>

<style scoped>
.cesium-container {
  position: relative;
  width: 100%;
  height: 100vh;
}

.message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px 20px;
  border-radius: 8px;
  z-index: 1001;
  font-size: 16px;
  text-align: center;
  max-width: 80%;
  word-wrap: break-word;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.instructions {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(255, 255, 255, 0.95);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  max-width: 300px;
  z-index: 1000;
  font-size: 14px;
}

.instructions h3 {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 16px;
}

.instructions ul {
  margin: 0;
  padding-left: 20px;
  color: #666;
}

.instructions li {
  margin-bottom: 8px;
  line-height: 1.4;
}

.instructions strong {
  color: #4285f4;
}
</style>