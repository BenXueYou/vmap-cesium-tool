<template>
  <div class="app">
    <div id="cesiumContainer" class="map"></div>
    <div class="i18n-panel">
      <div class="i18n-title">{{ labels.title }}</div>
      <label class="i18n-row">
        <span class="i18n-label">{{ labels.language }}</span>
        <select class="i18n-select" :value="locale" @change="onLocaleSelect">
          <option value="zh-CN">{{ labels.zh }}</option>
          <option value="en-US">{{ labels.en }}</option>
        </select>
      </label>
    </div>
    <div v-if="message" class="message">{{ message }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, markRaw } from "vue";
import { CesiumMapToolbar, initCesium, i18n } from "vmap-cesium-toolbar";
import * as Cesium from "cesium";
import { getViteTdToken } from "./common";

const message = ref("");
const locale = ref(i18n.getLocale());
let viewer: any;
let toolbar: CesiumMapToolbar | null = null;
let unsubscribeI18n: (() => void) | null = null;

const labels = computed(() => ({
  title: i18n.t("demo.title", undefined, locale.value),
  language: i18n.t("demo.language", undefined, locale.value),
  zh: i18n.t("demo.zh", undefined, locale.value),
  en: i18n.t("demo.en", undefined, locale.value),
}));

const onLocaleSelect = (event: Event) => {
  const next = (event.target as HTMLSelectElement).value as "zh-CN" | "en-US";
  i18n.setLocale(next, { persist: false });
};

onMounted(async () => {
  i18n.configure({
    persist: false,
    useStoredLocale: false,
    fallbackLocale: "zh-CN",
  });

  locale.value = i18n.getLocale();

  unsubscribeI18n = i18n.onLocaleChange((next) => {
    locale.value = next;
  });

  // 设置 Cesium Token（请替换为你的 Token）

  const cesiumToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxNDNmMGRiZC1mZTAyLTQ5ZTItOWI2Ni1mOTJlZjBhODJlZDAiLCJpZCI6MzYyMzk0LCJpYXQiOjE3NjM2OTA5ODB9.9FbL7xdcG6TnSefrH08xSL_gIBfIoiziZoBacJ3tq60";
  Cesium.Ion.defaultAccessToken = cesiumToken;
  Cesium.IonResource.fromAssetId = () => {
    throw new Error('Cesium ion is disabled');
  };
  const { viewer: cesiumViewer } = await initCesium(
    "cesiumContainer",
    {
      token: getViteTdToken(),
      mapType: 'tiandi',
      isFly: true,
      baseLayerPicker: false,
      showRenderLoopErrors: true,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      contextOptions: {
        webgl: {
          antialias: true,    // 启用抗锯齿
          alpha: false,       // 关闭 alpha 通道以提升性能
        }
      },
      // 其他相关配置
      orderIndependentTranslucency: true,
      fxaa: true, // 启用FXAA后处理抗锯齿
      scene3DOnly: false,
      msaaSamples: 4, // MSAA采样数（推荐4或8）
      success: () => {
        console.log(i18n.t('app.init_success'));
      },
    },
    cesiumToken
  );
  viewer = markRaw(cesiumViewer);

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
        useI18n: true,
        i18n,
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
            message.value = i18n.t(
              "demo.located",
              { name: result.name },
              locale.value
            );
            setTimeout(() => (message.value = ""), 3000);
          },
        },
        measurement: {
          onDistanceComplete: (positions: any, distance: number) => {
            message.value = i18n.t(
              "demo.distance_done",
              { distance: distance.toFixed(2) },
              locale.value
            );
            setTimeout(() => (message.value = ""), 3000);
          },
          onAreaComplete: (positions: any, area: number) => {
            message.value = i18n.t(
              "demo.area_done",
              { area: area.toFixed(2) },
              locale.value
            );
            setTimeout(() => (message.value = ""), 3000);
          },
          onClear: () => {
            message.value = i18n.t("demo.cleared", undefined, locale.value);
            setTimeout(() => (message.value = ""), 2000);
          },
        },
        zoom: {
          onZoomIn: (beforeLevel: number, afterLevel: number) => {
            message.value = i18n.t(
              "demo.zoom_in",
              { before: beforeLevel, after: afterLevel },
              locale.value
            );
            setTimeout(() => (message.value = ""), 2000);
          },
          onZoomOut: (beforeLevel: number, afterLevel: number) => {
            message.value = i18n.t(
              "demo.zoom_out",
              { before: beforeLevel, after: afterLevel },
              locale.value
            );
            setTimeout(() => (message.value = ""), 2000);
          },
        },
      }
    );
    toolbar.setTDToken(getViteTdToken());
  }
});

onUnmounted(() => {
  if (unsubscribeI18n) {
    unsubscribeI18n();
  }
});
</script>

<style scoped>
.app {
  width: 100vw;
  height: 100vh;
  position: relative;
}

.map {
  width: 100%;
  height: 100%;
}

.i18n-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  z-index: 1100;
  min-width: 150px;
}

.i18n-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2d3d;
}

.i18n-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: #425466;
}

.i18n-select {
  flex: 1;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #d0d7de;
  font-size: 12px;
}

.message {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  border-radius: 16px;
  font-size: 12px;
  z-index: 1100;
}
</style>
