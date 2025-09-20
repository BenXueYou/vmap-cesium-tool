<template>
  <div class="app">
    <div class="map-container">
      <div id="cesiumContainer" ref="cesiumContainer"></div>
      
      <!-- 控制面板 -->
      <div class="control-panel">
        <h3>VMap Cesium Toolbar</h3>
        <div class="button-group">
          <button @click="testDrawMonitoringCircle" class="control-btn">
            绘制监控圆形
          </button>
          <button @click="testDrawVerticalLine" class="control-btn">
            绘制垂直线
          </button>
          <button @click="clearAll" class="control-btn clear-btn">
            清除所有
          </button>
        </div>
        
        <div class="info-section">
          <h4>功能说明</h4>
          <ul>
            <li>🔍 搜索：悬停显示搜索框</li>
            <li>📏 测量：测距、测面积、清除</li>
            <li>🔄 2D/3D：视角切换</li>
            <li>📚 图层：地图类型切换</li>
            <li>🎯 定位：复位到初始位置</li>
            <li>🔍+/- 缩放：地图缩放</li>
            <li>⛶ 全屏：全屏模式</li>
          </ul>
        </div>
      </div>
    </div>
    
    <!-- 消息提示 -->
    <div v-if="message" class="message">{{ message }}</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { CesiumMapToolbar, initCesium } from 'vmap-cesium-toolbar';
import 'vmap-cesium-toolbar/style';

const cesiumContainer = ref<HTMLElement>();
const message = ref('');

let viewer: any;
let toolbar: CesiumMapToolbar | null = null;

onMounted(async () => {
  try {
    // 设置 Cesium Token
    Cesium.Ion.defaultAccessToken = 'your-cesium-token';
    
    // 初始化地图
    const { viewer: cesiumViewer, initialCenter } = await initCesium('cesiumContainer', {
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

    viewer = cesiumViewer;

    // 创建工具栏
    const container = document.getElementById('cesiumContainer');
    if (container) {
      toolbar = new CesiumMapToolbar(
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
            },
            onSelect: (result) => {
              showMessage(`已定位到: ${result.name}`);
            }
          },
          measurement: {
            onDistanceComplete: (positions, distance) => {
              showMessage(`测距完成，总距离: ${distance.toFixed(2)} 米`);
            },
            onAreaComplete: (positions, area) => {
              const areaText = area >= 1 ? `${area.toFixed(2)} 平方公里` : `${(area * 1000000).toFixed(2)} 平方米`;
              showMessage(`测面积完成，面积: ${areaText}`);
            },
            onClear: () => {
              showMessage('已清除测量内容');
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
        initialCenter
      );
    }

    console.log('VMap Cesium Toolbar 初始化完成');
  } catch (error) {
    console.error('初始化失败:', error);
    showMessage('初始化失败，请检查 Cesium Token 设置');
  }
});

// 测试绘制监控圆形
function testDrawMonitoringCircle() {
  if (!toolbar) return;
  
  const circle = toolbar.drawMonitoringCircle(
    120.16,  // 经度
    30.28,   // 纬度
    100,     // 高度
    500,     // 半径500米
    {
      borderColor: '#0062FF',
      fillColor: '#0062FF',
      borderWidth: 2,
      name: '测试监控区域'
    }
  );

  showMessage('已绘制监控圆形区域');
}

// 测试绘制垂直线
function testDrawVerticalLine() {
  if (!toolbar) return;
  
  const line = toolbar.drawVerticalLine(
    120.15,  // 经度
    30.25,   // 纬度
    1000,    // 高度1000米
    {
      color: '#0062FF',
      width: 3,
      dashPattern: 0x00FF00FF,
      name: '测试垂直线',
      groundHeight: 0
    }
  );

  showMessage('已绘制垂直线条');
}

// 清除所有内容
function clearAll() {
  if (viewer) {
    viewer.entities.removeAll();
  }
  showMessage('已清除所有内容');
}

// 显示消息
function showMessage(text: string) {
  message.value = text;
  setTimeout(() => {
    message.value = '';
  }, 3000);
}

onBeforeUnmount(() => {
  if (toolbar) {
    toolbar.destroy();
  }
});
</script>

<style scoped>
.app {
  width: 100%;
  height: 100vh;
  position: relative;
}

.map-container {
  width: 100%;
  height: 100%;
  position: relative;
}

#cesiumContainer {
  width: 100%;
  height: 100%;
}

/* 控制面板样式 */
.control-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1002;
  min-width: 250px;
  max-width: 300px;
}

.control-panel h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #333;
  font-weight: 600;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 15px;
}

.control-btn {
  padding: 8px 12px;
  border: 1px solid #4285f4;
  border-radius: 4px;
  background: rgba(66, 133, 244, 0.1);
  color: #4285f4;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}

.control-btn:hover {
  background: rgba(66, 133, 244, 0.2);
  border-color: #3367d6;
  transform: translateY(-1px);
}

.control-btn.clear-btn {
  background: rgba(244, 67, 54, 0.1);
  border-color: #f44336;
  color: #f44336;
}

.control-btn.clear-btn:hover {
  background: rgba(244, 67, 54, 0.2);
  border-color: #d32f2f;
}

.info-section {
  border-top: 1px solid #e0e0e0;
  padding-top: 15px;
}

.info-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #333;
  font-weight: 600;
}

.info-section ul {
  margin: 0;
  padding-left: 20px;
  list-style: none;
}

.info-section li {
  margin: 4px 0;
  font-size: 12px;
  color: #666;
  line-height: 1.4;
}

/* 消息提示样式 */
.message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 15px 20px;
  border-radius: 5px;
  z-index: 1001;
  font-size: 16px;
  text-align: center;
  max-width: 80%;
  word-wrap: break-word;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .control-panel {
    min-width: 200px;
    max-width: 250px;
  }
  
  .control-btn {
    font-size: 12px;
    padding: 6px 10px;
  }
}
</style>
