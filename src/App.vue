<template>
  <div class="cesium-container">
    <div
      id="cesiumContainer"
      ref="cesiumContainer"
      style="width: 100%; height: 100vh"
    ></div>
    <!-- 消息提示 -->
    <div v-if="message" class="message">{{ message }}</div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, onBeforeUnmount } from "vue";
import { Cesium } from "./libs/CesiumMapModel";
import { initCesium } from "./libs/CesiumMapLoader";
import {  SearchResult } from "./libs/CesiumMapModel";
import { CesiumMapToolbar } from "./libs/CesiumMapToolbar";
import DrawHelper from "./libs/CesiumMapHelper";

// 导入图标资源
import searchIcon from "./assets/images/toolbar/search@3x.png";
import measureIcon from "./assets/images/toolbar/measure@3x.png";
import view2dIcon from "./assets/images/toolbar/view_2d@3x.png";
import layersIcon from "./assets/images/toolbar/layers@3x.png";
import locationIcon from "./assets/images/toolbar/location@3x.png";
import zoomInIcon from "./assets/images/toolbar/zoom-in@3x.png";
import zoomOutIcon from "./assets/images/toolbar/zoom-out@3x.png";
import fullscreenIcon from "./assets/images/toolbar/fullscreen@3x.png";

const message = ref("");
let viewer = ref();
let mapToolbar: CesiumMapToolbar | null = null;
let drawHelper: DrawHelper | null = null;
const TDT_TK = import.meta.env.VITE_TD_TOKEN;
const CesiumToken = import.meta.env.VITE_CESIUM_TOKEN;

// 初始化地图
onMounted(async () => {
  const { viewer: cesiumViewer, initialCenter } = await initCesium(
    "cesiumContainer",
    {
      token: TDT_TK,    
    }
  );
  viewer.value = cesiumViewer;
  viewer.value.scene.globe.depthTestAgainstTerrain = true; // 启用地形深度测    
  viewer.value._cesiumWidget._creditContainer.style.display =  "none"; // 去掉左下角的Cesium商标

  // 初始化绘图助手
  drawHelper = new DrawHelper(viewer.value);
  // 初始化工具栏
  const container = document.getElementById("cesiumContainer");
  if (container) {
    // 使用从initCesium返回的初始中心点
    const mapInitialCenter = {
      longitude: initialCenter.longitude,
      latitude: initialCenter.latitude,
      height: initialCenter.height,
    };

    mapToolbar = new CesiumMapToolbar(
      viewer.value,
      container,
      {
        position: "bottom-right",
        buttonSize: 36,
        buttonSpacing: 8,
        borderRadius: 6,
        borderWidth: 0,
        zIndex: 1000,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        buttons: [
          {
            size: 36,
            id: "search",
            icon: searchIcon,
            title: "搜索",
            color: "#007BFF",
            borderColor: "#0775D1",
            backgroundColor: "rgba(0, 0, 0, 0.52)",
          },
          {
            size: 36,
            id: "measure",
            icon: measureIcon,
            title: "测量",
            color: "#007BFF",
            backgroundColor: "rgba(0, 0, 0, 0.52)",
          },
          {
            size: 36,
            id: "view2d3d",
            icon: false,
            activeIcon: false,
            title: "2D或3D",
            color: "#007BFF",
            backgroundColor: "rgba(0, 0, 0, 0.52)",
          },
          {
            size: 36,
            id: "layers",
            icon: layersIcon,
            title: "图层切换",
            color: "#007BFF",
            borderColor: "#0775D1",
            backgroundColor: "rgba(0, 0, 0, 0.52)",
          },
          {
            size: 36,
            id: "location",
            icon: locationIcon,
            title: "定位",
            color: "#007BFF",
            borderColor: "#0775D1",
            backgroundColor: "rgba(0, 0, 0, 0.52)",
          },
          {
            size: 36,
            id: "zoom-in",
            icon: zoomInIcon,
            title: "放大",
            color: "#007BFF",
            borderColor: "#0775D1",
            backgroundColor: "rgba(0, 0, 0, 0.52)",
          },
          {
            size: 36,
            id: "zoom-out",
            icon: zoomOutIcon,
            title: "缩小",
            color: "#007BFF",
            borderColor: "#0775D1",
            backgroundColor: "rgba(0, 0, 0, 0.52)",
          },
          {
            size: 36,
            id: "fullscreen",
            icon: fullscreenIcon,
            title: "全屏",
            color: "#007BFF",
            borderColor: "#0775D1",
            backgroundColor: "rgba(0, 0, 0, 0.52)",
          },
        ],
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
          },
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
          },
        },
        // 缩放回调
        zoom: {
          onZoomIn: (beforeLevel, afterLevel) => {
            console.log(
              `放大: ${beforeLevel.toFixed(0)} -> ${afterLevel.toFixed(0)}`
            );
          },
          onZoomOut: (beforeLevel, afterLevel) => {
            console.log(
              `缩小: ${beforeLevel.toFixed(0)} -> ${afterLevel.toFixed(0)}`
            );
          },
        },
      },
      mapInitialCenter // 传递从initCesium获取的初始中心点
    );
    mapToolbar.setTDToken(TDT_TK)
  }
});
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


.button-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
