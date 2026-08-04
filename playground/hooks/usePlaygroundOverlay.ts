import { computed, reactive, ref, type ShallowRef } from "vue";
import * as Cesium from "cesium";
import type { MapPlugin, OverlayService } from "../../src/index";
import type {
  OverlayFormState,
  OverlayInventoryItem,
  PlaygroundShowMessage,
} from "./playgroundTypes";

type EditableOverlayService = OverlayService & {
  startOverlayEdit: (entityOrId: string, options?: Record<string, unknown>) => boolean;
  stopOverlayEdit: () => unknown;
};

type UsePlaygroundOverlayOptions = {
  mapPlugin: ShallowRef<MapPlugin | null>;
  viewer: ShallowRef<Cesium.Viewer | null>;
  showMessage: PlaygroundShowMessage;
};

export function usePlaygroundOverlay({
  mapPlugin,
  viewer,
  showMessage,
}: UsePlaygroundOverlayOptions) {
  const overlayForm = reactive<OverlayFormState>({
    hoverEnabled: true,
    clickPickMinIntervalMs: 120,
    pickWidth: 3,
    pickHeight: 3,
    drillLimit: 16,
    highlightReason: "click",
    markerLabel: "API Marker",
    circleRadius: 900,
    rectangleWidth: 0.018,
    rectangleHeight: 0.012,
    infoTitle: "API Debug",
    infoBody: "Overlay service call result",
  });

  const overlayItems = ref<OverlayInventoryItem[]>([]);
  const selectedOverlayId = ref("");

  const overlayReady = computed(() => !!mapPlugin.value && !!viewer.value);
  const overlayCount = computed(() => overlayItems.value.length);

  function resetOverlayState() {
    overlayItems.value = [];
    selectedOverlayId.value = "";
  }

  function getViewerCenter() {
    const currentViewer = viewer.value;
    if (!currentViewer) {
      return null;
    }

    const position = currentViewer.camera.positionCartographic;
    return {
      lon: Cesium.Math.toDegrees(position.longitude),
      lat: Cesium.Math.toDegrees(position.latitude),
    };
  }

  function getOverlayService() {
    return mapPlugin.value?.getOverlayService() ?? null;
  }

  function rememberOverlay(id: string, kind: string) {
    const existing = overlayItems.value.filter((item) => item.id !== id);
    overlayItems.value = [{ id, kind, visible: true }, ...existing];
    selectedOverlayId.value = id;
  }

  function syncOverlayInventory() {
    const service = getOverlayService();
    if (!service) {
      resetOverlayState();
      return;
    }

    const existingMap = new Map(overlayItems.value.map((item) => [item.id, item]));
    overlayItems.value = service.getAllOverlayIds().map((id) => {
      const existing = existingMap.get(id);
      return existing ?? { id, kind: "unknown", visible: true };
    });

    if (selectedOverlayId.value && !overlayItems.value.some((item) => item.id === selectedOverlayId.value)) {
      selectedOverlayId.value = overlayItems.value[0]?.id || "";
    }
  }

  function requireSelectedOverlay() {
    if (!selectedOverlayId.value) {
      showMessage("请先选择一个覆盖物");
      return null;
    }

    return selectedOverlayId.value;
  }

  function addMarkerOverlay() {
    const service = getOverlayService();
    const center = getViewerCenter();
    if (!service || !center) {
      return;
    }

    const marker = service.addMarker({
      position: [center.lon, center.lat],
      pixelSize: 12,
      color: Cesium.Color.ORANGE,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      clickHighlight: true,
      hoverHighlight: true,
      onClick: () => {},
    });

    const label = service.addLabel({
      position: [center.lon, center.lat, 0],
      text: overlayForm.markerLabel,
      font: "15px sans-serif",
      fillColor: Cesium.Color.WHITE,
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString("#0f172ab0"),
      pixelOffset: new Cesium.Cartesian2(0, -24),
    });

    rememberOverlay(marker.getId(), "marker");
    rememberOverlay(label.getId(), "label");
    showMessage("Marker 已创建");
  }

  function addCircleOverlay() {
    const service = getOverlayService();
    const center = getViewerCenter();
    if (!service || !center) {
      return;
    }

    const circle = service.addCircle({
      position: [center.lon + 0.02, center.lat],
      radius: overlayForm.circleRadius,
      material: Cesium.Color.fromCssColorString("#ff6b6b").withAlpha(0.28),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString("#ff6b6b"),
      outlineWidth: 4,
      clickHighlight: true,
      hoverHighlight: true,
    });

    rememberOverlay(circle.getId(), "circle");
  }

  function addRectangleOverlay() {
    const service = getOverlayService();
    const center = getViewerCenter();
    if (!service || !center) {
      return;
    }

    const rectangle = service.addRectangle({
      coordinates: Cesium.Rectangle.fromDegrees(
        center.lon - overlayForm.rectangleWidth,
        center.lat - overlayForm.rectangleHeight,
        center.lon - overlayForm.rectangleWidth * 0.2,
        center.lat - overlayForm.rectangleHeight * 0.2,
      ),
      material: Cesium.Color.fromCssColorString("#2dd4bf").withAlpha(0.22),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString("#2dd4bf"),
      outlineWidth: 3,
      clickHighlight: true,
      hoverHighlight: true,
    });

    rememberOverlay(rectangle.getId(), "rectangle");
  }

  function addPolylineOverlay() {
    const service = getOverlayService();
    const center = getViewerCenter();
    if (!service || !center) {
      return;
    }

    const polyline = service.addPolyline({
      positions: [
        [center.lon - 0.03, center.lat - 0.01],
        [center.lon - 0.015, center.lat + 0.008],
        [center.lon + 0.008, center.lat + 0.002],
      ],
      width: 4,
      color: Cesium.Color.fromCssColorString("#f59e0b"),
      clampToGround: true,
      clickHighlight: true,
      hoverHighlight: true,
    });

    rememberOverlay(polyline.getId(), "polyline");
  }

  function addPolygonOverlay() {
    const service = getOverlayService();
    const center = getViewerCenter();
    if (!service || !center) {
      return;
    }

    const polygon = service.addPolygon({
      positions: [
        [center.lon + 0.012, center.lat - 0.006],
        [center.lon + 0.03, center.lat - 0.012],
        [center.lon + 0.038, center.lat + 0.004],
        [center.lon + 0.02, center.lat + 0.012],
      ],
      material: Cesium.Color.fromCssColorString("#60a5fa").withAlpha(0.26),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString("#60a5fa"),
      outlineWidth: 2,
      clickHighlight: true,
      hoverHighlight: true,
    });

    rememberOverlay(polygon.getId(), "polygon");
  }

  function addInfoWindowOverlay() {
    const service = getOverlayService();
    const center = getViewerCenter();
    if (!service || !center) {
      return;
    }

    const marker = service.addMarker({
      position: [center.lon, center.lat + 0.015],
      pixelSize: 12,
      color: Cesium.Color.CYAN,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
    });

    const infoWindow = service.addInfoWindow({
      position: [center.lon, center.lat + 0.015],
      content: `<div style="padding:10px"><h3 style="margin:0 0 8px 0">${overlayForm.infoTitle}</h3><p style="margin:0">${overlayForm.infoBody}</p></div>`,
      width: 260,
      anchorPixel: 18,
      tailGap: 24,
      showArrow: true,
      arrowSize: 10,
      positionOffset: "top",
      updateInterval: 200,
      hideWhenOutOfView: true,
      show: true,
      closable: true,
    });

    rememberOverlay(marker.getId(), "marker");
    rememberOverlay(infoWindow.getId(), "infowindow");
  }

  function addRingOverlay() {
    const service = getOverlayService();
    const center = getViewerCenter();
    if (!service || !center) {
      return;
    }

    const ring = service.addRing({
      position: [center.lon - 0.02, center.lat + 0.02, 0],
      radius: 150,
      color: Cesium.Color.RED,
      lineColor: Cesium.Color.RED.withAlpha(0.8),
      lineStyle: "dashed",
      lineMaterialMode: "stripe",
      stripeRepeat: 2048,
      glowWidth: 24,
      speed: 1,
    });

    rememberOverlay(ring.getId(), "ring");
  }

  function toggleSelectedOverlayVisibility() {
    const service = getOverlayService();
    const overlayId = requireSelectedOverlay();
    if (!service || !overlayId) {
      return;
    }

    const target = overlayItems.value.find((item) => item.id === overlayId);
    const nextVisible = !(target?.visible ?? true);
    if (!service.setOverlayVisible(overlayId, nextVisible)) {
      showMessage("setOverlayVisible 失败");
      return;
    }

    overlayItems.value = overlayItems.value.map((item) => (
      item.id === overlayId ? { ...item, visible: nextVisible } : item
    ));
  }

  function highlightSelectedOverlay() {
    const service = getOverlayService();
    const overlayId = requireSelectedOverlay();
    if (!service || !overlayId) {
      return;
    }

    if (!service.setOverlayHighlight(overlayId, true, overlayForm.highlightReason)) {
      showMessage("setOverlayHighlight 失败");
    }
  }

  function clearSelectedOverlayHighlight() {
    const service = getOverlayService();
    const overlayId = requireSelectedOverlay();
    if (!service || !overlayId) {
      return;
    }

    if (!service.setOverlayHighlight(overlayId, false, overlayForm.highlightReason)) {
      showMessage("clearHighlight 失败");
    }
  }

  function toggleSelectedOverlayHighlight() {
    const service = getOverlayService();
    const overlayId = requireSelectedOverlay();
    if (!service || !overlayId) {
      return;
    }

    if (!service.toggleOverlayHighlight(overlayId, overlayForm.highlightReason)) {
      showMessage("toggleHighlight 失败");
    }
  }

  function startSelectedOverlayEdit() {
    const service = getOverlayService() as EditableOverlayService | null;
    const overlayId = requireSelectedOverlay();
    if (!service || !overlayId || typeof service.startOverlayEdit !== "function") {
      return;
    }

    const started = service.startOverlayEdit(overlayId, {
      vertex: {
        color: "#38bdf8",
        outlineColor: "#ffffff",
        pixelSize: 11,
      },
    });
    showMessage(started ? "已进入 overlay 编辑模式" : "overlay 编辑模式启动失败");
  }

  function stopOverlayEdit() {
    const service = getOverlayService() as EditableOverlayService | null;
    if (!service || typeof service.stopOverlayEdit !== "function") {
      return;
    }

    service.stopOverlayEdit();
  }

  function removeSelectedOverlay() {
    const service = getOverlayService();
    const overlayId = requireSelectedOverlay();
    if (!service || !overlayId) {
      return;
    }

    if (!service.removeOverlay(overlayId)) {
      showMessage("removeOverlay 失败");
      return;
    }

    overlayItems.value = overlayItems.value.filter((item) => item.id !== overlayId);
    selectedOverlayId.value = overlayItems.value[0]?.id || "";
  }

  function removeAllOverlays() {
    const service = getOverlayService();
    if (!service) {
      return;
    }

    service.removeAllOverlays();
    resetOverlayState();
  }

  function applyOverlayHoverMode() {
    const service = getOverlayService();
    if (!service) {
      return;
    }

    service.setHoverEnabled(overlayForm.hoverEnabled);
    showMessage(`hover handler 已${overlayForm.hoverEnabled ? "开启" : "关闭"}`);
  }

  return {
    overlayReady,
    overlayCount,
    overlayForm,
    overlayItems,
    selectedOverlayId,
    resetOverlayState,
    syncOverlayInventory,
    addMarkerOverlay,
    addCircleOverlay,
    addRectangleOverlay,
    addPolylineOverlay,
    addPolygonOverlay,
    addInfoWindowOverlay,
    addRingOverlay,
    toggleSelectedOverlayVisibility,
    highlightSelectedOverlay,
    clearSelectedOverlayHighlight,
    toggleSelectedOverlayHighlight,
    startSelectedOverlayEdit,
    stopOverlayEdit,
    removeSelectedOverlay,
    removeAllOverlays,
    applyOverlayHoverMode,
  };
}
