<template>
  <div class="cesium-container">
    <div id="cesiumContainer" ref="cesiumContainer" style="width: 100%; height: 100vh"></div>
    <!-- 消息提示 -->
    <div v-if="message" class="message">{{ message }}</div>
    <div class="test-button-group">
      <div class="action-row">
        <select class="action-select" v-model="selected.locale" @change="onLocaleSelect">
          <option disabled value="">{{ tt('app.lang.choose', '语言 / Language') }}</option>
          <option value="zh-CN">{{ t('app.lang.zh') }}</option>
          <option value="en-US">{{ t('app.lang.en') }}</option>
        </select>
      </div>

      <div class="action-row">
        <select class="action-select" v-model="selected.draw" @change="() => runAction('draw')">
          <option disabled value="">{{ tt('ui.group.draw', '绘制') }}</option>
          <option v-for="opt in actionGroups.draw" :key="opt.id" :value="opt.id">{{ getOptionLabel(opt) }}</option>
        </select>
      </div>

      <div class="action-row">
        <select class="action-select" v-model="selected.overlay" @change="() => runAction('overlay')">
          <option disabled value="">{{ tt('ui.group.overlay', '覆盖物/叠加物') }}</option>
          <option v-for="opt in actionGroups.overlay" :key="opt.id" :value="opt.id">{{ getOptionLabel(opt) }}</option>
        </select>
      </div>

      <div class="action-row">
        <select class="action-select" v-model="selected.overlayEdit" @change="() => runAction('overlayEdit')">
          <option disabled value="">{{ tt('ui.group.overlay_edit', '覆盖物编辑') }}</option>
          <option v-for="opt in actionGroups.overlayEdit" :key="opt.id" :value="opt.id">{{ getOptionLabel(opt) }}
          </option>
        </select>
      </div>

      <div class="action-row">
        <select class="action-select" v-model="selected.heatmap" @change="() => runAction('heatmap')">
          <option disabled value="">{{ tt('ui.group.heatmap', '热力图') }}</option>
          <option v-for="opt in actionGroups.heatmap" :key="opt.id" :value="opt.id">{{ getOptionLabel(opt) }}</option>
        </select>
      </div>

      <div class="action-row">
        <select class="action-select" v-model="selected.cluster" @change="() => runAction('cluster')">
          <option disabled value="">点聚合（Cluster）</option>
          <option v-for="opt in actionGroups.cluster" :key="opt.id" :value="opt.id">{{ getOptionLabel(opt) }}</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, onBeforeUnmount, reactive } from "vue";
import { initCesium, setCameraView } from "./libs/CesiumMapLoader";
import { CesiumMapToolbar } from "./libs/CesiumMapToolbar";
import type { ToolbarConfig } from "./libs/CesiumMapModel";
import { useToolBarConfig } from "./hooks/toolBarConfig";
import { useDrawHelper } from "./hooks/useDrawHelper";
import { useOverlayHelper } from "./hooks/useOverlayHelper";
import { getViteTdToken, getViteCesiumToken } from "./utils/common";
import * as Cesium from "cesium";
import { useHeatmapHelper } from "./hooks/useHeatmapHelper";
import { usePointClusterHelper } from "./hooks/usePointClusterHelper";
import { i18n } from "./i18n";

import eleCImage from "./assets/images/ter_c.png";
import imgCImage from "./assets/images/vec_c.png";

const CLUSTER_LABEL_BG_COLOR = Cesium.Color.BLACK.withAlpha(0.45);
const CLUSTER_LABEL_OUTLINE_COLOR = Cesium.Color.BLACK.withAlpha(0.85);
const CLUSTER_LABEL_BG_PADDING = new Cesium.Cartesian2(6, 4);
const CLUSTER_LABEL_OFFSET_CENTER = new Cesium.Cartesian2(0, 0);
const CLUSTER_LABEL_EYE_OFFSET_FRONT = new Cesium.Cartesian3(0, 0, -10);
const CLUSTER_BILLBOARD_EYE_OFFSET = new Cesium.Cartesian3(0, 0, 0);


