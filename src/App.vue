<template>
  <div class="cesium-container">
    <div
      id="cesiumContainer"
      ref="cesiumContainer"
      style="width: 100%; height: 100vh"
    ></div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, onBeforeUnmount } from "vue";
import { Cesium } from "./libs/CesiumMapModel"; 
import { initCesium } from "./libs/CesiumMapLoader"; 
import { CesiumMapToolbar, type SearchResult, type MeasurementCallback, type ZoomCallback } from './libs/CesiumMapToolbar'; 

const message = ref("");
let viewer = ref();
let mapToolbar: CesiumMapToolbar | null = null;

// 初始化地图
onMounted(async () => {
  viewer.value = await initCesium("cesiumContainer", {
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

  // 初始化工具栏
  const container = document.getElementById("cesiumContainer");
  if (container) {
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
        zoom: {
          onZoomIn: (beforeLevel, afterLevel) => {
            console.log(`放大: ${beforeLevel.toFixed(0)} -> ${afterLevel.toFixed(0)}`);
          },
          onZoomOut: (beforeLevel, afterLevel) => {
            console.log(`缩小: ${beforeLevel.toFixed(0)} -> ${afterLevel.toFixed(0)}`);
          }
        }
      }
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
