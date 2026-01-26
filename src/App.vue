<template>
  <div class="cesium-container">
    <div id="cesiumContainer" ref="cesiumContainer" style="width: 100%; height: 100vh"></div>
    <!-- 消息提示 -->
    <div v-if="message" class="message">{{ message }}</div>
    <div class="test-button-group">
      <div>
        <button @click="addDrawLine">绘制线条</button>
        <button @click="addDrawArea">绘制区域</button>
        <button @click="addDrawAreaNoLabel">绘制区域(无面积)</button>
        <button @click="addDrawCircle">绘制圆形</button>
        <button @click="addDrawCircleNoLabel">绘制圆形(无面积)</button>
        <button @click="addDrawPolygon">绘制多边形</button>
        <button @click="addDrawPolygon_PointIntercept">绘制多边形(点截取)</button>
        <button @click="addDrawPolygon_FinishFallback">绘制多边形(完成回退)</button>
        <button @click="addDrawPolygonNoLabel">绘制多边形(无面积)</button>
      </div>
      <br />
      <div>
        <button @click="addMarker">添加点位</button>
        <button @click="addLine">添加线条</button>
        <button @click="addArea">添加区域</button>
        <button @click="addCircle">添加圆形</button>
        <button @click="addPolygon">添加多边形</button>
        <button @click="addPolyline">添加折线</button>
        <button @click="() => addIcon()">添加图标</button>
        <button @click="() => addSvg()">添加SVG</button>
        <button @click="addMarkerWithLabel">添加点位带标签</button>
        <button @click="addLabel">添加标签</button>
        <button @click="addRectangle">添加矩形</button>
        <button @click="testSetOverlayHighlight">测试 setOverlayHighlight</button>
        <button @click="testToggleOverlayHighlight">测试 toggleOverlayHighlight</button>
        <button @click="addInfoWindow">添加窗口</button>
        <button @click="() => addRing()">添加圆环</button>
        <button @click="addRingTest">测试添加圆环性能</button>
      </div>
      <br />
      <div>
        <button @click="addHeatMap">添加热力图</button>
        <button @click="enableHeatmapAuto">开启热力图动态聚合</button>
        <button @click="disableHeatmapAuto">关闭热力图动态聚合</button>
        <button @click="setHeatmapLodCoarse">聚合档位：粗</button>
        <button @click="setHeatmapLodMedium">聚合档位：中</button>
        <button @click="setHeatmapLodFine">聚合档位：细</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, onBeforeUnmount } from "vue";
import { initCesium, setCameraView } from "./libs/CesiumMapLoader";
import { CesiumMapToolbar } from "./libs/CesiumMapToolbar";
import type { ToolbarConfig } from "./libs/CesiumMapModel";
import { useToolBarConfig } from "./hooks/toolBarConfig";
import { useDrawHelper } from "./hooks/useDrawHelper";
import { useOverlayHelper } from "./hooks/useOverlayHelper";
import { getViteTdToken, getViteCesiumToken } from "./utils/common";
import * as Cesium from "cesium";
import { useHeatmapHelper } from "./hooks/useHeatmapHelper";
import { defaultHeatmapData, defaultHeatmapColors, defaultHeatmapOpacity } from "./z.const";
let viewer = ref<Cesium.Viewer>();
const message = ref("");
let mapToolbar: CesiumMapToolbar | null = null;
const TDT_TK = getViteTdToken();
const { toolbarConfig, toolbarCallback } = useToolBarConfig(viewer.value, message);

// 绘制 & 覆盖物 Hooks
const {
  drawHelper,
  isDrawing,
  currentDrawMode,
  initDrawHelper,
  endDrawing,
  addDrawLine,
  addDrawArea,
  addDrawAreaNoLabel,
  addDrawCircle,
  addDrawCircleNoLabel,
  addDrawPolygon,
  addDrawPolygon_PointIntercept,
  addDrawPolygon_FinishFallback,
  addDrawPolygonNoLabel,
  destroyDrawHelper,
} = useDrawHelper(viewer, message);

