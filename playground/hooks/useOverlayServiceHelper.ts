import { ref, shallowRef, type Ref } from "vue";
import * as Cesium from "cesium";
import type { MapPlugin, OverlayService } from "../../src/index";
import { i18n } from "../../src/i18n";

type OverlayServiceWithEdit = OverlayService & {
  setOverlayEditMode?: (enabled: boolean) => void;
  stopOverlayEdit?: () => void;
};

function getCenter(viewer: Cesium.Viewer): { lon: number; lat: number } {
  const center = viewer.camera.positionCartographic;
  return {
    lon: Cesium.Math.toDegrees(center.longitude),
    lat: Cesium.Math.toDegrees(center.latitude),
  };
}

export function useOverlayServiceHelper(
  mapPlugin: Ref<MapPlugin | null>,
  viewer: Ref<Cesium.Viewer | null>,
  message: Ref<string>
) {
  const overlayService = shallowRef<OverlayService | null>(null);
  const infoWindowIds = ref<string[]>([]);
  const lastRectangleId = ref<string>("");
  const lastCircleId = ref<string>("");

  const ensureService = (): OverlayService | null => {
    if (overlayService.value) {
      return overlayService.value;
    }

    if (!mapPlugin.value) {
      return null;
    }

    overlayService.value = mapPlugin.value.getOverlayService();
    return overlayService.value;
  };

  const initOverlayService = () => {
    ensureService();
  };

  const showMessage = (text: string, ms = 1200) => {
    message.value = text;
    setTimeout(() => {
      message.value = "";
    }, ms);
  };

  const enableOverlayEditMode = () => {
    const service = ensureService() as OverlayServiceWithEdit | null;
    if (!service) return;
    service.setOverlayEditMode?.(true);
    showMessage(i18n.t("overlay.edit_mode_on"), 1800);
  };

  const disableOverlayEditMode = () => {
    const service = ensureService() as OverlayServiceWithEdit | null;
    if (!service) return;
    service.setOverlayEditMode?.(false);
    showMessage(i18n.t("overlay.edit_mode_off"), 1500);
  };

  const stopOverlayEdit = () => {
    const service = ensureService() as OverlayServiceWithEdit | null;
    if (!service) return;
    service.stopOverlayEdit?.();
    showMessage(i18n.t("overlay.edit_stopped"), 1500);
  };

  const destroyOverlayService = () => {
    const service = ensureService();
    service?.removeAllOverlays();
    infoWindowIds.value = [];
    lastRectangleId.value = "";
    lastCircleId.value = "";
  };

  const addMarker = () => {
    if (!viewer.value) return;
    const service = ensureService();
    if (!service) return;

    const { lon, lat } = getCenter(viewer.value);
    service.addMarker({
      position: [lon, lat],
      pixelSize: 12,
      color: Cesium.Color.RED,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      clickHighlight: true,
      onClick: () => {
        message.value = i18n.t("overlay.marker_position", { lon: lon.toFixed(6), lat: lat.toFixed(6) });
        setTimeout(() => (message.value = ""), 1500);
      },
    });

    message.value = i18n.t("overlay.sample_marker_added");
    setTimeout(() => (message.value = ""), 1200);
  };

  const addMarkerWithLabel = () => {
    if (!viewer.value) return;
    const service = ensureService();
    if (!service) return;

    const { lon, lat } = getCenter(viewer.value);
    service.addMarker({
      position: [lon + 0.01, lat + 0.01],
      pixelSize: 12,
      color: Cesium.Color.BLUE,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      hoverHighlight: true,
    });

    service.addLabel({
      position: [lon + 0.01, lat + 0.01],
      text: i18n.t("overlay.sample_marker_label"),
      font: "16px sans-serif",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      pixelOffset: new Cesium.Cartesian2(0, -28),
      showBackground: true,
      backgroundColor: Cesium.Color.BLUE.withAlpha(0.7),
      backgroundPadding: new Cesium.Cartesian2(8, 4),
    });

    message.value = i18n.t("overlay.sample_marker_added");
    setTimeout(() => (message.value = ""), 1200);
  };

  const addLine = () => {
    if (!viewer.value) return;
    const service = ensureService();
    if (!service) return;

    const { lon, lat } = getCenter(viewer.value);
    service.addPolyline({
      positions: [
        [lon - 0.02, lat - 0.005],
        [lon - 0.01, lat + 0.01],
        [lon + 0.01, lat],
      ],
      width: 4,
      color: Cesium.Color.RED,
      clampToGround: true,
      clickHighlight: true,
    });

    message.value = i18n.t("overlay.line_added");
    setTimeout(() => (message.value = ""), 1200);
  };

  const addArea = () => {
    if (!viewer.value) return;
    const service = ensureService();
    if (!service) return;

    const { lon, lat } = getCenter(viewer.value);
    service.addPolygon({
      positions: [
        [lon - 0.01, lat - 0.01],
        [lon + 0.01, lat - 0.01],
        [lon + 0.015, lat + 0.005],
        [lon - 0.005, lat + 0.01],
      ],
      material: Cesium.Color.BLUE.withAlpha(0.35),
      outline: true,
      outlineColor: Cesium.Color.BLUE,
      outlineWidth: 2,
      clickHighlight: true,
      hoverHighlight: true,
    });

    message.value = i18n.t("overlay.area_added");
    setTimeout(() => (message.value = ""), 1200);
  };

  const addCircle = () => {
    if (!viewer.value) return;
    const service = ensureService();
    if (!service) return;

    const { lon, lat } = getCenter(viewer.value);
    const circle = service.addCircle({
      position: [lon, lat],
      radius: 900,
      material: Cesium.Color.RED.withAlpha(0.3),
      outline: true,
      outlineColor: Cesium.Color.RED,
      outlineWidth: 10,
      clickHighlight: true,
      hoverHighlight: true,
    });

    lastCircleId.value = circle.getId();
    message.value = i18n.t("overlay.circle_added");
    setTimeout(() => (message.value = ""), 1200);
  };

  const addCircle123 = () => {
    if (!viewer.value) return;
    const service = ensureService();
    if (!service) return;

    const baseLon = 120.19656308;
    const baseLat = 30.18640485;

    service.addCircle({
      position: [baseLon, baseLat],
      radius: 100.73,
      outlineWidth: 1,
      material: Cesium.Color.fromCssColorString("#18d17e").withAlpha(0.6),
      outlineColor: Cesium.Color.fromCssColorString("#18d17e"),
      outline: true,
    });

    service.addCircle({
      position: [baseLon, baseLat],
      radius: 52.73,
      outlineWidth: 1,
      material: Cesium.Color.fromCssColorString("#ff9900").withAlpha(0.6),
      outlineColor: Cesium.Color.fromCssColorString("#ff9900"),
      outline: true,
    });

    service.addCircle({
      position: [baseLon, baseLat],
      radius: 30.73,
      outlineWidth: 1,
      material: Cesium.Color.fromCssColorString("#d32f2f").withAlpha(0.6),
      outlineColor: Cesium.Color.fromCssColorString("#d32f2f"),
      outline: true,
    });

    message.value = i18n.t("overlay.circle_added");
    setTimeout(() => (message.value = ""), 1200);
  };

  const addPolygon = () => {
    if (!viewer.value) return;
    const service = ensureService();
    if (!service) return;

    const { lon, lat } = getCenter(viewer.value);
    service.addPolygon({
      positions: [
        [lon + 0.03, lat - 0.01],
        [lon + 0.05, lat - 0.01],
        [lon + 0.048, lat + 0.01],
        [lon + 0.034, lat + 0.012],
      ],
      material: Cesium.Color.CYAN.withAlpha(0.28),
      outline: true,
      outlineColor: Cesium.Color.CYAN,
      outlineWidth: 2,
      clickHighlight: true,
      hoverHighlight: true,
    });

    message.value = i18n.t("ui.add.polygon");
    setTimeout(() => (message.value = ""), 1200);
  };

  const addPolyline = () => {
    if (!viewer.value) return;
    const service = ensureService();
    if (!service) return;

    const { lon, lat } = getCenter(viewer.value);
    service.addPolyline({
      positions: [
        [lon - 0.03, lat + 0.01],
        [lon - 0.02, lat + 0.02],
        [lon - 0.005, lat + 0.015],
      ],
      width: 3,
      color: Cesium.Color.YELLOW,
      clampToGround: true,
      hoverHighlight: true,
    });

    message.value = i18n.t("overlay.polyline_added");
    setTimeout(() => (message.value = ""), 1200);
  };

  const addIcon = () => {
    if (!viewer.value) return;
    const service = ensureService();
    if (!service) return;

    const { lon, lat } = getCenter(viewer.value);
    service.addIcon({
      position: [lon - 0.02, lat + 0.02, 200],
      image:
        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNCIgZmlsbD0iI0ZGMDAwMCIvPjwvc3ZnPg==",
      width: 32,
      height: 32,
      hoverHighlight: true,
    });

    message.value = i18n.t("overlay.icon_added");
    setTimeout(() => (message.value = ""), 1200);
  };

  const addSvg = () => {
    if (!viewer.value) return;
    const service = ensureService();
    if (!service) return;

    const { lon, lat } = getCenter(viewer.value);
    service.addSvg({
      position: [lon - 0.01, lat + 0.02, 200],
      svg: `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="18" fill="#28A745" stroke="#fff" stroke-width="2"/><text x="20" y="26" font-size="20" fill="white" text-anchor="middle">✓</text></svg>`,
      width: 40,
      height: 40,
      hoverHighlight: true,
    });

    message.value = i18n.t("overlay.svg_added");
    setTimeout(() => (message.value = ""), 1200);
  };

  const addLabel = (options: any) => {
    const service = ensureService();
    if (!service) return;
    service.addLabel(options);
    message.value = i18n.t("ui.add.label");
    setTimeout(() => (message.value = ""), 1200);
  };

  const addRectangle = () => {
    if (!viewer.value) return;
    const service = ensureService();
    if (!service) return;

    const { lon, lat } = getCenter(viewer.value);
    const rectangle = service.addRectangle({
      coordinates: Cesium.Rectangle.fromDegrees(lon - 0.03, lat - 0.015, lon - 0.022, lat - 0.008),
      material: Cesium.Color.RED.withAlpha(0.35),
      outline: true,
      outlineColor: Cesium.Color.RED,
      outlineWidth: 12,
      clickHighlight: true,
      hoverHighlight: true,
    });

    lastRectangleId.value = rectangle.getId();
    message.value = i18n.t("overlay.rectangle_added");
    setTimeout(() => (message.value = ""), 1200);
  };

  const addInfoWindow = () => {
    if (!viewer.value) return;
    const service = ensureService();
    if (!service) return;

    const { lon, lat } = getCenter(viewer.value);

    service.addMarker({
      position: [lon, lat],
      pixelSize: 14,
      color: Cesium.Color.ORANGE,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
    });

    const infoWindow = service.addInfoWindow({
      position: [lon, lat],
      content: `<div style="padding:10px"><h3 style="margin:0 0 8px 0">${i18n.t("overlay.info_window_title")}</h3><p style="margin:0">${i18n.t("overlay.info_window_desc")}</p></div>`,
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

    infoWindowIds.value.push(infoWindow.getId());
    message.value = i18n.t("overlay.info_window_added");
    setTimeout(() => (message.value = ""), 1500);
  };

  const closeInfoWindow = () => {
    const service = ensureService();
    if (!service) return;

    infoWindowIds.value.forEach((id) => {
      service.removeOverlay(id);
    });
    infoWindowIds.value = [];
    message.value = i18n.t("ui.add.info_window_close");
    setTimeout(() => (message.value = ""), 1200);
  };

  const addRing = (i?: number) => {
    if (!viewer.value) return;
    const service = ensureService();
    if (!service) return;

    const { lon, lat } = getCenter(viewer.value);
    const step = Number.isFinite(i as number) ? Number(i) * 0.0001 : 0;

    service.addRing({
      position: [lon + step, lat + step, 0],
      radius: 150,
      color: Cesium.Color.RED,
      lineColor: Cesium.Color.RED.withAlpha(0.8),
      lineStyle: "dashed",
      lineMaterialMode: "stripe",
      stripeRepeat: 2048,
      glowWidth: 24,
      speed: 1,
    });

    message.value = i18n.t("overlay.ring_added");
    setTimeout(() => (message.value = ""), 1200);
  };

  const testSetOverlayHighlight = () => {
    const service = ensureService();
    if (!service || !lastRectangleId.value) {
      message.value = i18n.t("overlay.highlight_need_rect_b");
      setTimeout(() => (message.value = ""), 1200);
      return;
    }

    service.setOverlayHighlight(lastRectangleId.value, true, "hover");
    setTimeout(() => {
      service.setOverlayHighlight(lastRectangleId.value, false, "hover");
    }, 1800);
  };

  const testToggleOverlayHighlight = () => {
    const service = ensureService();
    if (!service || !lastCircleId.value) {
      message.value = i18n.t("overlay.highlight_need_rect_e");
      setTimeout(() => (message.value = ""), 1200);
      return;
    }

    service.toggleOverlayHighlight(lastCircleId.value, "click");
    setTimeout(() => {
      service.toggleOverlayHighlight(lastCircleId.value, "click");
    }, 1800);
  };

  return {
    overlayService,
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
  };
}
