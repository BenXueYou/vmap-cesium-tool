<template>
  <div class="app-shell">
    <div id="cesiumContainer" class="map-host"></div>

    <div v-if="message" class="message-bar">{{ message }}</div>

    <div class="locale-panel">
      <div class="locale-title">{{ labels.switch }}</div>

      <label class="locale-row">
        <span class="locale-label">{{ labels.current }}</span>
        <select class="locale-select" :value="locale" @change="onLocaleSelect">
          <option value="zh-CN">{{ labels.zh }}</option>
          <option value="en-US">{{ labels.en }}</option>
        </select>
      </label>

      <label class="locale-row draw-row">
        <span class="locale-label">{{ labels.draw }}</span>
        <select class="locale-select" v-model="selectedDrawAction" @change="onDrawActionSelect">
          <option value="" disabled>{{ labels.drawPlaceholder }}</option>
          <option v-for="item in drawActions" :key="item.id" :value="item.id">
            {{ i18n.t(item.labelKey, undefined, locale) }}
          </option>
        </select>
      </label>

      <label class="locale-row draw-row">
        <span class="locale-label">{{ labels.overlay }}</span>
        <select class="locale-select" v-model="selectedOverlayAction" @change="onOverlayActionSelect">
          <option value="" disabled>{{ labels.overlayPlaceholder }}</option>
          <option v-for="item in overlayActions" :key="item.id" :value="item.id">
            {{ i18n.t(item.labelKey, undefined, locale) }}
          </option>
        </select>
      </label>

      <label class="locale-row draw-row">
        <span class="locale-label">{{ labels.overlayEdit }}</span>
        <select class="locale-select" v-model="selectedOverlayEditAction" @change="onOverlayEditActionSelect">
          <option value="" disabled>{{ labels.overlayEditPlaceholder }}</option>
          <option v-for="item in overlayEditActions" :key="item.id" :value="item.id">
            {{ i18n.t(item.labelKey, undefined, locale) }}
          </option>
        </select>
      </label>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, type Ref } from "vue";
import * as Cesium from "cesium";
import type { MapPlugin } from "../src/index";
import { useMapInit } from "./useMapInit";
import { useDrawHelper } from "./hooks/useDrawHelper";
import { useOverlayServiceHelper } from "./hooks/useOverlayServiceHelper";
import { i18n } from "../src/i18n";

type Locale = "zh-CN" | "en-US";

type DrawActionId =
  | "drawLine"
  | "drawArea"
  | "drawAreaNoLabel"
  | "drawCircle"
  | "drawCircleNoLabel"
  | "drawPolygon"
  | "drawPolygonPointIntercept"
  | "drawPolygonFinishFallback"
  | "drawPolygonNoLabel";

type OverlayActionId =
  | "addMarker"
  | "addLine"
  | "addArea"
  | "addCircle"
  | "addCircle123"
  | "addPolygon"
  | "addPolyline"
  | "addIcon"
  | "addSvg"
  | "addMarkerWithLabel"
  | "addLabel"
  | "addRectangle"
  | "testSetOverlayHighlight"
  | "testToggleOverlayHighlight"
  | "addInfoWindow"
  | "closeInfoWindow"
  | "addRing"
  | "addRingTest";

type OverlayEditActionId = "enableOverlayEditMode" | "disableOverlayEditMode" | "stopOverlayEdit";

const { initMap, destroyMap, viewer, mapPlugin } = useMapInit("cesiumContainer");

const locale = ref<Locale>(i18n.getLocale() as Locale);
const selectedDrawAction = ref<DrawActionId | "">("");
const selectedOverlayAction = ref<OverlayActionId | "">("");
const selectedOverlayEditAction = ref<OverlayEditActionId | "">("");
const message = ref("");
let unsubscribeI18n: (() => void) | null = null;

