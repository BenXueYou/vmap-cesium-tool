import { computed, reactive, ref, type ShallowRef } from "vue";
import type { Entity, Viewer } from "cesium";
import type { CoordSystem, DrawOptions, DrawResult, DrawService } from "../../src/index";
import type {
  DrawFormState,
  DrawInventoryItem,
  DrawStatusState,
  PlaygroundDrawMode,
  PlaygroundShowMessage,
} from "./playgroundTypes";

const DRAW_PALETTE = {
  line: { stroke: "#2563eb", fill: "#2563eb" },
  polygon: { stroke: "#0f766e", fill: "rgba(15, 118, 110, 0.24)" },
  rectangle: { stroke: "#7c3aed", fill: "rgba(124, 58, 237, 0.24)" },
  circle: { stroke: "#ea580c", fill: "rgba(234, 88, 12, 0.22)" },
} as const;

type UsePlaygroundDrawOptions = {
  drawService: ShallowRef<DrawService | null>;
  viewer: ShallowRef<Viewer | null>;
  showMessage: PlaygroundShowMessage;
};

function createInitialDrawStatus(): DrawStatusState {
  return {
    isDrawing: false,
    currentMode: null,
    lastSummary: "未开始",
    lastCoordSystem: "",
    lastResult: null,
  };
}

