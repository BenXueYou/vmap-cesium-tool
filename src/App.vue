<template>
  <div class="cesium-container">
    <div id="cesiumContainer" ref="cesiumContainer" style="width: 100%; height: 100vh"></div>
    <!-- 消息提示 -->
    <div v-if="message" class="message">{{ message }}</div>
    <div class="test-button-group">
      <button @click="addMarker">添加点位</button>
      <button @click="addLine">添加线条</button>
      <button @click="addArea">添加区域</button>
      <button @click="addCircle">添加圆形</button>
      <button @click="addPolygon">添加多边形</button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, onBeforeUnmount } from "vue";
import { initCesium } from "./libs/CesiumMapLoader";
import { CesiumMapToolbar } from "./libs/CesiumMapToolbar";
import type { ToolbarConfig } from "./libs/CesiumMapModel";
import DrawHelper from "./libs/CesiumMapHelper";
import { useToolBarConfig } from "./hooks/toolBarConfig";
import { getViteTdToken, getViteCesiumToken } from "./utils/common";
import * as Cesium from "cesium";

let viewer = ref<Cesium.Viewer>();
const message = ref("");
let drawHelper: DrawHelper | null = null;
let mapToolbar: CesiumMapToolbar | null = null;
const TDT_TK = getViteTdToken();
const { toolbarConfig, toolbarCallback } = useToolBarConfig(viewer.value, message);

// 绘制状态
const isDrawing = ref(false);
const currentDrawMode = ref<string | null>(null);
let markerHandler: Cesium.ScreenSpaceEventHandler | null = null;
let markerEntities: Cesium.Entity[] = [];

/**
 * 添加点位 - 点击地图添加标记点
 */
const addMarker = () => {
  
};

/**
 * 取消点位添加模式
 */
const cancelMarkerMode = () => {
  if (markerHandler) {
    markerHandler.destroy();
    markerHandler = null;
  }
  currentDrawMode.value = null;
  message.value = '';
};

/**
 * 添加线条
 */
const addLine = () => {
  if (!drawHelper) return;
  
  // 取消其他绘制模式
  cancelMarkerMode();
  if (isDrawing.value && currentDrawMode.value !== 'line') {
    drawHelper.endDrawing();
  }
  
  currentDrawMode.value = 'line';
  isDrawing.value = true;
  drawHelper.startDrawingLine(
    {
      strokeWidth: 4,
      strokeColor: Cesium.Color.BLUE,
    }
  );
  message.value = '开始绘制线条：左键添加点，双击完成，右键删除最后一点';
  
  // 监听绘制完成
  drawHelper.onDrawEnd(() => {
    isDrawing.value = false;
    currentDrawMode.value = null;
    message.value = '线条绘制完成';
    setTimeout(() => {
      message.value = '';
    }, 2000);
  });
};

/**
 * 添加区域（矩形）
 */
const addArea = () => {
  if (!drawHelper) return;
  
  cancelMarkerMode();
  if (isDrawing.value && currentDrawMode.value !== 'rectangle') {
    drawHelper.endDrawing();
  }
  
  currentDrawMode.value = 'rectangle';
  isDrawing.value = true;
  drawHelper.startDrawingRectangle({
    fillColor: Cesium.Color.YELLOW.withAlpha(0.5),
    outlineColor: Cesium.Color.YELLOW,
    outlineWidth: 2,
    onClick: (entity: Cesium.Entity) => {
      console.log('矩形区域点击:', entity);
    }
  });
  message.value = '开始绘制矩形区域：左键确定起点，再次左键确定终点，双击完成';
  
  drawHelper.onDrawEnd(() => {
    isDrawing.value = false;
    currentDrawMode.value = null;
    message.value = '矩形区域绘制完成';
    setTimeout(() => {
      message.value = '';
    }, 2000);
  });
};

/**
 * 添加圆形
 */
const addCircle = () => {
  if (!drawHelper) return;
  
  cancelMarkerMode();
  if (isDrawing.value && currentDrawMode.value !== 'circle') {
    drawHelper.endDrawing();
  }
  
  currentDrawMode.value = 'circle';
  isDrawing.value = true;
  drawHelper.startDrawingCircle();
  message.value = '开始绘制圆形：左键确定圆心，再次左键确定半径，双击完成';
  
  drawHelper.onDrawEnd(() => {
    isDrawing.value = false;
    currentDrawMode.value = null;
    message.value = '圆形绘制完成';
    setTimeout(() => {
      message.value = '';
    }, 2000);
  });
};

/**
 * 添加多边形
 */
const addPolygon = () => {
  if (!drawHelper) return;
  
  cancelMarkerMode();
  if (isDrawing.value && currentDrawMode.value !== 'polygon') {
    drawHelper.endDrawing();
  }
  
  currentDrawMode.value = 'polygon';
  isDrawing.value = true;
  drawHelper.startDrawingPolygon({
    strokeWidth: 4,
    strokeColor: Cesium.Color.BLUE,
    fillColor: Cesium.Color.YELLOW.withAlpha(0.5),
  });
  message.value = '开始绘制多边形：左键添加点，双击完成，右键删除最后一点';
  
  drawHelper.onDrawEnd(() => {
    isDrawing.value = false;
    currentDrawMode.value = null;
    message.value = '多边形绘制完成';
    setTimeout(() => {
      message.value = '';
    }, 2000);
  });
};
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
  (viewer.value.cesiumWidget.creditContainer as HTMLElement).style.display = "none"; // 去掉左下角的Cesium商标

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

    customToolBarBtn(mapToolbar);
  }
});

const customToolBarBtn = (mapToolbar:CesiumMapToolbar) => {
  // 1. 测试添加报警按钮 - 插入到搜索和测量之间（sort: 0.5）
  mapToolbar.addCustomButton({
    id: 'test-alert',
    icon: '🚨',
    title: '测试添加报警',
    size: 36,
    color: '#FF4444',
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    borderColor: '#FF4444',
    sort: -1, // 插入到搜索(0)和测量(1)之间
    onClick: (buttonId: string, buttonElement: HTMLElement) => {
      console.log('测试添加报警按钮被点击');
      message.value = '测试报警：这是一个测试报警信息';
      setTimeout(() => {
        message.value = '';
      }, 3000);
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
    sort: -3, // 插入到图层切换(3)和定位(4)之间
    onClick: (buttonId: string, buttonElement: HTMLElement) => {
      console.log('数据统计按钮被点击');
      message.value = '数据统计功能：显示统计数据';
      setTimeout(() => {
        message.value = '';
      }, 3000);
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
    sort: -2, // 插入到定位(4)和缩放(5)之间
    onClick: (buttonId: string, buttonElement: HTMLElement) => {
      console.log('可见配置项按钮被点击');
      message.value = '可见配置项：配置图层可见性';
      setTimeout(() => {
        message.value = '';
      }, 3000);
    }
  });
}

// 清理资源
onBeforeUnmount(() => {
  // 清理点位添加模式
  if (markerHandler) {
    markerHandler.destroy();
    markerHandler = null;
  }
  
  // 清理点位实体
  if (viewer.value) {
    markerEntities.forEach(entity => {
      viewer.value!.entities.remove(entity);
    });
    markerEntities = [];
  }
  
  // 结束绘制
  if (drawHelper && isDrawing.value) {
    drawHelper.endDrawing();
  }
  
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

.test-button-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1001;
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