let viewer = ref<Cesium.Viewer>();
const message = ref("");
const hideClusterLabelDuringMove = ref(false);
let mapToolbar: CesiumMapToolbar | null = null;
let removeClusterMoveListeners: (() => void) | null = null;
i18n.configure?.({ persist: true, useStoredLocale: true });
const currentLocale = ref(i18n.getLocale());
const t = (key: string, params?: Record<string, any>) => i18n.t(key, params, currentLocale.value);
const switchLocale = (locale: "zh-CN" | "en-US") => i18n.setLocale(locale, { persist: true });
i18n.onLocaleChange((locale) => (currentLocale.value = locale));
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
  addCircle123,
  addPolygon,
  addPolyline,
  addIcon,
  addSvg,
  addLabel,
  addRectangle,
  addInfoWindow,
  closeInfoWindow,
  cancelMarkerMode,
  addRing,
  destroyOverlayService,
  testSetOverlayHighlight,
  testToggleOverlayHighlight,
} = useOverlayHelper(viewer, message);

const enableOverlayEditMode = () => {
  overlayService.value?.setOverlayEditMode(true);
  message.value = t('overlay.edit_mode_on');
};

const disableOverlayEditMode = () => {
  overlayService.value?.setOverlayEditMode(false);
  message.value = t('overlay.edit_mode_off');
};

const stopOverlayEdit = () => {
  overlayService.value?.stopOverlayEdit();
  message.value = t('overlay.edit_stopped');
};

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

// 点聚合（Cluster）示例
const {
  clusterLayer,
  visible: clusterVisible,
  initCluster,
  updateClusterData,
  setClusterVisible,
  destroyCluster,
} = usePointClusterHelper(viewer);

const generateClusterDemoPoints = (count = 600) => {
  const baseLon = 120.1986;
  const baseLat = 30.1862;

  const pts = Array.from({ length: count }).map((_, idx) => {
    // 在一个很小的经纬度范围内抖动，形成明显聚类效果
    const lon = baseLon + (Math.random() - 0.5) * 0.02;
    const lat = baseLat + (Math.random() - 0.5) * 0.02;
    return {
      id: String(idx + 1),
      lon,
      lat,
      value: 1,
      properties: {
        name: `Point-${idx + 1}`,
      },
    };
  });

  return pts;
};

