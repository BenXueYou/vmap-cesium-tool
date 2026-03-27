import { shallowRef } from "vue";
import * as Cesium from 'cesium';
import { getViteTdToken, getViteCesiumToken } from "../utils/common.ts";
import { createMapPlugin, MapPlugin, ToolbarService, type DrawOptions, type SearchResult } from "../index.ts";
import { TD_Map_Search_URL, China_Map_Extent } from "./useMap";
import { toolbarLayersMenu, toolbarSearchMenu, toolbarButtonConfigs } from "../z.const.ts";

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

function mapSearchResults(query: string, pois: any[]): SearchResult[] {
  return pois.map((location: any) => {
    const [longitude = '0', latitude = '0'] = String(location?.lonlat ?? '').split(',');

    return {
      name: location?.name || query,
      address: location?.address || '',
      longitude: Number(longitude || 0),
      latitude: Number(latitude || 0),
      height: 100,
    };
  });
}

export function useMapInit(containerId = 'cesiumContainer') {
  const mapPlugin = shallowRef<MapPlugin | null>(null);
  const toolbarService = shallowRef<ToolbarService | null>(null);
  const viewer = shallowRef<Cesium.Viewer | null>(null);

  const initMap = async (): Promise<Cesium.Viewer | null> => {
    if (viewer.value) {
      return viewer.value;
    }

    try {
      const cesiumTokenValue = getViteCesiumToken();
      const tdTokenValue = getViteTdToken();

      mapPlugin.value = createMapPlugin(containerId, {
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

                  return mapSearchResults(query, pois);
                } catch (error) {
                  console.error('搜索失败:', error);
                  return [];
                }
              },
              onSelect: (result: SearchResult) => {
                viewer.value?.camera.flyTo({
                  destination: Cesium.Cartesian3.fromDegrees(result.longitude, result.latitude, result.height || 1000),
                  duration: 1.2,
                });
              },
              onMeasurementStart: () => {
                console.log('开始测量');
              },
              onMeasurementComplete: (result: MeasurementResult) => {
                console.log('测量结果:', result);
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

      viewer.value = await mapPlugin.value.initialize();
      toolbarService.value = mapPlugin.value.getToolbarService();

      return viewer.value;
    } catch (error) {
      console.error('地图初始化失败:', error);
      return null;
    }
  };

  const destroyMap = (): void => {
    mapPlugin.value?.destroy();
    mapPlugin.value = null;
    toolbarService.value = null;
    viewer.value = null;
  };

  return {
    mapPlugin,
    toolbarService,
    viewer,
    initMap,
    destroyMap,
  };
}
