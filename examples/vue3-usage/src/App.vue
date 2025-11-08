<template>
  <div style="width:100vw;height:100vh;">
    <div id="cesiumContainer" style="width:100%;height:100vh;"></div>
    <div v-if="message" class="message">{{ message }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { CesiumMapToolbar, initCesium } from "vmap-cesium-toolbar";
import * as Cesium from "cesium";

const message = ref("");
let viewer: any;
let toolbar: CesiumMapToolbar | null = null;

onMounted(async () => {
  // 设置 Cesium Token（请替换为你的 Token）
  Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3M2M3NWU1Ni0xZmJkLTRkNjAtOTk4NC0wZDZhNWFiOWJlZDEiLCJpZCI6MzMxNTg1LCJpYXQiOjE3NTUyMjQ2MzB9.WBUG7ctHKtOrnay1ng8JNfaNgngbkNgOmRXP59OJ7ME";

  const { viewer: cesiumViewer } = await initCesium(
    "cesiumContainer",
    {
      token: '2cca1367384c44b8b0196b47108b2813',
      mapType: 'tiandi',
      isFly: true,
    }
  );
  viewer = cesiumViewer;

  const cesiumContainer = document.getElementById("cesiumContainer");
  if (cesiumContainer) {
    toolbar = new CesiumMapToolbar(
      viewer,
      cesiumContainer,
      {
        position: "bottom-right",
        buttonSize: 45,
        buttonSpacing: 10,
        backgroundColor: "rgba(255,255,255,0.95)",
        borderColor: "#4285f4",
        borderRadius: 8,
        zIndex: 1000,
      },
      {
        search: {
          onSearch: async (query: string) => {
            // 模拟搜索
            return [
              {
                name: "西湖",
                address: "杭州市西湖区",
                longitude: 120.13,
                latitude: 30.24,
                height: 50,
              },
            ];
          },
          onSelect: (result: any) => {
            message.value = `已定位到: ${result.name}`;
            setTimeout(() => (message.value = ""), 3000);
          },
        },
        measurement: {
          onDistanceComplete: (positions: any, distance: number) => {
            message.value = `测距完成，总距离: ${distance.toFixed(2)} 米`;
            setTimeout(() => (message.value = ""), 3000);
          },
          onAreaComplete: (positions: any, area: number) => {
            message.value = `测面积完成，面积: ${area.toFixed(2)} 平方米`;
            setTimeout(() => (message.value = ""), 3000);
          },
          onClear: () => {
            message.value = "已清除测量内容";
            setTimeout(() => (message.value = ""), 2000);
          },
        },
        zoom: {
          onZoomIn: (beforeLevel: number, afterLevel: number) => {
            message.value = `放大: ${beforeLevel}m -> ${afterLevel}m`;
            setTimeout(() => (message.value = ""), 2000);
          },
          onZoomOut: (beforeLevel: number, afterLevel: number) => {
            message.value = `缩小: ${beforeLevel}m -> ${afterLevel}m`;
            setTimeout(() => (message.value = ""), 2000);
          },
        },
      }
    );
  }
});
</script>
