<template>
  <div class="cesium-container">
    <div id="cesiumContainer" ref="cesiumContainer"></div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, shallowRef, onBeforeUnmount } from "vue";
import * as Cesium from 'cesium';
import { getViteTdToken, getViteCesiumToken } from "./utils/common.ts";
import { createMapPlugin, MapPlugin, ToolbarService, type DrawOptions, type SearchResult } from "./index.ts";
import { TD_Map_Search_URL, China_Map_Extent } from "./hooks/useMap";
import { toolbarLayersMenu, toolbarSearchMenu, toolbarButtonConfigs } from "./z.const.ts";
import searchIcon from "./assets/images/toolbar/search@3x.png";
import measureIcon from "./assets/images/toolbar/measure@3x.png";
import layersIcon from "./assets/images/toolbar/layers@3x.png";
import locationIcon from "./assets/images/toolbar/location@3x.png";
import zoomInIcon from "./assets/images/toolbar/zoom-in@3x.png";
import zoomOutIcon from "./assets/images/toolbar/zoom-out@3x.png";
import fullscreenIcon from "./assets/images/toolbar/fullscreen@3x.png";

const distanceDrawOptions: DrawOptions = {
  measurementTheme: {
    stroke: {
      color: 'rgba(22, 92, 201, 0.96)',
      width: 3,
      clampToGround: true,
    },
    vertex: {
      pixelSize: 11,
      color: '#20b7ff',
      outlineColor: '#ffffff',
      outlineWidth: 1,
    },
    segmentDistanceLabel: {
      backgroundColor: 'rgba(228, 235, 245, 0.96)',
      textColor: '#10233f',
      borderRadius: 10,
      pixelOffset: { x: 0, y: -10 },
    },
    totalDistanceLabel: {
      backgroundColor: 'rgba(22, 92, 201, 0.96)',
      textColor: '#ffffff',
      borderRadius: 12,
      pixelOffset: { x: 0, y: -34 },
    },
    hintBubble: {
      backgroundColor: 'rgba(72, 78, 92, 0.92)',
      textColor: '#ffffff',
      borderRadius: 10,
      pixelOffset: { x: 96, y: -16 },
    },
  },
};

const areaDrawOptions: DrawOptions = {
  measurementTheme: {
    stroke: {
      color: 'rgba(22, 92, 201, 0.96)',
      width: 3,
      clampToGround: true,
    },
    fill: {
      color: 'rgba(0, 132, 110, 0.24)',
    },
    vertex: {
      pixelSize: 11,
      color: '#20b7ff',
      outlineColor: '#ffffff',
      outlineWidth: 1,
    },
    previewAreaLabel: {
      backgroundColor: 'rgba(228, 235, 245, 0.96)',
      textColor: '#12304f',
      borderRadius: 10,
      pixelOffset: { x: 0, y: -8 },
    },
    totalAreaLabel: {
      backgroundColor: 'rgba(0, 132, 110, 0.96)',
      textColor: '#ffffff',
      borderRadius: 12,
      pixelOffset: { x: 0, y: -10 },
    },
    hintBubble: {
      backgroundColor: 'rgba(72, 78, 92, 0.92)',
      textColor: '#ffffff',
      borderRadius: 10,
      pixelOffset: { x: 96, y: -16 },
    },
  },
};

const cesiumContainer = ref<HTMLElement>();
const mapPlugin = shallowRef<MapPlugin | null>(null);
const toolbarService = shallowRef<ToolbarService | null>(null);

const initMap = async () => {
  try {
    const cesiumTokenValue = getViteCesiumToken();
    const tdTokenValue = getViteTdToken();

    mapPlugin.value = createMapPlugin('cesiumContainer', {
      cesiumToken: cesiumTokenValue,
      viewerOptions: {
        animation: false,
        timeline: false,
        navigationHelpButton: false,
      },
      camera: {
        center: [116.3974, 39.9093, 1000] as [number, number, number],
        pitch: -45,
        heading: 0,
        roll: 0,
      },
      layers: {
        type: 'tdt',
        tdt: {
          mapTypeId: 'img',
          token: tdTokenValue,
          showLabel: true,
        },
      },
      services: {
        overlay: true,
        draw: true,
        toolbar: {
          enabled: true,
          config: {
            position: 'bottom-right',
            buttonSize: 36,
            buttonSpacing: 8,
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            zIndex: 1100,
          },
          searchMenu: toolbarSearchMenu,
          layersMenu: toolbarLayersMenu,
          buttonConfigs: toolbarButtonConfigs,
          callbacks: {
            onSearch: async (query: string): Promise<SearchResult[]> => {
              try {
                const url = TD_Map_Search_URL(query, China_Map_Extent);
                const response = await fetch(url, {
                  method: 'GET',
                  mode: 'cors',
                  credentials: 'omit',
                  headers: {
                    Accept: 'application/json',
                  },
                });

                if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                const pois = data?.data?.pois || data?.pois || [];
                console.log('搜索结果:', pois);
                return pois.map((location: any) => ({
                  name: location?.name || query,
                  address: location?.address || '',
                  longitude: Number(location?.lonlat?.split(',')[0] || 0),
                  latitude: Number(location?.lonlat?.split(',')[1] || 0),
                  height: 100,
                }));
              } catch (error) {
                console.error('搜索失败:', error);
                return [];
              }
            },
            onSelect: (result: any) => {
              viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(result.longitude, result.latitude, result.height || 1000),
                duration: 1.2,
              });
            },
            onMeasurementStart: () => {
              console.log('开始测量');
            },
            getDistanceDrawOptions: () => distanceDrawOptions,
            getAreaDrawOptions: () => areaDrawOptions,
            onClear: () => {
              console.log('清除测量数据');
            },
          },
        },
      },
    });

    const viewer = await mapPlugin.value.initialize();
    toolbarService.value = mapPlugin.value.getToolbarService();
  } catch (error) {
    console.error('地图初始化失败:', error);
  }
};

onMounted(() => {
  initMap();
});

onBeforeUnmount(() => {
  mapPlugin.value?.destroy();
  toolbarService.value = null;
});
</script>

<style scoped>
.cesium-container {
  position: relative;
  width: 100%;
  height: 100vh;

  #cesiumContainer {
    width: 100%;
    height: 100%;
  }
}

.test-button-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1001;

  .action-row {
    display: flex;
  }
}

.action-select {
  min-width: 260px;
  max-width: 360px;
  height: 34px;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #fff;
  background: rgba(0, 0, 0, 0.52);
  outline: none;
}

.action-select option {
  color: #000;
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

/* 新框架演示控件样式 */
.demo-controls {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1001;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 320px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.control-group {
  margin-bottom: 16px;
}

.control-group h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}

.button-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.demo-btn {
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: #007acc;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.demo-btn:hover {
  background: #0056b3;
  transform: translateY(-1px);
}

.demo-btn.danger {
  background: #dc3545;
}

.demo-btn.danger:hover {
  background: #c82333;
}

.info-panel {
  border-top: 1px solid #e0e0e0;
  padding-top: 12px;
}

.info-panel h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.info-panel ul {
  margin: 0;
  padding-left: 16px;
  list-style: none;
}

.info-panel li {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
  line-height: 1.4;
}
</style>
