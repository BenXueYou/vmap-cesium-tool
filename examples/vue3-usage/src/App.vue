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
import { createMapPlugin, i18n, type MapPlugin, type SearchResult } from "vmap-cesium-toolbar";
import * as Cesium from "cesium";
import { getViteTdToken } from "./common";

type Locale = "zh-CN" | "en-US";

const message = ref("");
const locale = ref<Locale>(i18n.getLocale() as Locale);
let viewer: any;
let mapPlugin: MapPlugin | null = null;
let unsubscribeI18n: (() => void) | null = null;

const showMessage = (nextMessage: string, duration = 3000) => {
  message.value = nextMessage;
  window.setTimeout(() => {
    if (message.value === nextMessage) {
      message.value = "";
    }
  }, duration);
};

const buildMockSearchResults = (query: string): SearchResult[] => [
  {
    name: query || "西湖",
    address: "杭州市西湖区",
    longitude: 120.13,
    latitude: 30.24,
    height: 50,
  },
];

const labels = computed(() => ({
  title: i18n.t("demo.title", undefined, locale.value),
  language: i18n.t("demo.language", undefined, locale.value),
  zh: i18n.t("demo.zh", undefined, locale.value),
  en: i18n.t("demo.en", undefined, locale.value),
}));

const onLocaleSelect = (event: Event) => {
  const next = (event.target as HTMLSelectElement).value as Locale;
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
  try {
    mapPlugin = createMapPlugin("cesiumContainer", {
      cesiumToken,
      viewerOptions: {
        baseLayerPicker: false,
        showRenderLoopErrors: true,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
        contextOptions: {
          webgl: {
            antialias: true,
            alpha: false,
          },
        },
        orderIndependentTranslucency: true,
        scene3DOnly: false,
        msaaSamples: 4,
      },
      camera: {
        center: [120.13, 30.24, 12000],
        pitch: -45,
        heading: 0,
        roll: 0,
      },
      layers: {
        type: "tdt",
        tdt: {
          token: getViteTdToken(),
          mapTypeId: "img",
          showLabel: true,
        },
      },
      services: {
        overlay: true,
        draw: {
          enabled: true,
          useI18n: true,
          i18n,
        },
        toolbar: {
          enabled: true,
          config: {
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
          callbacks: {
            onSearch: async (query: string) => buildMockSearchResults(query),
            onSelect: (result: SearchResult) => {
              viewer?.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(
                  result.longitude,
                  result.latitude,
                  result.height ?? 1000
                ),
                duration: 1.2,
              });
              showMessage(
                i18n.t("demo.located", { name: result.name }, locale.value)
              );
            },
            onDistanceComplete: (_positions: any[], distance: number) => {
              showMessage(
                i18n.t(
                  "demo.distance_done",
                  { distance: distance.toFixed(2) },
                  locale.value
                )
              );
            },
            onAreaComplete: (_positions: any[], area: number) => {
              showMessage(
                i18n.t(
                  "demo.area_done",
                  { area: area.toFixed(2) },
                  locale.value
                )
              );
            },
            onClear: () => {
              showMessage(i18n.t("demo.cleared", undefined, locale.value), 2000);
            },
            onZoomIn: (beforeHeight: number, afterHeight: number) => {
              showMessage(
                i18n.t(
                  "demo.zoom_in",
                  {
                    before: beforeHeight.toFixed(0),
                    after: afterHeight.toFixed(0),
                  },
                  locale.value
                ),
                2000
              );
            },
            onZoomOut: (beforeHeight: number, afterHeight: number) => {
              showMessage(
                i18n.t(
                  "demo.zoom_out",
                  {
                    before: beforeHeight.toFixed(0),
                    after: afterHeight.toFixed(0),
                  },
                  locale.value
                ),
                2000
              );
            },
          },
        },
      },
    });

    viewer = markRaw(await mapPlugin.initialize());
  } catch (error) {
    console.error("地图初始化失败:", error);
    showMessage("地图初始化失败，请检查 Token 或网络配置。", 4000);
  }
});

onUnmounted(() => {
  if (unsubscribeI18n) {
    unsubscribeI18n();
  }

  mapPlugin?.destroy();
  mapPlugin = null;
  viewer = null;
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
