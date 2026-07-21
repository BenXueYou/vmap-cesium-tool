import { onBeforeUnmount, reactive, shallowRef, watch, type Ref } from "vue";
import * as Cesium from "cesium";
import type { MapPlugin, OverlaySelectionChangeEvent, OverlayService } from "../../src/index";

interface SelectionValidationSnapshot {
  current: string | null;
  previous: string | null;
  reason: string | null;
  lastClickCallback: string | null;
}

interface SelectionValidationOptions {
  onLog?: (scope: string, action: string, detail?: unknown) => void;
  onMessage?: (message: string, timeout?: number) => void;
}

const VALIDATION_CAMERA = {
  longitude: 121.4768,
  latitude: 31.2276,
  height: 1600,
};

const VALIDATION_IDS = {
  baseMarker: "selection-base-marker",
  basePolygon: "selection-base-polygon",
  baseRectangle: "selection-base-rectangle",
  overlapPolygon: "selection-overlap-polygon",
  overlapRectangle: "selection-overlap-rectangle",
} as const;

function createLabel(text: string, pixelOffsetY = -24): Cesium.LabelGraphics {
  return new Cesium.LabelGraphics({
    text,
    font: "14px sans-serif",
    fillColor: Cesium.Color.WHITE,
    showBackground: true,
    backgroundColor: Cesium.Color.fromCssColorString("#0f172acc"),
    backgroundPadding: new Cesium.Cartesian2(8, 4),
    pixelOffset: new Cesium.Cartesian2(0, pixelOffsetY),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  });
}

function attachOverlayLabel(entity: Cesium.Entity, text: string, position: [number, number], pixelOffsetY = -24): void {
  entity.position = new Cesium.ConstantPositionProperty(
    Cesium.Cartesian3.fromDegrees(position[0], position[1], 0),
  );
  entity.label = createLabel(text, pixelOffsetY);
}