const addPointCluster = () => {
  if (!viewer.value) return;

  initCluster({
    pixelRange: 60,
    minimumClusterSize: 2,
    // count 越大越“热”
    clusterStyleSteps: [
      { minCount: 200, color: Cesium.Color.RED, pixelSize: 30 },
      { minCount: 80, color: Cesium.Color.ORANGE, pixelSize: 26 },
      { minCount: 20, color: Cesium.Color.YELLOW, pixelSize: 22 },
      { minCount: 2, color: Cesium.Color.DODGERBLUE, pixelSize: 18 },
    ],
    onClusterClick: (points) => {
      message.value = `点击聚合点：包含 ${points.length} 个点`;
      setTimeout(() => (message.value = ""), 1500);
      console.log("cluster points", points);
    },
    onPointClick: (point) => {
      message.value = `点击单点：${String(point.properties?.name ?? point.id ?? '')}`;
      setTimeout(() => (message.value = ""), 1200);
      console.log("single point", point);
    },
    renderCluster: ({ cluster, count }) => {
      const anyCluster: any = cluster as any;
      if (anyCluster.point) anyCluster.point.show = false;
      if (anyCluster.label) {
        anyCluster.label.show = false;
        anyCluster.label.showBackground = false;
      }

      // 仅真实聚合显示聚合徽章；避免过渡帧/非聚合帧出现黑色背景块
      if (count <= 1) {
        if (anyCluster.billboard) anyCluster.billboard.show = false;
        return;
      }

      if (anyCluster.billboard) {
        const iconSize = count >= 50 ? 56 : 44;
        const image = count >= 50 ? eleCImage : imgCImage;
        anyCluster.billboard.show = true;
        if (anyCluster.billboard.image !== image) anyCluster.billboard.image = image;
        if (anyCluster.billboard.width !== iconSize) anyCluster.billboard.width = iconSize;
        if (anyCluster.billboard.height !== iconSize) anyCluster.billboard.height = iconSize;
        if (anyCluster.billboard.verticalOrigin !== Cesium.VerticalOrigin.CENTER) {
          anyCluster.billboard.verticalOrigin = Cesium.VerticalOrigin.CENTER;
        }
        if (anyCluster.billboard.eyeOffset !== CLUSTER_BILLBOARD_EYE_OFFSET) {
          anyCluster.billboard.eyeOffset = CLUSTER_BILLBOARD_EYE_OFFSET;
        }
        if (anyCluster.billboard.disableDepthTestDistance !== Number.POSITIVE_INFINITY) {
          anyCluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
        }
      }

      if (anyCluster.label) {
        if (hideClusterLabelDuringMove.value) {
          anyCluster.label.show = false;
          anyCluster.label.showBackground = false;
          return;
        }
        anyCluster.label.show = true;
        const text = String(count);
        if (anyCluster.label.text !== text) anyCluster.label.text = text;
        if (anyCluster.label.font !== "bold 13px sans-serif") anyCluster.label.font = "bold 13px sans-serif";
        if (anyCluster.label.fillColor !== Cesium.Color.WHITE) anyCluster.label.fillColor = Cesium.Color.WHITE;
        if (anyCluster.label.outlineColor !== CLUSTER_LABEL_OUTLINE_COLOR) anyCluster.label.outlineColor = CLUSTER_LABEL_OUTLINE_COLOR;
        if (anyCluster.label.outlineWidth !== 2) anyCluster.label.outlineWidth = 2;
        if (anyCluster.label.style !== Cesium.LabelStyle.FILL_AND_OUTLINE) {
          anyCluster.label.style = Cesium.LabelStyle.FILL_AND_OUTLINE;
        }
        anyCluster.label.showBackground = true;
        if (anyCluster.label.backgroundColor !== CLUSTER_LABEL_BG_COLOR) anyCluster.label.backgroundColor = CLUSTER_LABEL_BG_COLOR;
        if (anyCluster.label.backgroundPadding !== CLUSTER_LABEL_BG_PADDING) anyCluster.label.backgroundPadding = CLUSTER_LABEL_BG_PADDING;
        if (anyCluster.label.verticalOrigin !== Cesium.VerticalOrigin.CENTER) anyCluster.label.verticalOrigin = Cesium.VerticalOrigin.CENTER;
        if (anyCluster.label.horizontalOrigin !== Cesium.HorizontalOrigin.CENTER) anyCluster.label.horizontalOrigin = Cesium.HorizontalOrigin.CENTER;
        if (anyCluster.label.pixelOffset !== CLUSTER_LABEL_OFFSET_CENTER) anyCluster.label.pixelOffset = CLUSTER_LABEL_OFFSET_CENTER;
        if (anyCluster.label.eyeOffset !== CLUSTER_LABEL_EYE_OFFSET_FRONT) anyCluster.label.eyeOffset = CLUSTER_LABEL_EYE_OFFSET_FRONT;
        if (anyCluster.label.disableDepthTestDistance !== Number.POSITIVE_INFINITY) {
          anyCluster.label.disableDepthTestDistance = Number.POSITIVE_INFINITY;
        }
      }
    },
    renderSinglePoint: ({ entity, point }) => {
      if (entity.point) (entity.point as any).show = false;
      if (entity.label) (entity.label as any).show = false;
      entity.billboard = new Cesium.BillboardGraphics({
        show: true,
        image: point.value && point.value > 1 ? eleCImage : imgCImage,
        width: 24,
        height: 24,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });
    },
  });

  const pts = generateClusterDemoPoints(800);
  updateClusterData(pts);
  setClusterVisible(true);

  setCameraView(viewer.value, {
    longitude: 120.1986,
    latitude: 30.1862,
    height: 9000,
    pitch: -90,
  });
};

const togglePointClusterVisible = () => {
  if (!clusterLayer.value) {
    message.value = "请先添加点聚合图层";
    setTimeout(() => (message.value = ""), 1200);
    return;
  }
  const next = !clusterVisible.value;
  setClusterVisible(next);
  message.value = next ? "点聚合：已显示" : "点聚合：已隐藏";
  setTimeout(() => (message.value = ""), 1200);
};

const clearPointCluster = () => {
  if (!clusterLayer.value) {
    message.value = "请先添加点聚合图层";
    setTimeout(() => (message.value = ""), 1200);
    return;
  }
  updateClusterData([]);
  message.value = "点聚合：已清空数据";
  setTimeout(() => (message.value = ""), 1200);
};

const destroyPointCluster = () => {
  destroyCluster();
  message.value = "点聚合：已销毁";
  setTimeout(() => (message.value = ""), 1200);
};

// ===== 下拉动作聚合（按原 <br /> 分组） =====
type ActionOption = { id: string; labelKey?: string; label?: string; run: () => void };
type ActionGroupId = 'draw' | 'overlay' | 'overlayEdit' | 'heatmap' | 'cluster';

const selected = reactive({
  locale: '' as '' | 'zh-CN' | 'en-US',
  draw: '',
  overlay: '',
  overlayEdit: '',
  heatmap: '',
  cluster: '',
});

