import * as Cesium from "cesium";
type DrawMode = "line" | "polygon" | "rectangle" | "circle" | null;

type DrawHintState = {
  isDrawing: boolean;
  drawMode: DrawMode;
  tempPositions: Cesium.Cartesian3[];
  offsetHeight: number;
};

export class DrawHintHelper {
  private entities: Cesium.EntityCollection;
  private getState: () => DrawHintState;
  private translate: (key: string, params?: Record<string, any>) => string;

  private drawHintEntity: Cesium.Entity | null = null;
  private drawHintText: string = "";
  private drawHintLastPosition: Cesium.Cartesian3 | null = null;

  private drawHintOverrideText: string | null = null;
  private drawHintOverrideUntil = 0;

  constructor(
    entities: Cesium.EntityCollection,
    getState: () => DrawHintState,
    translate: (key: string, params?: Record<string, any>) => string
  ) {
    this.entities = entities;
    this.getState = getState;
    this.translate = translate;
  }

  public handleSceneModeChanged(): void {
    const state = this.getState();
    if (state.isDrawing && this.drawHintLastPosition) {
      this.updatePosition(this.drawHintLastPosition);
    }
  }

  public setOverride(text: string, ms: number = 1200): void {
    this.drawHintOverrideText = text;
    this.drawHintOverrideUntil = Date.now() + Math.max(0, ms);
    this.refreshTextOnly();
  }

  public updatePosition(position: Cesium.Cartesian3): void {
    const state = this.getState();
    if (!state.isDrawing) return;

    const nextText = this.getDrawHintText();
    if (!nextText) {
      this.clear();
      return;
    }

    this.drawHintText = nextText;
    this.drawHintLastPosition = position.clone();

    const displayPos = this.toHintDisplayPosition(position, state.offsetHeight);

    if (!this.drawHintEntity) {
      this.drawHintEntity = this.entities.add({
        position: new Cesium.ConstantPositionProperty(displayPos),
        label: {
          text: this.drawHintText,
          font: "14px 'Microsoft YaHei', 'PingFang SC', sans-serif",
          showBackground: true,
          backgroundColor: Cesium.Color.BLACK.withAlpha(0.75),
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(12, -18),
          horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: Cesium.HeightReference.NONE,
          scaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.0, 1.5e7, 0.6),
        },
      });
    } else {
      this.drawHintEntity.position = new Cesium.ConstantPositionProperty(displayPos);
      if (this.drawHintEntity.label) {
        this.drawHintEntity.label.text = new Cesium.ConstantProperty(this.drawHintText);
      }
    }
  }

  public refreshTextOnly(): void {
    const nextText = this.getDrawHintText();
    this.drawHintText = nextText;
    if (!nextText) {
      this.clear();
      return;
    }
    if (this.drawHintEntity?.label) {
      this.drawHintEntity.label.text = new Cesium.ConstantProperty(nextText);
    }
  }

  public clear(): void {
    if (this.drawHintEntity) {
      try {
        this.entities.remove(this.drawHintEntity);
      } catch {
        // ignore
      }
      this.drawHintEntity = null;
    }
    this.drawHintText = "";
    this.drawHintLastPosition = null;
  }

/**
 * 获取绘图提示文本的私有方法
 * 根据当前的绘图状态和模式返回相应的提示信息
 * @returns {string} 返回对应的提示文本，如果不在绘图状态则返回空字符串
 */
  private getDrawHintText(): string {
  // 获取当前状态
    const state = this.getState();
  // 如果不在绘图状态或未开启绘图模式，则返回空字符串
    if (!state.isDrawing || !state.drawMode) {
      return "";
    }

  // 检查是否有提示文本覆盖且未过期
    if (this.drawHintOverrideText && Date.now() < this.drawHintOverrideUntil) {
      return this.drawHintOverrideText;
    }
  // 重置提示文本覆盖相关属性
    this.drawHintOverrideText = null;
    this.drawHintOverrideUntil = 0;

  // 获取当前点的数量
    const pointCount = state.tempPositions.length;

  // 根据不同的绘图模式返回相应的提示文本
    switch (state.drawMode) {
      case "circle": {

      // 圆形绘制模式下的提示文本
        if (pointCount === 0) return this.translate("draw.hint.circle_start"); // 开始绘制圆
        if (pointCount === 1) return this.translate("draw.hint.circle_radius"); // 设置圆的半径
        return this.translate("draw.hint.finish_or_undo"); // 完成绘制或撤销
      }
      case "rectangle": {

      // 矩形绘制模式下的提示文本
        if (pointCount === 0) return this.translate("draw.hint.rectangle_start"); // 开始绘制矩形
        if (pointCount === 1) return this.translate("draw.hint.rectangle_end"); // 设置矩形的对角点
        return this.translate("draw.hint.finish_or_undo"); // 完成绘制或撤销
      }
      case "polygon": {

      // 多边形绘制模式下的提示文本
        if (pointCount === 0) return this.translate("draw.hint.polygon_start"); // 开始绘制多边形
        if (pointCount === 1) return this.translate("draw.hint.polygon_add");
        return this.translate("draw.hint.polygon_continue");
      }
      case "line": {
        if (pointCount === 0) return this.translate("draw.hint.line_start");
        if (pointCount === 1) return this.translate("draw.hint.line_add");
        return this.translate("draw.hint.line_continue");
      }
      default:
        return "";
    }
  }

  private toHintDisplayPosition(position: Cesium.Cartesian3, offsetHeight: number): Cesium.Cartesian3 {
    if (
      !position ||
      !Number.isFinite((position as any).x) ||
      !Number.isFinite((position as any).y) ||
      !Number.isFinite((position as any).z)
    ) {
      return position;
    }
    try {
      const carto = Cesium.Cartographic.fromCartesian(position);
      if (!Number.isFinite(carto.longitude) || !Number.isFinite(carto.latitude)) {
        return position;
      }
      const baseHeight = Number.isFinite(carto.height) ? (carto.height as number) : 0;
      const extraHeight = offsetHeight > 0 ? offsetHeight : 0.1;
      const displayPos = Cesium.Cartesian3.fromRadians(
        carto.longitude,
        carto.latitude,
        baseHeight + extraHeight
      );
      if (
        Number.isFinite((displayPos as any).x) &&
        Number.isFinite((displayPos as any).y) &&
        Number.isFinite((displayPos as any).z)
      ) {
        return displayPos;
      }
      return position;
    } catch {
      return position;
    }
  }
}
