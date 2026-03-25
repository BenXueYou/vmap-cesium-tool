<template>
  <div class="cesium-container">
    <div id="cesiumContainer" ref="cesiumContainer"></div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, shallowRef, onBeforeUnmount } from "vue";
import { getViteTdToken, getViteCesiumToken } from "./utils/common.ts";
import {
  createMapPlugin,
  MapPlugin,
  OverlayService,
  DrawService,
  HeatmapLayer,
  PointClusterLayer,
} from "./index.ts";
import { createToolbarService } from "./core/services/toolbar";
import {
  DEFAULT_BUTTON_CONFIGS,
  DEFAULT_TOOLBAR_STYLE,
} from "./core/constants";
import searchIcon from "./assets/images/toolbar/search@3x.png";
import measureIcon from "./assets/images/toolbar/measure@3x.png";
import view2dIcon from "./assets/images/toolbar/view_2d@3x.png";
import layersIcon from "./assets/images/toolbar/layers@3x.png";
import locationIcon from "./assets/images/toolbar/location@3x.png";
import zoomInIcon from "./assets/images/toolbar/zoom-in@3x.png";
import zoomOutIcon from "./assets/images/toolbar/zoom-out@3x.png";
import fullscreenIcon from "./assets/images/toolbar/fullscreen@3x.png";
import * as Cesium from 'cesium';

// 响应式数据
const cesiumContainer = ref<HTMLElement>();
const mapPlugin = shallowRef<MapPlugin | null>(null);
const overlayService = shallowRef<OverlayService | null>(null);
const drawService = shallowRef<DrawService | null>(null);
let toolbarService: any = null;

console.log('组件初始化 - 变量已定义', getViteCesiumToken());