const onLocaleSelect = () => {
  if (!selected.locale) return;
  switchLocale(selected.locale);
  selected.locale = '';
};

const tt = (key: string, fallback: string) => {
  const v = t(key);
  return !v || v === key ? fallback : v;
};

const getOptionLabel = (opt: ActionOption) => {
  if (opt.labelKey) return t(opt.labelKey);
  return opt.label ?? opt.id;
};

const actionGroups: Record<ActionGroupId, ActionOption[]> = {
  draw: [
    { id: 'addDrawLine', labelKey: 'ui.draw.line', run: addDrawLine },
    { id: 'addDrawArea', labelKey: 'ui.draw.area', run: addDrawArea },
    { id: 'addDrawAreaNoLabel', labelKey: 'ui.draw.area_no_label', run: addDrawAreaNoLabel },
    { id: 'addDrawCircle', labelKey: 'ui.draw.circle', run: addDrawCircle },
    { id: 'addDrawCircleNoLabel', labelKey: 'ui.draw.circle_no_label', run: addDrawCircleNoLabel },
    { id: 'addDrawPolygon', labelKey: 'ui.draw.polygon', run: addDrawPolygon },
    { id: 'addDrawPolygon_PointIntercept', labelKey: 'ui.draw.polygon_point_intercept', run: addDrawPolygon_PointIntercept },
    { id: 'addDrawPolygon_FinishFallback', labelKey: 'ui.draw.polygon_finish_fallback', run: addDrawPolygon_FinishFallback },
    { id: 'addDrawPolygonNoLabel', labelKey: 'ui.draw.polygon_no_label', run: addDrawPolygonNoLabel },
  ],
  overlay: [
    { id: 'addMarker', labelKey: 'ui.add.marker', run: addMarker },
    { id: 'addLine', labelKey: 'ui.add.line', run: addLine },
    { id: 'addArea', labelKey: 'ui.add.area', run: addArea },
    { id: 'addCircle', labelKey: 'ui.add.circle', run: addCircle },
    { id: 'addCircle123', labelKey: 'ui.add.circle123', run: addCircle123 },
    { id: 'addPolygon', labelKey: 'ui.add.polygon', run: addPolygon },
    { id: 'addPolyline', labelKey: 'ui.add.polyline', run: addPolyline },
    { id: 'addIcon', labelKey: 'ui.add.icon', run: () => addIcon() },
    { id: 'addSvg', labelKey: 'ui.add.svg', run: () => addSvg() },
    { id: 'addMarkerWithLabel', labelKey: 'ui.add.marker_with_label', run: addMarkerWithLabel },
    { id: 'addLabel', labelKey: 'ui.add.label', run: () => (addLabel as any)() },
    { id: 'addRectangle', labelKey: 'ui.add.rectangle', run: addRectangle },
    { id: 'testSetOverlayHighlight', labelKey: 'ui.test.set_highlight', run: testSetOverlayHighlight },
    { id: 'testToggleOverlayHighlight', labelKey: 'ui.test.toggle_highlight', run: testToggleOverlayHighlight },
    { id: 'addInfoWindow', labelKey: 'ui.add.info_window', run: addInfoWindow },
    { id: 'closeInfoWindow', labelKey: 'ui.add.info_window_close', run: closeInfoWindow },
    { id: 'addRing', labelKey: 'ui.add.ring', run: () => addRing() },
    { id: 'addRingTest', labelKey: 'ui.add.ring_test', run: () => addRingTest() },
  ],
  overlayEdit: [
    { id: 'enableOverlayEditMode', labelKey: 'ui.overlay_edit.enable', run: enableOverlayEditMode },
    { id: 'disableOverlayEditMode', labelKey: 'ui.overlay_edit.disable', run: disableOverlayEditMode },
    { id: 'stopOverlayEdit', labelKey: 'ui.overlay_edit.stop', run: stopOverlayEdit },
  ],
  heatmap: [
    { id: 'addHeatMap', labelKey: 'ui.add.heatmap', run: () => addHeatMap() },
    { id: 'enableHeatmapAuto', labelKey: 'ui.heatmap.auto_on', run: () => enableHeatmapAuto() },
    { id: 'disableHeatmapAuto', labelKey: 'ui.heatmap.auto_off', run: () => disableHeatmapAuto() },
    { id: 'setHeatmapLodCoarse', labelKey: 'ui.heatmap.lod_coarse', run: () => setHeatmapLodCoarse() },
    { id: 'setHeatmapLodMedium', labelKey: 'ui.heatmap.lod_medium', run: () => setHeatmapLodMedium() },
    { id: 'setHeatmapLodFine', labelKey: 'ui.heatmap.lod_fine', run: () => setHeatmapLodFine() },
  ],
  cluster: [
    { id: 'addPointCluster', label: '添加点聚合（示例数据）', run: addPointCluster },
    { id: 'togglePointClusterVisible', label: '显示/隐藏点聚合', run: togglePointClusterVisible },
    { id: 'clearPointCluster', label: '清空点聚合数据', run: clearPointCluster },
    { id: 'destroyPointCluster', label: '销毁点聚合图层', run: destroyPointCluster },
  ],
};

