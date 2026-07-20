import { shallowRef, type Ref } from "vue";
import * as Cesium from "cesium";
import { CesiumMapMark, type MarkDrawResult } from "../../src/index";

function formatResultSummary(result: MarkDrawResult | null): string {
  if (!result) {
    return "无结果";
  }

  const detailParts = [
    `type=${result.type}`,
    `points=${result.positions.length}`,
  ];

  if (typeof result.radius === "number") {
    detailParts.push(`radius=${result.radius.toFixed(2)}m`);
  }
  if (typeof result.length === "number") {
    detailParts.push(`length=${result.length.toFixed(2)}m`);
  }
  if (typeof result.area === "number") {
    detailParts.push(`area=${result.area.toFixed(2)}m2`);
  }
  if (result.kind) {
    detailParts.push(`kind=${result.kind}`);
  }

  return detailParts.join(", ");
}

export function useMarkHelper(
  viewer: Ref<Cesium.Viewer | null>,
  message: Ref<string>,
) {
  const mark = shallowRef<CesiumMapMark | null>(null);

  const showMessage = (text: string, ms = 1800) => {
    message.value = text;
    window.setTimeout(() => {
      if (message.value === text) {
        message.value = "";
      }
    }, ms);
  };

  const logResult = (label: string, result: MarkDrawResult | null) => {
    console.log(`[MarkDemo] ${label}`, result);
    showMessage(`${label}: ${formatResultSummary(result)}`, 2400);
  };

  const ensureMark = () => {
    if (mark.value || !viewer.value) {
      return mark.value;
    }

    mark.value = new CesiumMapMark(viewer.value, {
      showToolbar: true,
      buttons: ["point", "polyline", "polygon", "rectangle", "circle"],
      continuous: false,
      defaultColor: "#00A3FF",
      colors: {
        rectangle: "#FF8A00",
      },
      callbacks: {
        onDrawEnd: (result) => {
          logResult("draw end", result);
        },
        onWorkAreaDrawEnd: (result) => {
          logResult("work area end", result);
        },
        onEditChange: (result) => {
          console.log("[MarkDemo] editing", result);
          showMessage(`editing: ${formatResultSummary(result)}`, 1200);
        },
        onEditEnd: (result) => {
          logResult("edit end", result);
        },
        onColorChange: (color, drawType) => {
          console.log("[MarkDemo] color changed", drawType, color);
        },
      },
    });

    return mark.value;
  };

  const initMark = () => {
    ensureMark();
  };

  const destroyMark = () => {
    mark.value?.clearAll();
    mark.value?.destroy();
    mark.value = null;
  };

  const drawPoint = () => {
    ensureMark()?.drawPoint({ outputCoordSystem: "WGS84" });
    showMessage("开始点标绘");
  };

  const drawPolyline = () => {
    ensureMark()?.drawPolyline({ outputCoordSystem: "WGS84" });
    showMessage("开始线标绘");
  };

  const drawPolygon = () => {
    ensureMark()?.drawPolygon({ outputCoordSystem: "WGS84" });
    showMessage("开始面标绘");
  };

  const drawRectangle = () => {
    ensureMark()?.drawRectangle({ outputCoordSystem: "WGS84" });
    showMessage("开始矩形标绘");
  };

  const drawCircle = () => {
    ensureMark()?.drawCircle({ outputCoordSystem: "WGS84" });
    showMessage("开始圆形标绘");
  };

  const drawRectangleWorkArea = () => {
    ensureMark()?.startWorkAreaDraw("rectangle", "noFly", {
      outputCoordSystem: "WGS84",
    });
    showMessage("开始禁飞区矩形绘制");
  };

  const startEditLastEntity = () => {
    const service = ensureMark();
    if (!service) {
      return;
    }

    const entities = service.getEntities();
    const lastEntity = entities[entities.length - 1];
    if (!lastEntity) {
      showMessage("没有可编辑的标绘对象");
      return;
    }

    service.enableEdit();
    const started = service.startEdit(lastEntity);
    showMessage(started ? "已进入编辑模式，拖动控制点可修改" : "进入编辑模式失败");
  };

  const stopEdit = () => {
    const result = ensureMark()?.stopEdit() ?? null;
    logResult("stop edit", result);
  };

  const disableEdit = () => {
    const result = ensureMark()?.disableEdit() ?? null;
    logResult("disable edit", result);
  };

  const clearAll = () => {
    ensureMark()?.clearAll();
    showMessage("已清空全部标绘");
  };

  const exportData = () => {
    const data = ensureMark()?.exportData() ?? [];
    console.log("[MarkDemo] export data", data);
    showMessage(`已导出 ${data.length} 条标绘数据`, 2200);
  };

  return {
    mark,
    initMark,
    destroyMark,
    drawPoint,
    drawPolyline,
    drawPolygon,
    drawRectangle,
    drawCircle,
    drawRectangleWorkArea,
    startEditLastEntity,
    stopEdit,
    disableEdit,
    clearAll,
    exportData,
  };
}