// 初始化地图
const initMap = async () => {
  try {
    const cesiumTokenValue = getViteCesiumToken();
    const tdTokenValue = getViteTdToken();
    console.log('使用天地图 token:', tdTokenValue, '使用 Cesium token:', cesiumTokenValue ? '[已提供]' : '[未提供]');

    // 1. 创建地图插件 - 新框架的核心入口
    // 使用分层配置结构：viewerOptions | camera | layers
    mapPlugin.value = await createMapPlugin('cesiumContainer', {
      // Cesium Ion token
      cesiumToken: cesiumTokenValue,
      
      // Cesium Viewer 原生配置（可选）
      viewerOptions: {
        // 可以在这里添加更多 Cesium 原生配置
        // terrainProvider: await createWorldTerrainAsync(),
      },
      
      // 相机/视图配置
      camera: {
        center: [116.3974, 39.9093, 1000] as [number, number, number], // 北京天安门 [经度，纬度，高度]
        pitch: -45,    // 俯仰角（度）
        heading: 0,    // 朝向角（度）
        roll: 0,       // 翻滚角（度）
      },
      
      // 图层配置 - 默认使用天地图
      layers: {
        type: 'tdt',  // 地图提供商类型：'tdt' | 'gaode' | 'baidu' | 'osm' | 'custom'
        tdt: {
          mapTypeId: 'img',     // 天地图子类型：'vec' | 'img' | 'ter'
          token: tdTokenValue,  // 天地图 token
          showLabel: true,      // 是否显示注记层
        }
      }
    });

    const viewer = await mapPlugin.value.initialize();
    console.log('地图初始化成功!', viewer);

    // 2. 初始化工具栏服务
    const toolbarContainer = cesiumContainer.value as HTMLElement;

    const toolbarOptions = {
      toolbarStyle: {
        position: 'bottom-right',
        buttonSize: 36,
        buttonSpacing: 8,
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        zIndex: 1100,
      },
      buttonConfigs: [
        { 
          id: 'search',
          icon: searchIcon,
          backgroundColor: 'rgba(0, 0, 0, 0.52)',
          borderColor: 'rgba(9, 109, 236, 0.85)',
          color: '#ffffff',
          hoverColor: 'rgba(9, 109, 236, 0.95)',
        },
        {
          id: 'measure',
          icon: measureIcon,
          backgroundColor: 'rgba(0, 0, 0, 0.52)',
          borderColor: 'rgba(9, 109, 236, 0.85)',
          color: '#ffffff',
          hoverColor: 'rgba(9, 109, 236, 0.95)',
        },
        {
          id: 'view2d3d',
          icon: '3D',
          activeIcon: '2D',
          backgroundColor: 'rgba(0, 0, 0, 0.52)',
          borderColor: 'rgba(9, 109, 236, 0.85)',
          color: 'rgba(9, 109, 236, 0.85)',
          hoverColor: 'rgba(9, 109, 236, 0.95)',
        },
        {
          id: 'layers',
          icon: layersIcon,
          backgroundColor: 'rgba(0, 0, 0, 0.52)',
          borderColor: 'rgba(9, 109, 236, 0.85)',
          color: '#ffffff',
          hoverColor: 'rgba(9, 109, 236, 0.95)',
        },
        {
          id: 'location',
          icon: locationIcon,
          backgroundColor: 'rgba(0, 0, 0, 0.52)',
          borderColor: 'rgba(9, 109, 236, 0.85)',
          color: '#ffffff',
          hoverColor: 'rgba(9, 109, 236, 0.95)',
        },
        {
          id: 'zoom-in',
          icon: zoomInIcon,
          backgroundColor: 'rgba(0, 0, 0, 0.52)',
          borderColor: 'rgba(9, 109, 236, 0.85)',
          color: '#ffffff',
          hoverColor: 'rgba(9, 109, 236, 0.95)',
        },
        {
          id: 'zoom-out',
          icon: zoomOutIcon,
          backgroundColor: 'rgba(0, 0, 0, 0.52)',
          borderColor: 'rgba(9, 109, 236, 0.85)',
          color: '#ffffff',
          hoverColor: 'rgba(9, 109, 236, 0.95)',
        },
        {
          id: 'fullscreen',
          icon: fullscreenIcon,
          backgroundColor: 'rgba(0, 0, 0, 0.52)',
          borderColor: 'rgba(9, 109, 236, 0.85)',
          color: '#ffffff',
          hoverColor: 'rgba(9, 109, 236, 0.95)',
        },
      ],
    };

    toolbarService = createToolbarService({
      viewer,
      container: toolbarContainer,
      layers: {
        mapTypes: [
          { id: 'vec', name: '天地图矢量' },
          { id: 'img', name: '天地图影像' },
          { id: 'ter', name: '天地图地形' },
        ],
        currentMapType: 'img',
        token: tdTokenValue,
        onMapTypeChange: (selected) => {
          mapPlugin.value?.updateLayers({
            type: 'tdt',
            tdt: {
              mapTypeId: selected,
              token: tdTokenValue,
              showLabel: true,
            },
          });
        },
      },
      callbacks: {
        onSearch: async (query: string) => {
          const presets = [
            { name: '天安门', address: '北京', longitude: 116.3974, latitude: 39.9093, height: 1000 },
            { name: '奥林匹克公园', address: '北京', longitude: 116.3906, latitude: 39.9923, height: 1000 },
          ];
          return presets.filter(item => item.name.includes(query) || item.address.includes(query));
        },
        onSelect: (result: any) => {
          if (!viewer) return;
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(result.longitude, result.latitude, result.height || 1000),
            duration: 1.2,
          });
        },
        onMeasurementStart: () => {
          console.log('开始测量');
        },
        onClear: () => {
          console.log('清除测量数据');
        },
      },
    }, toolbarOptions);

    // MapController 实现，支持按钮行为：2D/3D、定位、缩放、全屏
    const mapController = {
      toggle2D3D: (buttonElement: HTMLElement) => {
        if (!viewer) return;
        const curMode = viewer.scene.mode;
        if (curMode === Cesium.SceneMode.SCENE3D) {
          viewer.scene.morphTo2D(1.0);
          buttonElement.classList.add('active');
        } else {
          viewer.scene.morphTo3D(1.0);
          buttonElement.classList.remove('active');
        }
      },
      resetLocation: () => {
        if (!viewer) return;
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(116.3974, 39.9093, 1000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-45),
            roll: Cesium.Math.toRadians(0),
          },
        });
      },
      zoomIn: () => {
        if (!viewer) return;
        viewer.camera.zoomIn(500);
      },
      zoomOut: () => {
        if (!viewer) return;
        viewer.camera.zoomOut(500);
      },
      toggleFullscreen: () => {
        const el = document.documentElement;
        if (!document.fullscreenElement) {
          el.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
      },
    };

    toolbarService.setMapController(mapController);
    toolbarService.initialize();

    console.log('新框架地图加载完成!');

  } catch (error) {
    console.error('地图初始化失败:', error);
  }
};

// 组件挂载时初始化
onMounted(() => {
  initMap();
});

// 组件卸载时清理
onBeforeUnmount(() => {
  if (toolbarService) {
    toolbarService.destroy();
    toolbarService = null;
  }

  if (mapPlugin.value) {
    // 清理地图插件
    mapPlugin.value.destroy();
  }
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
