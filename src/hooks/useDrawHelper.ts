import { ref, type Ref } from "vue";
import * as Cesium from "cesium";
import DrawHelper from "../libs/CesiumMapDraw";

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
    drawHelper.value.startDrawingLine({
      strokeWidth: 4,
      strokeColor: Cesium.Color.BLUE,
    });
    message.value = "开始绘制线条：左键添加点，双击完成，右键删除最后一点";

    drawHelper.value.onDrawEnd(() => {
      isDrawing.value = false;
      currentDrawMode.value = null;
      message.value = "线条绘制完成";
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
    drawHelper.value.startDrawingRectangle({
      fillColor: Cesium.Color.YELLOW.withAlpha(0.5),
      outlineColor: Cesium.Color.YELLOW,
      outlineWidth: 2,
      onClick: (entity: Cesium.Entity) => {
        console.log("矩形区域点击:", entity);
      },
    });
    message.value = "开始绘制矩形区域：左键确定起点，再次左键确定终点，双击完成";

    drawHelper.value.onDrawEnd(() => {
      isDrawing.value = false;
      currentDrawMode.value = null;
      message.value = "矩形区域绘制完成";
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
    drawHelper.value.startDrawingCircle({
      fillColor: Cesium.Color.GREEN.withAlpha(0.5),
      outlineColor: Cesium.Color.GREEN,
      outlineWidth: 6,
    });
    message.value = "开始绘制圆形：左键确定圆心，再次左键确定半径，双击完成";

    drawHelper.value.onDrawEnd(() => {
      isDrawing.value = false;
      currentDrawMode.value = null;
      message.value = "圆形绘制完成";
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
    drawHelper.value.startDrawingPolygon({
      strokeWidth: 4,
      strokeColor: Cesium.Color.YELLOW,
      fillColor: Cesium.Color.YELLOW.withAlpha(0.5),
    });
    message.value = "开始绘制多边形：左键添加点，双击完成，右键删除最后一点";

    drawHelper.value.onDrawEnd(() => {
      isDrawing.value = false;
      currentDrawMode.value = null;
      message.value = "多边形绘制完成";
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
    addDrawCircle,
    addDrawPolygon,
    destroyDrawHelper,
  };
}