const {
  overlayService,
  initOverlayService,
  addMarker,
  addMarkerWithLabel,
  addLine,
  addArea,
  addCircle,
  addPolygon,
  addPolyline,
  addIcon,
  addSvg,
  addLabel,
  addRectangle,
  addInfoWindow,
  cancelMarkerMode,
  addRing,
  destroyOverlayService,
  testSetOverlayHighlight,
  testToggleOverlayHighlight,
} = useOverlayHelper(viewer, message);

const {
  heatmapLayer,
  visible,
  initHeatmap,
  updateHeatmapData,
  setHeatmapVisible,
  setHeatmapOpacity,
  setHeatmapGradient,
  setHeatmapAutoUpdate,
  stopHeatmapAutoUpdate,
  destroyHeatmap,
} = useHeatmapHelper(viewer);


// 测试添加大量圆环性能
const addRingTest = () => {
  const test1 = () => {
    const totalRings = 50;
    let arr = [];
    for (let i = 0; i < totalRings; i++) {
      arr.push(addRing(i + Math.random() * 10));
    }
    message.value = `已添加 ${totalRings} 个发光圆环`;
    setTimeout(() => {
      message.value = '';
      console.log('开始移除圆环');
      arr.forEach(ring => {
        console.log('移除圆环', ring);
        overlayService.value?.removeOverlay(ring?.id);
      });
    }, 3000);
  }

  setInterval(() => {
    test1();
  }, 100);
}


const addHeatMap = () => {
  if (!viewer.value) return;

  // 数据格式参考 src/z.const.ts 中的 defaultHeatmapData：
  // 既支持嵌套帧 [[{..},{..}], [...]]，也兼容扁平数组 [{..},{..}]。
  const rawItems: any = defaultHeatmapData as any;

  const normalizePoint = (it: any) => ({
    lon: Number(it.lon ?? it.lng ?? it.longitude),
    lat: Number(it.lat ?? it.latitude),
    // 这里用 height 作为强度值，若为空则回退为 1
    value: Number(it.height) || 1,
    appearTime: Number(it.appearTime) || 0,
  });

  const isNestedFrames = Array.isArray(rawItems) && rawItems.length > 0 && Array.isArray(rawItems[0]);

  const frames: any[][] = isNestedFrames
    ? (rawItems as any[]).map((frame: any[]) =>
      (frame || [])
        .map(normalizePoint)
        .filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat))
    )
    : [
      ((rawItems as any[]) || [])
        .map(normalizePoint)
        .filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat)),
    ];

  const allPoints = frames.flat();
  if (allPoints.length === 0) {
    message.value = "热力图数据为空";
    return;
  }

  // 计算最大强度，用于设置 max 和构建颜色梯度
  const maxValue = Math.max(...allPoints.map((p: any) => p.value));
  const baseMax = Math.max(maxValue, 110); // 至少覆盖到 110 的档位

  // 依据原天地图方案的分级：<40, 40-60, 60-90, 90-110, >=110
  const thresholds = [40, 60, 90, 110];
  const colors = ["#0033ff", "#00ffff", "#00b800", "#ffff00", "#ff0000"]; // 蓝-青-绿-黄-红
  const gradient: Record<number, string> = {};
  gradient[0] = colors[0];
  thresholds.forEach((t, idx) => {
    const stop = Math.min(1, t / baseMax);
    gradient[stop] = colors[idx + 1];
  });
  gradient[1] = colors[colors.length - 1];

  // 初始化热力图图层
  initHeatmap({
    radius: 20,
    opacity: 0.9,
    minValue: 0,
    maxValue: baseMax,
    gradient,
  });

  // 目前先一次性加载所有点（如果后续需要逐帧动画，可以基于 frames 实现）
  const heatmapData = allPoints.map((p: any) => ({
    lon: p.lon,
    lat: p.lat,
    value: p.value,
  }));

  updateHeatmapData(heatmapData);
  setHeatmapVisible(true);
  setHeatmapOpacity(0.9);
  setHeatmapGradient(gradient);


  // 简单用所有点的平均值作为视角中心
  const avgLon =
    allPoints.reduce((sum: number, p: any) => sum + p.lon, 0) / allPoints.length;
  const avgLat =
    allPoints.reduce((sum: number, p: any) => sum + p.lat, 0) / allPoints.length;

  setCameraView(viewer.value, {
    longitude: avgLon,
    latitude: avgLat,
    height: 8000,
    pitch: -90,
  });
};