const {
  initDrawHelper,
  destroyDrawHelper,
  addDrawLine,
  addDrawArea,
  addDrawAreaNoLabel,
  addDrawCircle,
  addDrawCircleNoLabel,
  addDrawPolygon,
  addDrawPolygon_PointIntercept,
  addDrawPolygon_FinishFallback,
  addDrawPolygonNoLabel,
} = useDrawHelper(viewer as unknown as Ref<Cesium.Viewer | undefined>, message);

const {
  initOverlayService,
  destroyOverlayService,
  enableOverlayEditMode,
  disableOverlayEditMode,
  stopOverlayEdit,
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
  addRing,
  testSetOverlayHighlight,
  testToggleOverlayHighlight,
} = useOverlayServiceHelper(
  mapPlugin as unknown as Ref<MapPlugin | null>,
  viewer as unknown as Ref<Cesium.Viewer | null>,
  message
);

const addRingTest = () => {
  const count = 100;
  for (let i = 0; i < count; i += 1) {
    addRing(i);
  }
  message.value = i18n.t("app.ring_test_added", { count }, locale.value);
  setTimeout(() => {
    message.value = "";
  }, 2000);
};

const drawActions = [
  { id: "drawLine", labelKey: "ui.draw.line", run: addDrawLine },
  { id: "drawArea", labelKey: "ui.draw.area", run: addDrawArea },
  { id: "drawAreaNoLabel", labelKey: "ui.draw.area_no_label", run: addDrawAreaNoLabel },
  { id: "drawCircle", labelKey: "ui.draw.circle", run: addDrawCircle },
  { id: "drawCircleNoLabel", labelKey: "ui.draw.circle_no_label", run: addDrawCircleNoLabel },
  { id: "drawPolygon", labelKey: "ui.draw.polygon", run: addDrawPolygon },
  { id: "drawPolygonPointIntercept", labelKey: "ui.draw.polygon_point_intercept", run: addDrawPolygon_PointIntercept },
  { id: "drawPolygonFinishFallback", labelKey: "ui.draw.polygon_finish_fallback", run: addDrawPolygon_FinishFallback },
  { id: "drawPolygonNoLabel", labelKey: "ui.draw.polygon_no_label", run: addDrawPolygonNoLabel },
] as const;

const overlayActions = [
  { id: "addMarker", labelKey: "ui.add.marker", run: addMarker },
  { id: "addLine", labelKey: "ui.add.line", run: addLine },
  { id: "addArea", labelKey: "ui.add.area", run: addArea },
  { id: "addCircle", labelKey: "ui.add.circle", run: addCircle },
  { id: "addCircle123", labelKey: "ui.add.circle123", run: addCircle123 },
  { id: "addPolygon", labelKey: "ui.add.polygon", run: addPolygon },
  { id: "addPolyline", labelKey: "ui.add.polyline", run: addPolyline },
  { id: "addIcon", labelKey: "ui.add.icon", run: addIcon },
  { id: "addSvg", labelKey: "ui.add.svg", run: addSvg },
  { id: "addMarkerWithLabel", labelKey: "ui.add.marker_with_label", run: addMarkerWithLabel },
  {
    id: "addLabel",
    labelKey: "ui.add.label",
    run: () =>
      addLabel({
        position: [116.3974, 39.9093, 200],
        text: "Label",
        font: "16px sans-serif",
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString("#0f172ab0"),
      }),
  },
  { id: "addRectangle", labelKey: "ui.add.rectangle", run: addRectangle },
  { id: "testSetOverlayHighlight", labelKey: "ui.test.set_highlight", run: testSetOverlayHighlight },
  { id: "testToggleOverlayHighlight", labelKey: "ui.test.toggle_highlight", run: testToggleOverlayHighlight },
  { id: "addInfoWindow", labelKey: "ui.add.info_window", run: addInfoWindow },
  { id: "closeInfoWindow", labelKey: "ui.add.info_window_close", run: closeInfoWindow },
  { id: "addRing", labelKey: "ui.add.ring", run: () => addRing() },
  { id: "addRingTest", labelKey: "ui.add.ring_test", run: addRingTest },
] as const;