const runAction = (group: ActionGroupId) => {
  const selectedId = selected[group];
  if (!selectedId) return;
  const opt = actionGroups[group].find(o => o.id === selectedId);
  selected[group] = '';
  if (!opt) return;
  try {
    opt.run();
  } catch (e) {
    console.error(`[${group}] action failed`, e);
    message.value = '动作执行失败，请看控制台日志';
    setTimeout(() => (message.value = ''), 1500);
  }
};

// 模拟热力点位数据：覆盖所有分级区间（<40, 40-60, 60-90, 90-110, >=110）
const defaultHeatmapData = [
  // < 40 (蓝)
  { lon: 120.1979675, lat: 30.1856803, height: 200 },
  // { lon: 120.1976514, lat: 30.1856604, height: 30 },
  { lon: 120.198971, lat: 30.1863338, height: 12 },
  // { lon: 100.6, lat: 30.6, height: 20 },
  // { lon: 101.0, lat: 31.0, height: 39 },

  // // 40 - 60 (青)
  // { lon: 101.4, lat: 31.4, height: 40 },
  // { lon: 101.8, lat: 31.8, height: 50 },
  // { lon: 102.2, lat: 32.2, height: 60 },

  // // 60 - 90 (绿)
  // { lon: 102.6, lat: 32.6, height: 61 },
  // { lon: 103.0, lat: 33.0, height: 75 },
  // { lon: 103.4, lat: 33.4, height: 90 },

  // // 90 - 110 (黄)
  // { lon: 103.8, lat: 33.8, height: 91 },
  // { lon: 104.2, lat: 34.2, height: 100 },
  // { lon: 104.6, lat: 34.6, height: 110 },

  // // >= 110 (红)
  // { lon: 105.0, lat: 35.0, height: 111 },
  // { lon: 105.4, lat: 35.4, height: 400 },
  // { lon: 105.8, lat: 35.8, height: 1000 },
  // { lon: 106.2, lat: 36.2, height: 4000 },
  // { lon: 106.6, lat: 36.6, height: 10000 },
];

