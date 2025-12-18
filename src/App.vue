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

    // 添加自定义按钮（使用 sort 参数控制位置）
    // 默认按钮的 sort 值：search(0), measure(1), view2d3d(2), layers(3), location(4), zoom-in(5), zoom-out(6), fullscreen(7)
    
    // 1. 测试添加报警按钮 - 插入到搜索和测量之间（sort: 0.5）
    mapToolbar.addCustomButton({
      id: 'test-alert',
      icon: '🚨',
      title: '测试添加报警',
      size: 36,
      color: '#FF4444',
      backgroundColor: 'rgba(0, 0, 0, 0.52)',
      borderColor: '#FF4444',
      sort: 0.5, // 插入到搜索(0)和测量(1)之间
      onClick: (buttonId: string, buttonElement: HTMLElement) => {
        console.log('测试添加报警按钮被点击');
        message.value = '测试报警：这是一个测试报警信息';
        setTimeout(() => {
          message.value = '';
        }, 3000);
        // 可以在这里添加实际的报警逻辑
      }
    });

    // 2. 数据统计按钮 - 插入到图层切换和定位之间（sort: 3.5）
    mapToolbar.addCustomButton({
      id: 'data-statistics',
      icon: '📊',
      title: '数据统计',
      size: 36,
      color: '#007BFF',
      backgroundColor: 'rgba(0, 0, 0, 0.52)',
      borderColor: '#0775D1',
      sort: 3.5, // 插入到图层切换(3)和定位(4)之间
      onClick: (buttonId: string, buttonElement: HTMLElement) => {
        console.log('数据统计按钮被点击');
        message.value = '数据统计功能：显示统计数据';
        setTimeout(() => {
          message.value = '';
        }, 3000);
        // 可以在这里添加数据统计的逻辑，比如显示统计面板
      }
    });

    // 3. 可见配置项按钮 - 插入到定位和缩放之间（sort: 4.5）
    mapToolbar.addCustomButton({
      id: 'visibility-config',
      icon: '⚙️',
      title: '可见配置项',
      size: 36,
      color: '#28A745',
      backgroundColor: 'rgba(0, 0, 0, 0.52)',
      borderColor: '#28A745',
      sort: 4.5, // 插入到定位(4)和缩放(5)之间
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