export function usePlaygroundDraw({
  drawService,
  viewer,
  showMessage,
}: UsePlaygroundDrawOptions) {
  const drawForm = reactive<DrawFormState>({
    mode: "polygon",
    outputCoordSystem: "WGS84",
    clampToGround: true,
    selfIntersectionEnabled: true,
    selfIntersectionAllowTouch: false,
    selfIntersectionAllowContinue: false,
  });

  const drawStatus = reactive<DrawStatusState>(createInitialDrawStatus());
  const drawItems = ref<DrawInventoryItem[]>([]);
  const drawEventLog = ref<string[]>([]);
  const selectedDrawEntityId = ref("");
  const drawTypeByEntityId = new Map<string, PlaygroundDrawMode>();

  const drawReady = computed(() => !!drawService.value && !!viewer.value);
  const drawCount = computed(() => drawItems.value.length);
  const drawResultPreview = computed(() => {
    if (!drawStatus.lastResult) {
      return "暂无 draw result";
    }

    return JSON.stringify({
      type: drawStatus.lastResult.type,
      outputCoordSystem: drawStatus.lastResult.outputCoordSystem,
      distance: drawStatus.lastResult.distance ?? null,
      area: drawStatus.lastResult.area ?? null,
      radius: drawStatus.lastResult.radius ?? null,
      geographicPositions: drawStatus.lastResult.geographicPositions,
    }, null, 2);
  });

  let boundDrawService: DrawService | null = null;

  function getDrawService() {
    return drawService.value;
  }

  function appendDrawEvent(entry: string) {
    drawEventLog.value = [entry, ...drawEventLog.value].slice(0, 8);
  }

  function syncDrawInventory() {
    const service = getDrawService();
    if (!service) {
      drawItems.value = [];
      selectedDrawEntityId.value = "";
      drawStatus.isDrawing = false;
      drawStatus.currentMode = null;
      return;
    }

    drawStatus.isDrawing = service.isDrawingMode();
    drawStatus.currentMode = (service.getCurrentDrawMode() as PlaygroundDrawMode | null) ?? null;
    drawItems.value = service.getFinishedEntities().map((entity) => {
      const id = String(entity.id);
      return {
        id,
        type: drawTypeByEntityId.get(id) ?? "polygon",
      };
    });

    if (selectedDrawEntityId.value && !drawItems.value.some((item) => item.id === selectedDrawEntityId.value)) {
      selectedDrawEntityId.value = drawItems.value[0]?.id || "";
    }
  }

  function formatDrawSummary(result: DrawResult | null): string {
    if (!result) {
      return "未生成实体";
    }

    if (result.type === "line") {
      return `line / ${result.distance?.toFixed(2) ?? "-"}m`;
    }
    if (result.type === "circle") {
      return `circle / r ${result.radius?.toFixed(2) ?? "-"}m`;
    }
    return `${result.type} / area ${result.area?.toFixed(2) ?? "-"}`;
  }

  function bindDrawCallbacks() {
    const service = getDrawService();
    if (!service || service === boundDrawService) {
      return;
    }

    boundDrawService = service;

    service.onDrawStart(() => {
      drawStatus.isDrawing = true;
      drawStatus.currentMode = (service.getCurrentDrawMode() as PlaygroundDrawMode | null) ?? null;
      appendDrawEvent(`onDrawStart: ${drawStatus.currentMode ?? "unknown"}`);
    });

    service.onDrawEnd((result) => {
      drawStatus.isDrawing = false;
      drawStatus.currentMode = (service.getCurrentDrawMode() as PlaygroundDrawMode | null) ?? null;
      drawStatus.lastResult = result;
      drawStatus.lastSummary = formatDrawSummary(result);
      drawStatus.lastCoordSystem = result?.outputCoordSystem ?? "";
      if (result) {
        drawTypeByEntityId.set(String(result.entity.id), result.type as PlaygroundDrawMode);
      }
      appendDrawEvent(`onDrawEnd: ${drawStatus.lastSummary}`);
      syncDrawInventory();
    });

    service.onEntityRemoved((entity: Entity) => {
      drawTypeByEntityId.delete(String(entity.id));
      appendDrawEvent(`onEntityRemoved: ${String(entity.id)}`);
      syncDrawInventory();
    });
  }

  function buildDrawOptions(mode: PlaygroundDrawMode): DrawOptions {
    const colors = DRAW_PALETTE[mode];

    return {
      lineColor: colors.stroke,
      lineWidth: 3,
      fillColor: colors.fill,
      clampToGround: drawForm.clampToGround,
      outputCoordSystem: drawForm.outputCoordSystem,
      selfIntersectionEnabled: drawForm.selfIntersectionEnabled,
      selfIntersectionAllowTouch: drawForm.selfIntersectionAllowTouch,
      selfIntersectionAllowContinue: drawForm.selfIntersectionAllowContinue,
    };
  }

  function refreshDrawState() {
    syncDrawInventory();
    const service = getDrawService();
    if (!service) {
      showMessage("DrawService 未初始化");
      return;
    }

    drawStatus.isDrawing = service.isDrawingMode();
    drawStatus.currentMode = (service.getCurrentDrawMode() as PlaygroundDrawMode | null) ?? null;
    showMessage("Draw 状态已刷新");
  }

  function startDrawGeneric() {
    const service = getDrawService();
    if (!service) {
      showMessage("DrawService 未初始化");
      return;
    }

    const mode = drawForm.mode;
    service.startDrawing(mode, buildDrawOptions(mode));
    showMessage(`startDrawing(${mode}) 已触发`);
  }

  function startDrawShortcut() {
    const service = getDrawService();
    if (!service) {
      showMessage("DrawService 未初始化");
      return;
    }

    const mode = drawForm.mode;
    const options = buildDrawOptions(mode);
    if (mode === "line") {
      service.startDrawingLine(options);
    } else if (mode === "polygon") {
      service.startDrawingPolygon(options);
    } else if (mode === "rectangle") {
      service.startDrawingRectangle(options);
    } else {
      service.startDrawingCircle(options);
    }

    showMessage(`startDrawing${mode[0].toUpperCase()}${mode.slice(1)} 已触发`);
  }

  function cancelDrawSession() {
    const service = getDrawService();
    if (!service) {
      showMessage("DrawService 未初始化");
      return;
    }

    service.cancelDrawing();
    refreshDrawState();
    appendDrawEvent("cancelDrawing");
  }

  function endDrawSession() {
    const service = getDrawService();
    if (!service) {
      showMessage("DrawService 未初始化");
      return;
    }

    service.endDrawing();
    refreshDrawState();
    appendDrawEvent("endDrawing");
  }

  function removeSelectedDrawEntity() {
    const service = getDrawService();
    if (!service) {
      showMessage("DrawService 未初始化");
      return;
    }

    if (!selectedDrawEntityId.value) {
      showMessage("请先选择一个绘制实体");
      return;
    }

    const entity = service.getFinishedEntities().find((item) => String(item.id) === selectedDrawEntityId.value);
    if (!entity) {
      showMessage("目标绘制实体不存在");
      return;
    }

    service.removeEntity(entity);
    showMessage(`绘制实体 ${selectedDrawEntityId.value} 已移除`);
  }

  function removeLastDrawEntity() {
    const service = getDrawService();
    if (!service) {
      showMessage("DrawService 未初始化");
      return;
    }

    const entities = service.getFinishedEntities();
    const entity = entities[entities.length - 1];
    if (!entity) {
      showMessage("暂无可移除的绘制实体");
      return;
    }

    service.removeEntity(entity);
    showMessage(`绘制实体 ${String(entity.id)} 已移除`);
  }

  function clearDrawEntities() {
    const service = getDrawService();
    if (!service) {
      showMessage("DrawService 未初始化");
      return;
    }

    service.clearAll();
    drawTypeByEntityId.clear();
    drawStatus.lastResult = null;
    drawStatus.lastSummary = "已清空";
    drawStatus.lastCoordSystem = "";
    appendDrawEvent("clearAll");
    syncDrawInventory();
    showMessage("所有绘制实体已清空");
  }

  function resetDrawState() {
    drawItems.value = [];
    selectedDrawEntityId.value = "";
    drawEventLog.value = [];
    drawTypeByEntityId.clear();
    boundDrawService = null;
    const initial = createInitialDrawStatus();
    drawStatus.isDrawing = initial.isDrawing;
    drawStatus.currentMode = initial.currentMode;
    drawStatus.lastSummary = initial.lastSummary;
    drawStatus.lastCoordSystem = initial.lastCoordSystem;
    drawStatus.lastResult = initial.lastResult;
  }

  return {
    drawReady,
    drawCount,
    drawForm,
    drawStatus,
    drawItems,
    drawEventLog,
    selectedDrawEntityId,
    drawResultPreview,
    bindDrawCallbacks,
    syncDrawInventory,
    resetDrawState,
    refreshDrawState,
    startDrawGeneric,
    startDrawShortcut,
    cancelDrawSession,
    endDrawSession,
    removeSelectedDrawEntity,
    removeLastDrawEntity,
    clearDrawEntities,
  };
}