const overlayEditActions = [
  { id: "enableOverlayEditMode", labelKey: "ui.overlay_edit.enable", run: enableOverlayEditMode },
  { id: "disableOverlayEditMode", labelKey: "ui.overlay_edit.disable", run: disableOverlayEditMode },
  { id: "stopOverlayEdit", labelKey: "ui.overlay_edit.stop", run: stopOverlayEdit },
] as const;

const labels = computed(() => ({
  switch: i18n.t("app.lang.switch", undefined, locale.value),
  current: i18n.t("app.lang.current", undefined, locale.value),
  zh: i18n.t("app.lang.zh", undefined, locale.value),
  en: i18n.t("app.lang.en", undefined, locale.value),
  draw: i18n.t("ui.group.draw", undefined, locale.value),
  drawPlaceholder: i18n.t("ui.group.draw", undefined, locale.value),
  overlay: i18n.t("ui.group.overlay", undefined, locale.value),
  overlayPlaceholder: i18n.t("ui.group.overlay", undefined, locale.value),
  overlayEdit: i18n.t("ui.group.overlay_edit", undefined, locale.value),
  overlayEditPlaceholder: i18n.t("ui.group.overlay_edit", undefined, locale.value),
}));

const onLocaleSelect = (event: Event) => {
  const nextLocale = (event.target as HTMLSelectElement).value as Locale;
  i18n.setLocale(nextLocale, { persist: true });
};

const onDrawActionSelect = () => {
  if (!selectedDrawAction.value) {
    return;
  }
  const action = drawActions.find((item) => item.id === selectedDrawAction.value);
  selectedDrawAction.value = "";
  action?.run();
};

const onOverlayActionSelect = () => {
  if (!selectedOverlayAction.value) {
    return;
  }
  const action = overlayActions.find((item) => item.id === selectedOverlayAction.value);
  selectedOverlayAction.value = "";
  action?.run();
};

const onOverlayEditActionSelect = () => {
  if (!selectedOverlayEditAction.value) {
    return;
  }
  const action = overlayEditActions.find((item) => item.id === selectedOverlayEditAction.value);
  selectedOverlayEditAction.value = "";
  action?.run();
};

onMounted(async () => {
  i18n.configure({
    persist: true,
    useStoredLocale: true,
  });

  locale.value = i18n.getLocale() as Locale;
  unsubscribeI18n = i18n.onLocaleChange((nextLocale) => {
    locale.value = nextLocale as Locale;
  });

  await initMap();
  initDrawHelper();
  initOverlayService();
});

onBeforeUnmount(() => {
  destroyDrawHelper();
  destroyOverlayService();
  unsubscribeI18n?.();
  unsubscribeI18n = null;
  destroyMap();
});
</script>

<style scoped>
.app-shell {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.map-host {
  width: 100%;
  height: 100%;
}

.locale-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 1200;
  min-width: 220px;
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(12, 20, 34, 0.86) 0%, rgba(20, 37, 66, 0.82) 100%);
  box-shadow: 0 12px 32px rgba(2, 8, 23, 0.28);
  backdrop-filter: blur(12px);
}

.locale-title {
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #e2e8f0;
}

.locale-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.draw-row {
  margin-top: 10px;
}

.locale-label {
  flex: 0 0 auto;
  width: 78px;
  font-size: 12px;
  color: rgba(226, 232, 240, 0.82);
}

.locale-select {
  flex: 1 1 auto;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid rgba(96, 165, 250, 0.35);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.72);
  color: #f8fafc;
  font-size: 13px;
  outline: none;
}

.locale-select option {
  color: #111827;
}

.message-bar {
  position: absolute;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  z-index: 1200;
  max-width: 70vw;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(17, 24, 39, 0.82);
  color: #f8fafc;
  font-size: 13px;
  box-shadow: 0 8px 20px rgba(2, 8, 23, 0.25);
}
</style>
