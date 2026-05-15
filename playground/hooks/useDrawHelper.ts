import { ref, shallowRef, markRaw, type Ref } from "vue";
import * as Cesium from "cesium";
import { DrawService, type DrawOptions, type DrawResult } from "../../src/index";
import { i18n } from "../../src/i18n";

/**
 * 绘制相关的辅助逻辑
 * - 提供线、矩形、圆形、多边形的绘制示例方法
 */
export function useDrawHelper(
  viewer: Ref<Cesium.Viewer | undefined>,
  message: Ref<string>
) {
  const drawHelper = shallowRef<DrawService | null>(null);
  const isDrawing = ref(false);
  const currentDrawMode = ref<string | null>(null);

  const runAfterMessage = (ms = 2000) => {
    setTimeout(() => {
      message.value = "";
    }, ms);
  };

  const hideAreaLabelStyle: DrawOptions = {
    previewAreaLabelStyle: {
      textColor: Cesium.Color.TRANSPARENT,
      backgroundColor: Cesium.Color.TRANSPARENT,
    },
    totalAreaLabelStyle: {
      textColor: Cesium.Color.TRANSPARENT,
      backgroundColor: Cesium.Color.TRANSPARENT,
    },
  };

  const hideDistanceLabelStyle: DrawOptions = {
    segmentDistanceLabelStyle: {
      textColor: Cesium.Color.TRANSPARENT,
      backgroundColor: Cesium.Color.TRANSPARENT,
    },
    totalDistanceLabelStyle: {
      textColor: Cesium.Color.TRANSPARENT,
      backgroundColor: Cesium.Color.TRANSPARENT,
    },
  };

  const withDrawEnd = (onDone: (result: DrawResult | null) => void) => {
    if (!drawHelper.value) return;
    drawHelper.value.onDrawEnd((result) => {
      isDrawing.value = false;
      currentDrawMode.value = null;
      onDone(result);
    });
  };

  const initDrawHelper = () => {
    if (!viewer.value) return;
    drawHelper.value = markRaw(new DrawService(viewer.value, {
      i18n,
      useI18n: true,
    }));
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
    withDrawEnd((result) => {
      message.value = i18n.t("draw.done.line");
      if (result) {
        console.log("线条绘制完成，点信息:", result.positions);
      }
      runAfterMessage();
    });

    drawHelper.value.startDrawingLine({
      lineWidth: 4,
      lineColor: Cesium.Color.BLUE,
      ...hideDistanceLabelStyle,
    });
    message.value = i18n.t("draw.start.line");
  };

  const addDrawArea = () => {
    if (!drawHelper.value) return;
    endDrawing();

    currentDrawMode.value = "rectangle";
    isDrawing.value = true;

    withDrawEnd((result) => {
      message.value = i18n.t("draw.done.rectangle");
      if (result) {
        console.log("矩形绘制完成，点信息:", result.positions);
      }
      runAfterMessage();
    });

    drawHelper.value.startDrawingRectangle({
      fillColor: Cesium.Color.YELLOW.withAlpha(0.5),
      lineColor: Cesium.Color.YELLOW,
      lineWidth: 2,
    });
    message.value = i18n.t("draw.start.rectangle");
  };

  // 测试：绘制矩形但不显示面积标签
  const addDrawAreaNoLabel = () => {
    if (!drawHelper.value) return;
    endDrawing();

    currentDrawMode.value = "rectangle";
    isDrawing.value = true;

    withDrawEnd((result) => {
      message.value = i18n.t("draw.done.rectangle_no_label");
      if (result) {
        console.log("矩形绘制完成(无面积标签)，点信息:", result.positions);
      }
      runAfterMessage();
    });

    drawHelper.value.startDrawingRectangle({
      fillColor: Cesium.Color.YELLOW.withAlpha(0.5),
      lineColor: Cesium.Color.YELLOW,
      lineWidth: 2,
      ...hideAreaLabelStyle,
    });
    message.value = i18n.t("draw.start.rectangle_no_label");
  };

  const addDrawCircle = () => {
    if (!drawHelper.value) return;
    endDrawing();

    currentDrawMode.value = "circle";
    isDrawing.value = true;

    withDrawEnd((result) => {
      message.value = i18n.t("draw.done.circle");
      if (result) {
        console.log("圆形绘制完成，点信息:", result.positions);
      }
      runAfterMessage();
    });

    drawHelper.value.startDrawingCircle({
      fillColor: Cesium.Color.GREEN.withAlpha(0.5),
      lineColor: Cesium.Color.GREEN,
      lineWidth: 6,
    });
    message.value = i18n.t("draw.start.circle");
  };

  // 测试：绘制圆形但不显示面积标签
  const addDrawCircleNoLabel = () => {
    if (!drawHelper.value) return;
    endDrawing();

    currentDrawMode.value = "circle";
    isDrawing.value = true;

    withDrawEnd((result) => {
      message.value = i18n.t("draw.done.circle_no_label");
      if (result) {
        console.log("圆形绘制完成(无面积标签)，点信息:", result.positions);
      }
      runAfterMessage();
    });

    drawHelper.value.startDrawingCircle({
      fillColor: Cesium.Color.GREEN.withAlpha(0.5),
      lineColor: Cesium.Color.GREEN,
      lineWidth: 6,
      ...hideAreaLabelStyle,
    });
    message.value = i18n.t("draw.start.circle_no_label");
  };

  const addDrawPolygon = () => {
    if (!drawHelper.value) return;
    endDrawing();

    currentDrawMode.value = "polygon";
    isDrawing.value = true;

    withDrawEnd((result) => {
      message.value = i18n.t("draw.done.polygon");
      if (result) {
        console.log("多边形绘制完成，点信息:", result.positions);
      } else {
        console.log("多边形绘制完成: result is null (可能点数不足)");
      }
      runAfterMessage();
    });

    drawHelper.value.startDrawingPolygon({
      lineWidth: 4,
      lineColor: Cesium.Color.YELLOW,
      fillColor: Cesium.Color.YELLOW.withAlpha(0.5),
    });
    message.value = i18n.t("draw.start.polygon");
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

    withDrawEnd((result) => {
      message.value = result
        ? i18n.t("draw.done.polygon_point_intercept_ok")
        : i18n.t("draw.done.polygon_point_intercept_end");
      if (result) {
        console.log("[PointIntercept] 多边形绘制完成，点信息:", result.positions);
      }
      runAfterMessage();
    });

    drawHelper.value.startDrawingPolygon({
      lineWidth: 4,
      lineColor: Cesium.Color.ORANGE,
      fillColor: Cesium.Color.ORANGE.withAlpha(0.35),
    });

    message.value = `${i18n.t("draw.start.polygon_point_intercept")}（DrawService 暂不支持落点前自相交拦截，按标准多边形绘制）`;
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

    withDrawEnd((result) => {
      message.value = result
        ? i18n.t("draw.done.polygon_finish_fallback_ok")
        : i18n.t("draw.done.polygon_finish_fallback_blocked");
      console.log("[FinishFallback] onDrawEnd result:", result);
      runAfterMessage(2500);
    });

    drawHelper.value.startDrawingPolygon({
      lineWidth: 4,
      lineColor: Cesium.Color.CYAN,
      fillColor: Cesium.Color.CYAN.withAlpha(0.35),
    });

    message.value = `${i18n.t("draw.start.polygon_finish_fallback")}（DrawService 暂不支持完成前自相交兜底，按标准多边形绘制）`;
  };

  // 测试：绘制多边形但不显示面积标签
  const addDrawPolygonNoLabel = () => {
    if (!drawHelper.value) return;
    endDrawing();

    currentDrawMode.value = "polygon";
    isDrawing.value = true;

    withDrawEnd((result) => {
      message.value = i18n.t("draw.done.polygon_no_label");
      if (result) {
        console.log("多边形绘制完成(不显示面积标签)，点信息:", result.positions);
      }
      runAfterMessage();
    });

    drawHelper.value.startDrawingPolygon({
      lineWidth: 4,
      lineColor: Cesium.Color.YELLOW,
      fillColor: Cesium.Color.YELLOW.withAlpha(0.5),
      ...hideAreaLabelStyle,
    });
    message.value = i18n.t("draw.start.polygon_no_label");
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