export function useOverlaySelectionValidation(
  mapPlugin: Ref<MapPlugin | null>,
  viewer: Ref<Cesium.Viewer | null>,
  options: SelectionValidationOptions = {},
) {
  const overlayService = shallowRef<OverlayService | null>(null);
  const managedOverlayIds = new Set<string>();
  const snapshot = reactive<SelectionValidationSnapshot>({
    current: null,
    previous: null,
    reason: null,
    lastClickCallback: null,
  });

  let unsubscribeSelection: (() => void) | null = null;

  const resetSnapshot = () => {
    snapshot.current = null;
    snapshot.previous = null;
    snapshot.reason = null;
    snapshot.lastClickCallback = null;
  };

  const pushLog = (action: string, detail?: unknown) => {
    options.onLog?.("overlay-selection", action, detail);
  };

  const showMessage = (message: string, timeout = 1600) => {
    options.onMessage?.(message, timeout);
  };

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

  const focusValidationRegion = () => {
    if (!viewer.value) {
      return;
    }

    viewer.value.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        VALIDATION_CAMERA.longitude,
        VALIDATION_CAMERA.latitude,
        VALIDATION_CAMERA.height,
      ),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-42),
        roll: 0,
      },
    });
  };

  const bindSelectionSubscription = (service: OverlayService | null) => {
    unsubscribeSelection?.();
    unsubscribeSelection = null;

    if (!service) {
      return;
    }

    unsubscribeSelection = service.onSelectionChange((event: OverlaySelectionChangeEvent) => {
      snapshot.current = event.currentId;
      snapshot.previous = event.previousId;
      snapshot.reason = event.reason;
      pushLog("selectionChange", {
        currentId: event.currentId,
        previousId: event.previousId,
        reason: event.reason,
      });
    });
  };

  const markManaged = (...ids: string[]) => {
    ids.forEach((id) => managedOverlayIds.add(id));
  };

  const handleOverlayClick = (overlayId: string) => {
    snapshot.lastClickCallback = overlayId;
    pushLog("overlayClick", { id: overlayId });
  };

  const clearObjects = () => {
    const service = ensureService();
    if (service) {
      Array.from(managedOverlayIds).forEach((id) => {
        service.removeOverlay(id);
      });
    }

    managedOverlayIds.clear();
    resetSnapshot();
    pushLog("clearObjects");
  };

  const addBaseObjects = () => {
    const service = ensureService();
    if (!service) {
      return;
    }

    clearObjects();

    const marker = service.addMarker({
      id: VALIDATION_IDS.baseMarker,
      position: [121.4688, 31.2326],
      pixelSize: 12,
      color: Cesium.Color.ORANGE,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      hoverHighlight: true,
      onClick: () => handleOverlayClick(VALIDATION_IDS.baseMarker),
    });
    marker.getEntity().label = createLabel("Base Marker");

    const polygon = service.addPolygon({
      id: VALIDATION_IDS.basePolygon,
      positions: [
        [121.4784, 31.2348],
        [121.4838, 31.2334],
        [121.4854, 31.2288],
        [121.4802, 31.2274],
      ],
      material: Cesium.Color.fromCssColorString("#60a5fa").withAlpha(0.24),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString("#2563eb"),
      outlineWidth: 2,
      hoverHighlight: true,
      onClick: () => handleOverlayClick(VALIDATION_IDS.basePolygon),
    });
    attachOverlayLabel(polygon.getEntity(), "Base Polygon", [121.4819, 31.2311], -12);

    const rectangle = service.addRectangle({
      id: VALIDATION_IDS.baseRectangle,
      coordinates: Cesium.Rectangle.fromDegrees(121.4608, 31.2224, 121.4664, 31.2264),
      material: Cesium.Color.fromCssColorString("#34d399").withAlpha(0.24),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString("#059669"),
      outlineWidth: 2,
      hoverHighlight: true,
      onClick: () => handleOverlayClick(VALIDATION_IDS.baseRectangle),
    });
    attachOverlayLabel(rectangle.getEntity(), "Base Rectangle", [121.4636, 31.2244], -12);

    markManaged(
      VALIDATION_IDS.baseMarker,
      VALIDATION_IDS.basePolygon,
      VALIDATION_IDS.baseRectangle,
    );
    focusValidationRegion();
    pushLog("addBaseObjects", { ids: Array.from(managedOverlayIds) });
    showMessage("基础验证对象已更新");
  };

  const addOverlapObjects = () => {
    const service = ensureService();
    if (!service) {
      return;
    }

    clearObjects();

    const polygon = service.addPolygon({
      id: VALIDATION_IDS.overlapPolygon,
      positions: [
        [121.4722, 31.2324],
        [121.4808, 31.2324],
        [121.4796, 31.2266],
        [121.4712, 31.2266],
      ],
      material: Cesium.Color.fromCssColorString("#f97316").withAlpha(0.22),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString("#ea580c"),
      outlineWidth: 2,
      pickPriority: 1,
      hoverHighlight: true,
      onClick: () => handleOverlayClick(VALIDATION_IDS.overlapPolygon),
    });
    attachOverlayLabel(polygon.getEntity(), "Overlap Polygon", [121.4762, 31.2294], -10);

    const rectangle = service.addRectangle({
      id: VALIDATION_IDS.overlapRectangle,
      coordinates: Cesium.Rectangle.fromDegrees(121.4742, 31.2272, 121.4826, 31.2334),
      material: Cesium.Color.fromCssColorString("#22c55e").withAlpha(0.2),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString("#16a34a"),
      outlineWidth: 2,
      pickPriority: 10,
      hoverHighlight: true,
      onClick: () => handleOverlayClick(VALIDATION_IDS.overlapRectangle),
    });
    attachOverlayLabel(rectangle.getEntity(), "Overlap Rectangle", [121.4784, 31.2303], -10);

    markManaged(VALIDATION_IDS.overlapPolygon, VALIDATION_IDS.overlapRectangle);
    focusValidationRegion();
    pushLog("addOverlapObjects", { ids: Array.from(managedOverlayIds) });
    showMessage("重叠验证对象已更新");
  };

  const clearSelected = () => {
    const service = ensureService();
    if (!service) {
      return;
    }

    if (service.clearSelection()) {
      pushLog("clearSelection");
      showMessage("已清空选中");
    }
  };

  const selectBaseMarker = () => {
    const service = ensureService();
    if (!service) {
      return;
    }

    if (!managedOverlayIds.has(VALIDATION_IDS.baseMarker)) {
      showMessage("请先添加基础验证对象");
      return;
    }

    const selected = service.selectOverlay(VALIDATION_IDS.baseMarker);
    pushLog("selectBaseMarker", { selected });
    if (selected) {
      focusValidationRegion();
      showMessage("已程序化选中基础 Marker");
    }
  };

  watch(
    mapPlugin,
    (nextMapPlugin) => {
      overlayService.value = nextMapPlugin?.getOverlayService() ?? null;
      managedOverlayIds.clear();
      resetSnapshot();
      bindSelectionSubscription(overlayService.value);
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    unsubscribeSelection?.();
    unsubscribeSelection = null;
    managedOverlayIds.clear();
  });

  return {
    snapshot,
    addBaseObjects,
    addOverlapObjects,
    clearObjects,
    clearSelected,
    selectBaseMarker,
  };
}
