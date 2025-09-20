<template>
  <div class="cesium-container">
    <div
      id="cesiumContainer"
      ref="cesiumContainer"
      style="width: 100%; height: 100vh"
    ></div>
    
    <!-- 测试按钮区域 -->
    <div class="test-buttons">
      <h3>绘制功能测试</h3>
      <div class="button-group">
        <button @click="testDrawFrustum" class="test-btn">绘制视锥体</button>
        <button @click="testDrawMonitoringCircle" class="test-btn">绘制监控圆形</button>
        <button @click="testDrawVerticalLine" class="test-btn">绘制垂直线</button>
        <button @click="clearAllTest" class="test-btn clear-btn">清除所有</button>
      </div>
    </div>

    <!-- 消息提示 -->
    <div v-if="message" class="message">{{ message }}</div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, onBeforeUnmount } from "vue";
import { Cesium } from "./libs/CesiumMapModel"; 
import { initCesium } from "./libs/CesiumMapLoader"; 
import { CesiumMapToolbar, type SearchResult, type MeasurementCallback, type ZoomCallback } from './libs/CesiumMapToolbar';
import DrawHelper from './libs/CesiumMapHelper'; 

const message = ref("");
let viewer = ref();
let mapToolbar: CesiumMapToolbar | null = null;
let drawHelper: DrawHelper | null = null;

// 初始化地图
onMounted(async () => {
  const { viewer: cesiumViewer, initialCenter } = await initCesium("cesiumContainer", {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    animation: false, // 禁用动画
    baseLayerPicker: false, // 禁用基础图层选择器
    fullscreenButton: false, // 禁用全屏按钮
    vrButton: false, // 禁用VR按钮
    geocoder: false, // 禁用地理编码器
    homeButton: false, // 禁用主页按钮
    infoBox: false, // 禁用信息框以减少交互冲突
    sceneModePicker: false, // 禁用场景模式选择器 
    selectionIndicator: false, // 禁用选取指示器以减少交互冲突
    timeline: false, // 禁用时间轴
    navigationHelpButton: false, // 禁用导航帮助按钮
    navigationInstructionsInitiallyVisible: false, // 禁用导航指令初始可见
    scene3DOnly: false, // 禁用3D场景
  });

  viewer.value = cesiumViewer;

  // 初始化绘图助手
  drawHelper = new DrawHelper(viewer.value);

  // 初始化工具栏
  const container = document.getElementById("cesiumContainer");
  if (container) {
    // 使用从initCesium返回的初始中心点
    const mapInitialCenter = {
      longitude: initialCenter.longitude,
      latitude: initialCenter.latitude,
      height: initialCenter.height
    };

    mapToolbar = new CesiumMapToolbar(
      viewer.value,
      container,
      {
        position: 'bottom-right',
        buttonSize: 40,
        buttonSpacing: 8,
        borderRadius: 6,
        borderWidth: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
      },
      {
        // 搜索回调
        search: {
          onSearch: async (query: string): Promise<SearchResult[]> => {
            // 这里可以调用真实的地理编码API
            return await mockGeocodingSearch(query);
          },
          onSelect: (result: SearchResult) => {
            message.value = `已定位到: ${result.name}`;
            setTimeout(() => {
              message.value = "";
            }, 3000);
          }
        },
        // 测量回调
        measurement: {
          onDistanceComplete: (positions, distance) => {
            message.value = `测距完成，总距离: ${distance.toFixed(2)} 米`;
            setTimeout(() => {
              message.value = "";
            }, 3000);
          },
          onAreaComplete: (positions, area) => {
            message.value = `测面积完成，面积: ${area.toFixed(2)} 平方公里`;
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
        // 缩放回调
        zoom: {
          onZoomIn: (beforeLevel, afterLevel) => {
            console.log(`放大: ${beforeLevel.toFixed(0)} -> ${afterLevel.toFixed(0)}`);
          },
          onZoomOut: (beforeLevel, afterLevel) => {
            console.log(`缩小: ${beforeLevel.toFixed(0)} -> ${afterLevel.toFixed(0)}`);
          }
        }
      },
      mapInitialCenter // 传递从initCesium获取的初始中心点
    );
  }
});

// 模拟地理编码搜索
async function mockGeocodingSearch(query: string): Promise<SearchResult[]> {
  // 模拟API延迟
  await new Promise(resolve => setTimeout(resolve, 500));
  
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
    }
  ];

  // 根据查询过滤结果
  return mockResults.filter(result => 
    result.name.includes(query) || result.address.includes(query)
  );
}

// 测试绘制视锥体
function testDrawFrustum() {
  if (!drawHelper) return;
  
  // 获取当前相机位置作为视锥体位置
  const cameraPosition = viewer.value.camera.positionWC;
  const cameraOrientation = Cesium.Quaternion.fromRotationMatrix(
    Cesium.Matrix4.getRotation(
      viewer.value.camera.transform,
      new Cesium.Matrix3()
    )
  );

  drawHelper.drawFrustum({
    position: cameraPosition,
    orientation: cameraOrientation,
    fov: 60,
    aspectRatio: 1.5,
    near: 10,
    far: 2000,
    fillColor: Cesium.Color.BLUE.withAlpha(0.3),
    outlineColor: Cesium.Color.WHITE,
    onRightClick: (pos) => {
      message.value = '视锥体被右键点击';
      setTimeout(() => { message.value = ""; }, 2000);
    }
  });

  message.value = '已绘制视锥体';
  setTimeout(() => { message.value = ""; }, 2000);
}

// 测试绘制监控圆形
function testDrawMonitoringCircle() {
  if (!mapToolbar) return;
  
  // 在杭州西湖附近绘制监控圆形
  const circle = mapToolbar.drawMonitoringCircle(
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

  message.value = '已绘制监控圆形区域';
  setTimeout(() => { message.value = ""; }, 2000);
}

// 测试绘制垂直线
function testDrawVerticalLine() {
  if (!mapToolbar) return;
  
  // 在杭州西湖附近绘制垂直线
  const line = mapToolbar.drawVerticalLine(
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

  message.value = '已绘制垂直线条';
  setTimeout(() => { message.value = ""; }, 2000);
}

// 清除所有测试内容
function clearAllTest() {
  if (drawHelper) {
    drawHelper.clearFrustum();
  }
  
  if (viewer.value) {
    viewer.value.entities.removeAll();
  }

  message.value = '已清除所有测试内容';
  setTimeout(() => { message.value = ""; }, 2000);
}


// 清理资源
onBeforeUnmount(() => {
  if (mapToolbar) {
    mapToolbar.destroy();
  }
  if (drawHelper) {
    drawHelper.destroy();
  }
});
</script>

<style scoped>
.cesium-container {
  position: relative;
}

/* 测试按钮区域样式 */
.test-buttons {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1002;
  min-width: 200px;
}

.test-buttons h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #333;
  font-weight: 600;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.test-btn {
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

.test-btn:hover {
  background: rgba(66, 133, 244, 0.2);
  border-color: #3367d6;
  transform: translateY(-1px);
}

.test-btn.clear-btn {
  background: rgba(244, 67, 54, 0.1);
  border-color: #f44336;
  color: #f44336;
}

.test-btn.clear-btn:hover {
  background: rgba(244, 67, 54, 0.2);
  border-color: #d32f2f;
}

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
</style>
