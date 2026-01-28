import { ref, type Ref } from "vue";
import * as Cesium from "cesium";
import DrawHelper from "../libs/CesiumMapDraw";
import type { DrawResult } from "../libs/drawHelper";
import { i18n } from "../i18n";

/**
 * 绘制相关的辅助逻辑
 * - 提供线、矩形、圆形、多边形的绘制示例方法
 */
export function useDrawHelper(
  viewer: Ref<Cesium.Viewer | undefined>,
  message: Ref<string>
) {
  const drawHelper = ref<DrawHelper | null>(null);
  const isDrawing = ref(false);
  const currentDrawMode = ref<string | null>(null);

  const initDrawHelper = () => {
    if (!viewer.value) return;
    drawHelper.value = new DrawHelper(viewer.value);
  };

  const endDrawing = () => {
    if (drawHelper.value && isDrawing.value) {
      drawHelper.value.endDrawing();
    }
    isDrawing.value = false;
    currentDrawMode.value = null;
  };

  const addDrawLine = () => {
    if (!drawHelper.value) return;
    endDrawing();

    currentDrawMode.value = "line";
    isDrawing.value = true;
    drawHelper.value.onMeasureComplete((result: {
      type: "line" | "polygon" | "rectangle" | "circle";
      positions: Cesium.Cartesian3[];
      distance?: number;
      areaKm2?: number;
    }) => {
      if (result.type === "line") {
        console.log("线条绘制完成，点信息:", result.positions);
      }
    });
    drawHelper.value.startDrawingLine({
      strokeWidth: 4,
      strokeColor: Cesium.Color.BLUE,
    });
    message.value = i18n.t("draw.start.line");

    drawHelper.value.onDrawEnd(() => {
      isDrawing.value = false;
      currentDrawMode.value = null;
      message.value = i18n.t("draw.done.line");
      setTimeout(() => {
        message.value = "";
      }, 2000);
    });
  };

  const addDrawArea = () => {
    if (!drawHelper.value) return;
    endDrawing();

    currentDrawMode.value = "rectangle";
    isDrawing.value = true;
    drawHelper.value.onMeasureComplete((result: {
      type: "line" | "polygon" | "rectangle" | "circle";
      positions: Cesium.Cartesian3[];
      distance?: number;
      areaKm2?: number;
    }) => {
      if (result.type === "rectangle") {
        console.log("矩形绘制完成，点信息:", result.positions);
      }
    });
    drawHelper.value.startDrawingRectangle({
      fillColor: Cesium.Color.YELLOW.withAlpha(0.5),
      outlineColor: Cesium.Color.YELLOW,
      outlineWidth: 2,
      showAreaLabel: true,
      onClick: (entity: Cesium.Entity) => {
        console.log("矩形区域点击:", entity);
      },
    });
    message.value = i18n.t("draw.start.rectangle");

    drawHelper.value.onDrawEnd((entity) => {
      isDrawing.value = false;
      currentDrawMode.value = null;
      message.value = i18n.t("draw.done.rectangle");
      if (entity) {
        console.log("关联标签实体:", drawHelper.value?.getEntityLabelEntities(entity));
      }
      setTimeout(() => {
        message.value = "";
      }, 2000);
    });
  };

  // 测试：绘制矩形但不显示面积标签
  const addDrawAreaNoLabel = () => {
    if (!drawHelper.value) return;
    endDrawing();

    currentDrawMode.value = "rectangle";
    isDrawing.value = true;

    drawHelper.value.startDrawingRectangle({
      fillColor: Cesium.Color.YELLOW.withAlpha(0.5),
      outlineColor: Cesium.Color.YELLOW,
      outlineWidth: 2,
      showAreaLabel: false,
    });
    message.value = i18n.t("draw.start.rectangle_no_label");

    drawHelper.value.onDrawEnd((entity) => {
      isDrawing.value = false;
      currentDrawMode.value = null;
      message.value = i18n.t("draw.done.rectangle_no_label");
      if (entity) {
        console.log("关联标签实体:", drawHelper.value?.getEntityLabelEntities(entity));
      }
      setTimeout(() => {
        message.value = "";
      }, 2000);
    });
  };

  const addDrawCircle = () => {
    if (!drawHelper.value) return;
    endDrawing();

    currentDrawMode.value = "circle";
    isDrawing.value = true;
    drawHelper.value.onMeasureComplete((result: {
      type: "line" | "polygon" | "rectangle" | "circle";
      positions: Cesium.Cartesian3[];
      distance?: number;
      areaKm2?: number;
    }) => {
      if (result.type === "circle") {
        console.log("圆形绘制完成，点信息:", result.positions);
      }
    });
    drawHelper.value.startDrawingCircle({
      fillColor: Cesium.Color.GREEN.withAlpha(0.5),
      outlineColor: Cesium.Color.GREEN,
      outlineWidth: 6,
      showAreaLabel: true,
    });
    message.value = i18n.t("draw.start.circle");

    drawHelper.value.onDrawEnd(() => {
      isDrawing.value = false;
      currentDrawMode.value = null;
      message.value = i18n.t("draw.done.circle");
      setTimeout(() => {
        message.value = "";
      }, 2000);
    });
  };

  // 测试：绘制圆形但不显示面积标签
  const addDrawCircleNoLabel = () => {
    if (!drawHelper.value) return;
    endDrawing();

    currentDrawMode.value = "circle";
    isDrawing.value = true;

    drawHelper.value.startDrawingCircle({
      fillColor: Cesium.Color.GREEN.withAlpha(0.5),
      outlineColor: Cesium.Color.GREEN,
      outlineWidth: 6,
      showAreaLabel: false,
    });
    message.value = i18n.t("draw.start.circle_no_label");

    drawHelper.value.onDrawEnd((entity) => {
      isDrawing.value = false;
      currentDrawMode.value = null;
      message.value = i18n.t("draw.done.circle_no_label");
      if (entity) {
        console.log("关联标签实体:", drawHelper.value?.getEntityLabelEntities(entity));
      }
      setTimeout(() => {
        message.value = "";
      }, 2000);
    });
  };

  const addDrawPolygon = () => {
    if (!drawHelper.value) return;
    endDrawing();

    currentDrawMode.value = "polygon";
    isDrawing.value = true;
    drawHelper.value.onMeasureComplete((result: {
      type: "line" | "polygon" | "rectangle" | "circle";
      positions: Cesium.Cartesian3[];
      distance?: number;
      areaKm2?: number;
    }) => {
      if (result.type === "polygon") {
        console.log("多边形绘制完成，点信息:", result.positions);
      }
    });
    drawHelper.value.startDrawingPolygon({
      strokeWidth: 4,
      strokeColor: Cesium.Color.YELLOW,
      fillColor: Cesium.Color.YELLOW.withAlpha(0.5),
      showAreaLabel: true,
    });
    message.value = i18n.t("draw.start.polygon");

    drawHelper.value.onDrawEnd((entity: Cesium.Entity | null) => {
      console.log("多边形绘制完成:", entity);
      isDrawing.value = false;
      currentDrawMode.value = null;
      message.value = i18n.t("draw.done.polygon");
      setTimeout  (() => {
        message.value = "";
        if (entity) {
          console.log("多边形绘制完成:", (entity as any)._borderEntity);
          console.log("关联标签实体:", drawHelper.value?.getEntityLabelEntities(entity));
        } else {
          console.log("多边形绘制完成: entity is null (可能点数不足/被拦截)");
        }
      }, 2000);
    });
  };

  /**
   * 测试 1：落点前拦截
   * - 期望：当即将新增的边与历史非相邻边相交/擦边（由配置决定）时，本次点击不会落点（不会新增红点）。
   */
  const addDrawPolygon_PointIntercept = () => {
    if (!drawHelper.value) return;
    endDrawing();

    currentDrawMode.value = "polygon";
    isDrawing.value = true;

    drawHelper.value.onMeasureComplete((result: {
      type: "line" | "polygon" | "rectangle" | "circle";
      positions: Cesium.Cartesian3[];
      distance?: number;
      areaKm2?: number;
    }) => {
      if (result.type === "polygon") {
        console.log("[PointIntercept] 多边形绘制完成，点信息:", result.positions);
      }
    });

    drawHelper.value.startDrawingPolygon({
      strokeWidth: 4,
      strokeColor: Cesium.Color.ORANGE,
      fillColor: Cesium.Color.ORANGE.withAlpha(0.35),
      showAreaLabel: true,
      selfIntersectionEnabled: true,
      // 严格：不允许擦边、不允许继续（即：检测到就拒绝落点/拒绝完成）
      selfIntersectionAllowTouch: false,
      selfIntersectionAllowContinue: false,
    });

    message.value = i18n.t("draw.start.polygon_point_intercept");

    drawHelper.value.onDrawEnd((entity: Cesium.Entity | null) => {
      isDrawing.value = false;
      currentDrawMode.value = null;
      message.value = entity
        ? i18n.t("draw.done.polygon_point_intercept_ok")
        : i18n.t("draw.done.polygon_point_intercept_end");
      setTimeout(() => {
        message.value = "";
      }, 2000);
    });
  };

  /**
   * 测试 2：完成前兜底
   * - 目标：构造一种“落点阶段不相交，但闭合边（最后点->首点）会与中间边相交”的形状。
   * - 期望：双击完成时被兜底拦截，不会生成最终面（onDrawEnd 会收到 null）。
   */
  const addDrawPolygon_FinishFallback = () => {
    if (!drawHelper.value) return;
    endDrawing();

    currentDrawMode.value = "polygon";
    isDrawing.value = true;

    drawHelper.value.startDrawingPolygon({
      strokeWidth: 4,
      strokeColor: Cesium.Color.CYAN,
      fillColor: Cesium.Color.CYAN.withAlpha(0.35),
      showAreaLabel: true,
      selfIntersectionEnabled: true,
      // 严格：不允许擦边、不允许继续（兜底拦截将阻止完成）
      selfIntersectionAllowTouch: false,
      selfIntersectionAllowContinue: false,
    });

    message.value = i18n.t("draw.start.polygon_finish_fallback");

    drawHelper.value.onDrawEnd((entity: Cesium.Entity | null) => {
      console.log("[FinishFallback] onDrawEnd entity:", entity);
      isDrawing.value = false;
      currentDrawMode.value = null;
      message.value = entity
        ? i18n.t("draw.done.polygon_finish_fallback_ok")
        : i18n.t("draw.done.polygon_finish_fallback_blocked");
      setTimeout(() => {
        message.value = "";
      }, 2500);
    });
  };

  // 测试：绘制多边形但不显示面积标签
  const addDrawPolygonNoLabel = () => {
    if (!drawHelper.value) return;
    endDrawing();

    currentDrawMode.value = "polygon";
    isDrawing.value = true;

    drawHelper.value.startDrawingPolygon({
      strokeWidth: 4,
      strokeColor: Cesium.Color.YELLOW,
      fillColor: Cesium.Color.YELLOW.withAlpha(0.5),
      showAreaLabel: false,
    });
    message.value = i18n.t("draw.start.polygon_no_label");

    drawHelper.value.onDrawEnd((entity: Cesium.Entity | null) => {
      console.log("多边形绘制完成(不显示面积标签):", entity);
      isDrawing.value = false;
      currentDrawMode.value = null;
      message.value = i18n.t("draw.done.polygon_no_label");
      if (entity) {
        console.log("关联标签实体:", drawHelper.value?.getEntityLabelEntities(entity));
      }
      setTimeout(() => {
        message.value = "";
      }, 2000);
    });
  };

  const destroyDrawHelper = () => {
    endDrawing();
    if (drawHelper.value) {
      drawHelper.value.destroy();
      drawHelper.value = null;
    }
  };

  return {
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
    addDrawPolygonNoLabel,
    addDrawPolygon_PointIntercept,
    addDrawPolygon_FinishFallback,
    destroyDrawHelper,
  };
}