// 热力图：动态聚合（方格聚合 + moveEnd + WebWorker）测试
const enableHeatmapAuto = () => {
  if (!heatmapLayer.value) {
    message.value = "请先添加热力图";
    return;
  }
  setHeatmapAutoUpdate({
    enabled: true,
    // 可按需要调整：视域 padding 越大，边缘变化越不明显但计算更重
    viewPaddingRatio: 0.15,
  });
  message.value = "已开启热力图动态聚合（拖动/缩放后更新）";
  setTimeout(() => (message.value = ""), 2000);
};

const disableHeatmapAuto = () => {
  if (!heatmapLayer.value) return;
  stopHeatmapAutoUpdate();
  message.value = "已关闭热力图动态聚合";
  setTimeout(() => (message.value = ""), 1500);
};

const ensureHeatmapForAuto = (): boolean => {
  if (!heatmapLayer.value) {
    message.value = "请先添加热力图";
    return false;
  }
  return true;
};

// 三档 LOD：通过 cellSizeMetersByHeight 调整网格边长（米）
const setHeatmapLodCoarse = () => {
  if (!ensureHeatmapForAuto()) return;
  setHeatmapAutoUpdate({
    enabled: true,
    viewPaddingRatio: 0.15,
    cellSizeMetersByHeight: (h: number) => {
      if (h > 2_000_000) return 50_000;
      if (h > 1_000_000) return 30_000;
      if (h > 500_000) return 20_000;
      if (h > 200_000) return 10_000;
      if (h > 100_000) return 6_000;
      if (h > 50_000) return 3_000;
      if (h > 20_000) return 1_800;
      return 1_000;
    },
  });
  message.value = "已切换：聚合档位=粗";
  setTimeout(() => (message.value = ""), 1500);
};

const setHeatmapLodMedium = () => {
  if (!ensureHeatmapForAuto()) return;
  setHeatmapAutoUpdate({
    enabled: true,
    viewPaddingRatio: 0.15,
    cellSizeMetersByHeight: (h: number) => {
      if (h > 2_000_000) return 20_000;
      if (h > 1_000_000) return 12_000;
      if (h > 500_000) return 8_000;
      if (h > 200_000) return 4_000;
      if (h > 100_000) return 2_000;
      if (h > 50_000) return 1_000;
      if (h > 20_000) return 600;
      return 300;
    },
  });
  message.value = "已切换：聚合档位=中";
  setTimeout(() => (message.value = ""), 1500);
};

const setHeatmapLodFine = () => {
  if (!ensureHeatmapForAuto()) return;
  setHeatmapAutoUpdate({
    enabled: true,
    viewPaddingRatio: 0.15,
    cellSizeMetersByHeight: (h: number) => {
      if (h > 2_000_000) return 12_000;
      if (h > 1_000_000) return 8_000;
      if (h > 500_000) return 5_000;
      if (h > 200_000) return 2_000;
      if (h > 100_000) return 1_000;
      if (h > 50_000) return 600;
      if (h > 20_000) return 300;
      return 150;
    },
  });
  message.value = "已切换：聚合档位=细";
  setTimeout(() => (message.value = ""), 1500);
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
        console.log('初始化地图成功');
      }
    },
  );
  // 调试用：挂到全局
  (window as any).cesiumViewer = cesiumViewer;
  viewer.value = cesiumViewer;
  // viewer.value.scene.globe.depthTestAgainstTerrain = true; // 启用地形深度测
  (viewer.value.cesiumWidget.creditContainer as HTMLElement).style.display = "none"; // 去掉左下角的Cesium商标

  // 初始化覆盖物服务
  initOverlayService();

  // 初始化绘图助手
  initDrawHelper();

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

const customToolBarBtn = (mapToolbar: CesiumMapToolbar) => {
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
  // 清理覆盖物服务
  destroyOverlayService();

  // 结束绘制
  destroyDrawHelper();

  if (mapToolbar) {
    mapToolbar.destroy();
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

  div {
    display: flex;
    flex-direction: wrap;
    gap: 6px;
  }
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
