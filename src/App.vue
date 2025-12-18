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
import { initCesium } from "./libs/CesiumMapLoader";
import { CesiumMapToolbar } from "./libs/CesiumMapToolbar";
import type { ToolbarConfig } from "./libs/CesiumMapModel";
import DrawHelper from "./libs/toolBar/CesiumMapHelper";
import { useToolBarConfig } from "./hooks/toolBarConfig";
import { getViteTdToken, getViteCesiumToken } from "./utils/common";
import * as Cesium from "cesium";

let viewer = ref();
const message = ref("");
let drawHelper: DrawHelper | null = null;
let mapToolbar: CesiumMapToolbar | null = null;
const TDT_TK = getViteTdToken();
const { toolbarConfig, toolbarCallback } = useToolBarConfig(viewer, message);

// 初始化地图
onMounted(async () => {
  Cesium.Ion.defaultAccessToken = getViteCesiumToken();
  const { viewer: cesiumViewer, initialCenter } = await initCesium(
    "cesiumContainer",
    {
      isFly: true,
      token: TDT_TK,
      mapType: 'tiandi',
      requestRenderMode: true, // 手动请求渲染
      maximumRenderTimeChange: 0.01, // 动画平衡
      baseLayerPicker: false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      success: () => {
        console.log('初始化地图成功');
        // STEP 3 CODE (first point)
        // This is one of the first radar samples collected for our flight.
        // const dataPoint = { longitude: -122.38985, latitude: 37.61864, height: -27.32 };
        // // Mark this location with a red point.
        // const pointEntity = cesiumViewer.entities.add({
        //   description: `First data point at (${dataPoint.longitude}, ${dataPoint.latitude})`,
        //   position: Cesium.Cartesian3.fromDegrees(dataPoint.longitude, dataPoint.latitude, dataPoint.height),
        //   point: { pixelSize: 10, color: Cesium.Color.RED }
        // });
        // // Fly the camera to this point.
        // cesiumViewer.flyTo(pointEntity);
      },
      cancel: () => {
        console.log('初始化地图取消');
      }
    },
  );
  // 调试用：挂到全局
  (window as any).cesiumViewer = cesiumViewer;
  viewer.value = cesiumViewer;
  viewer.value.scene.globe.depthTestAgainstTerrain = true; // 启用地形深度测
  viewer.value._cesiumWidget._creditContainer.style.display = "none"; // 去掉左下角的Cesium商标

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
      toolbarConfig as ToolbarConfig,
      toolbarCallback,
      mapInitialCenter
    );
    mapToolbar.setTDToken(TDT_TK);

    // 添加自定义按钮
    // 1. 测试添加报警按钮
    mapToolbar.addCustomButton({
      id: 'test-alert',
      icon: '🚨',
      title: '测试添加报警',
      size: 36,
      color: '#FF4444',
      backgroundColor: 'rgba(0, 0, 0, 0.52)',
      borderColor: '#FF4444',
      onClick: (buttonId: string, buttonElement: HTMLElement) => {
        console.log('测试添加报警按钮被点击');
        message.value = '测试报警：这是一个测试报警信息';
        setTimeout(() => {
          message.value = '';
        }, 3000);
        // 可以在这里添加实际的报警逻辑
      }
    });

    // 2. 数据统计按钮
    mapToolbar.addCustomButton({
      id: 'data-statistics',
      icon: '📊',
      title: '数据统计',
      size: 36,
      color: '#007BFF',
      backgroundColor: 'rgba(0, 0, 0, 0.52)',
      borderColor: '#0775D1',
      onClick: (buttonId: string, buttonElement: HTMLElement) => {
        console.log('数据统计按钮被点击');
        message.value = '数据统计功能：显示统计数据';
        setTimeout(() => {
          message.value = '';
        }, 3000);
        // 可以在这里添加数据统计的逻辑，比如显示统计面板
      }
    });

    // 3. 可见配置项按钮
    mapToolbar.addCustomButton({
      id: 'visibility-config',
      icon: '⚙️',
      title: '可见配置项',
      size: 36,
      color: '#28A745',
      backgroundColor: 'rgba(0, 0, 0, 0.52)',
      borderColor: '#28A745',
      onClick: (buttonId: string, buttonElement: HTMLElement) => {
        console.log('可见配置项按钮被点击');
        message.value = '可见配置项：配置图层可见性';
        setTimeout(() => {
          message.value = '';
        }, 3000);
        // 可以在这里添加可见性配置的逻辑，比如显示配置面板
      }
    });
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