// 测试添加大量圆环性能
const addRingTest = () => {
  const test1 = () => {
    const totalRings = 50;
    let arr = [];
    for (let i = 0; i < totalRings; i++) {
      arr.push(addRing(i + Math.random() * 10));
    }
    message.value = t("app.ring_test_added", { count: totalRings });
    setTimeout(() => {
      message.value = '';
      console.log('开始移除圆环');
      arr.forEach(ring => {
        console.log('移除圆环', ring);
        if (ring?.id) {
          overlayService.value?.removeOverlay(ring.id);
        }
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
    message.value = t("app.heatmap_empty");
    return;
  }

  // 固定分级上限为 110，确保 >=110 都映射为红色
  const baseMax = 110;

  // 严格分段：按 value 直接决定每个点的纯色（非热力渐变）
  const thresholds = [40, 60, 90, 110];
  const colors = ["#0033ff", "#00ffff", "#00b800", "#ffff00", "#ff0000"]; // 蓝-青-绿-黄-红

  // 初始化热力图图层
  initHeatmap({
    mode: "heat",
    // mode: "discrete",
    radius: 10,
    opacity: 0.8,
    minValue: 0,
    maxValue: baseMax,
    discreteThresholds: thresholds,
    discreteColors: colors,
    discreteOverlap: "last",
    // discreteOverlap: "max",
  });

  // 目前先一次性加载所有点（如果后续需要逐帧动画，可以基于 frames 实现）
  const heatmapData = allPoints.map((p: any) => ({
    lon: p.lon,
    lat: p.lat,
    value: Math.min(p.value, baseMax),
  }));

  updateHeatmapData(heatmapData);
  // setHeatmapVisible(true);
  // setHeatmapOpacity(0.9);
  // discrete 模式不需要 setHeatmapGradient


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
    message.value = t("app.heatmap_need_add");
    return;
  }
  setHeatmapAutoUpdate({
    enabled: true,
    // 可按需要调整：视域 padding 越大，边缘变化越不明显但计算更重
    viewPaddingRatio: 0.15,
  });
  message.value = t("app.heatmap_auto_on");
  setTimeout(() => (message.value = ""), 2000);
};

const disableHeatmapAuto = () => {
  if (!heatmapLayer.value) return;
  stopHeatmapAutoUpdate();
  message.value = t("app.heatmap_auto_off");
  setTimeout(() => (message.value = ""), 1500);
};

const ensureHeatmapForAuto = (): boolean => {
  if (!heatmapLayer.value) {
    message.value = t("app.heatmap_need_add");
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
  message.value = t("app.heatmap_lod_coarse");
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
  message.value = t("app.heatmap_lod_medium");
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
  message.value = t("app.heatmap_lod_fine");
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
        console.log(t('app.init_success'));
      }
    },
  );
  // 调试用：挂到全局
  (window as any).cesiumViewer = cesiumViewer;
  viewer.value = cesiumViewer;

  const onCameraMoveStart = () => {
    hideClusterLabelDuringMove.value = true;
  };
  const onCameraMoveEnd = () => {
    window.setTimeout(() => {
      hideClusterLabelDuringMove.value = false;
    }, 80);
  };
  viewer.value.camera.moveStart.addEventListener(onCameraMoveStart);
  viewer.value.camera.moveEnd.addEventListener(onCameraMoveEnd);
  removeClusterMoveListeners = () => {
    try {
      viewer.value?.camera.moveStart.removeEventListener(onCameraMoveStart);
    } catch {
      // ignore
    }
    try {
      viewer.value?.camera.moveEnd.removeEventListener(onCameraMoveEnd);
    } catch {
      // ignore
    }
  };

  // 初始化覆盖物服务
  initOverlayService({
    onOverlayEditChange: (entity) => {
      const id = String((entity as any)?.id ?? '');
      console.log('[App] overlay edit change:', id, entity);
      message.value = id ? `编辑完成：${id}` : '编辑完成';
      setTimeout(() => (message.value = ''), 1200);
    },
  });

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
    title: t('app.custom_alert_title'),
    titleKey: 'app.custom_alert_title',
    size: 36,
    color: '#FF4444',
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    borderColor: '#FF4444',
    sort: 0.5, // 插入到搜索(0)和测量(1)之间
    onClick: (buttonId: string, buttonElement: HTMLElement) => {
      console.log('测试添加报警按钮被点击');
      message.value = t('app.custom_alert');
      setTimeout(() => {
        message.value = '';
      }, 3000);
    }
  });

  // 2. 数据统计按钮 - 插入到图层切换和定位之间（sort: 3.5）
  mapToolbar.addCustomButton({
    id: 'data-statistics',
    icon: '📊',
    title: t('app.custom_stats_title'),
    titleKey: 'app.custom_stats_title',
    size: 36,
    color: '#007BFF',
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    borderColor: '#0775D1',
    sort: -3, // 插入到图层切换(3)和定位(4)之间
    onClick: (buttonId: string, buttonElement: HTMLElement) => {
      console.log('数据统计按钮被点击');
      message.value = t('app.custom_stats');
      setTimeout(() => {
        message.value = '';
      }, 3000);
    }
  });

  // 3. 可见配置项按钮 - 插入到定位和缩放之间（sort: 4.5）
  mapToolbar.addCustomButton({
    id: 'visibility-config',
    icon: '⚙️',
    title: t('app.custom_visibility_title'),
    titleKey: 'app.custom_visibility_title',
    size: 36,
    color: '#28A745',
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    borderColor: '#28A745',
    sort: -2, // 插入到定位(4)和缩放(5)之间
    onClick: (buttonId: string, buttonElement: HTMLElement) => {
      console.log('可见配置项按钮被点击');
      message.value = t('app.custom_visibility');
      setTimeout(() => {
        message.value = '';
      }, 3000);
    }
  });
}

// 清理资源
onBeforeUnmount(() => {
  if (removeClusterMoveListeners) {
    removeClusterMoveListeners();
    removeClusterMoveListeners = null;
  }

  // 清理覆盖物服务
  destroyOverlayService();

  // 结束绘制
  destroyDrawHelper();

  if (mapToolbar) {
    mapToolbar.destroy();
  }

  // 销毁热力图与点聚合
  destroyHeatmap();
  destroyCluster();
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
</style>
