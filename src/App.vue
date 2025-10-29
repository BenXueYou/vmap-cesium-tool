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
import DrawHelper from "./libs/CesiumMapHelper";
import { useToolBarConfig } from "./hooks/toolBarConfig";
import { getViteTdToken } from "./utils/common";

const message = ref("");
let viewer = ref();
let mapToolbar: CesiumMapToolbar | null = null;
let drawHelper: DrawHelper | null = null;
const TDT_TK = getViteTdToken();
const CesiumToken = import.meta.env.VITE_CESIUM_TOKEN;

const { toolbarConfig, toolbarCallback } = useToolBarConfig(message);

// 初始化地图
onMounted(async () => {
  const { viewer: cesiumViewer, initialCenter } = await initCesium(
    "cesiumContainer",
    {
      token: TDT_TK,
      mapType: 'tiandi',
    }
  );
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
      mapInitialCenter // 传递从initCesium获取的初始中心点
    );
    mapToolbar.setTDToken(TDT_TK);
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
