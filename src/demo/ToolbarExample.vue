<template>
  <div class="cesium-container">
    <div
      id="cesiumContainer"
      ref="cesiumContainer"
      style="width: 100%; height: 100vh"
    ></div>

    <!-- 控制面板 -->
    <div class="control-panel">
      <h3>CesiumMapToolbar 使用示例</h3>
      
      <div class="control-group">
        <h4>初始中心点设置</h4>
        <div class="input-group">
          <label>经度:</label>
          <input v-model.number="customCenter.longitude" type="number" step="0.000001" />
        </div>
        <div class="input-group">
          <label>纬度:</label>
          <input v-model.number="customCenter.latitude" type="number" step="0.000001" />
        </div>
        <div class="input-group">
          <label>高度:</label>
          <input v-model.number="customCenter.height" type="number" step="100" />
        </div>
        <button @click="updateInitialCenter">更新初始中心点</button>
      </div>

      <div class="control-group">
        <h4>工具栏操作</h4>
        <button @click="resetLocation">复位到初始位置</button>
        <button @click="getCurrentCenter">获取当前中心点</button>
        <button @click="getInitialCenter">获取初始中心点</button>
      </div>

      <div class="control-group">
        <h4>信息显示</h4>
        <div class="info-display">
          <p><strong>初始中心点:</strong> {{ initialCenterInfo }}</p>
          <p><strong>当前中心点:</strong> {{ currentCenterInfo }}</p>
        </div>
      </div>
    </div>

    <!-- 提示信息 -->
    <div v-if="message" class="message">{{ message }}</div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, onBeforeUnmount } from "vue";
import { Cesium } from "../libs/CesiumMapModel"; 
import { initCesium } from "../libs/CesiumMapLoader"; 
import { CesiumMapToolbar, type SearchResult } from '../libs/CesiumMapToolbar'; 

const message = ref("");
let viewer = ref();
let mapToolbar: CesiumMapToolbar | null = null;

// 自定义中心点
const customCenter = ref({
  longitude: 120.2052342,
  latitude: 30.2489634,
  height: 1000
});

// 信息显示
const initialCenterInfo = ref("");
const currentCenterInfo = ref("");

// 初始化地图
onMounted(async () => {
  const { viewer: cesiumViewer, initialCenter } = await initCesium("cesiumContainer", {
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
  }, customCenter.value); // 使用自定义中心点

  viewer.value = cesiumViewer;

  // 更新信息显示
  initialCenterInfo.value = `经度: ${initialCenter.longitude.toFixed(6)}, 纬度: ${initialCenter.latitude.toFixed(6)}, 高度: ${initialCenter.height.toFixed(0)}m`;

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
            updateCurrentCenterInfo();
          },
          onZoomOut: (beforeLevel, afterLevel) => {
            console.log(`缩小操作: ${beforeLevel.toFixed(0)}m -> ${afterLevel.toFixed(0)}m`);
            updateCurrentCenterInfo();
          }
        }
      },
      {
        longitude: initialCenter.longitude,
        latitude: initialCenter.latitude,
        height: initialCenter.height
      }
    );
  }

  // 定期更新当前中心点信息
  setInterval(updateCurrentCenterInfo, 1000);
});

// 更新初始中心点
const updateInitialCenter = () => {
  if (mapToolbar) {
    mapToolbar.setInitialCenter(customCenter.value);
    message.value = `初始中心点已更新: 经度 ${customCenter.value.longitude}, 纬度 ${customCenter.value.latitude}`;
    setTimeout(() => {
      message.value = "";
    }, 2000);
  }
};

// 复位到初始位置
const resetLocation = () => {
  if (mapToolbar) {
    mapToolbar.resetToInitialLocation();
    message.value = "已复位到初始位置";
    setTimeout(() => {
      message.value = "";
    }, 2000);
  }
};

// 获取当前中心点
const getCurrentCenter = () => {
  if (viewer.value) {
    const camera = viewer.value.camera;
    const position = camera.positionCartographic;
    const longitude = Cesium.Math.toDegrees(position.longitude);
    const latitude = Cesium.Math.toDegrees(position.latitude);
    const height = position.height;
    
    message.value = `当前中心点: 经度 ${longitude.toFixed(6)}, 纬度 ${latitude.toFixed(6)}, 高度 ${height.toFixed(0)}m`;
    setTimeout(() => {
      message.value = "";
    }, 3000);
  }
};

// 获取初始中心点
const getInitialCenter = () => {
  if (mapToolbar) {
    const center = mapToolbar.getInitialCenter();
    if (center) {
      message.value = `初始中心点: 经度 ${center.longitude.toFixed(6)}, 纬度 ${center.latitude.toFixed(6)}, 高度 ${center.height.toFixed(0)}m`;
    } else {
      message.value = "未设置初始中心点";
    }
    setTimeout(() => {
      message.value = "";
    }, 3000);
  }
};

// 更新当前中心点信息
const updateCurrentCenterInfo = () => {
  if (viewer.value) {
    const camera = viewer.value.camera;
    const position = camera.positionCartographic;
    const longitude = Cesium.Math.toDegrees(position.longitude);
    const latitude = Cesium.Math.toDegrees(position.latitude);
    const height = position.height;
    
    currentCenterInfo.value = `经度: ${longitude.toFixed(6)}, 纬度: ${latitude.toFixed(6)}, 高度: ${height.toFixed(0)}m`;
  }
};

// 模拟地理编码搜索
async function mockGeocodingSearch(query: string): Promise<SearchResult[]> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
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
    }
  ];

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

.control-panel {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(255, 255, 255, 0.95);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  max-width: 350px;
  z-index: 1000;
  font-size: 14px;
}

.control-panel h3 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 16px;
}

.control-panel h4 {
  margin: 10px 0 8px 0;
  color: #4285f4;
  font-size: 14px;
}

.control-group {
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.control-group:last-child {
  border-bottom: none;
}

.input-group {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.input-group label {
  width: 60px;
  font-weight: bold;
  color: #666;
}

.input-group input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-size: 12px;
}

button {
  padding: 6px 12px;
  margin: 2px;
  font-size: 12px;
  border: none;
  background: #4285f4;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

button:hover {
  background: #3367d6;
}

.info-display {
  background: #f5f5f5;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
}

.info-display p {
  margin: 4px 0;
  color: #333;
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
</style>
