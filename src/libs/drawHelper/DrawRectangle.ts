import * as Cesium from "cesium";
import type { Entity, Cartesian3 } from "cesium";
import { BaseDraw, type DrawResult, type DrawOptions, type DrawEntity } from './BaseDraw';
import { calculateRectangle, calculateRectangleArea, formatArea, isValidCartesian3 } from '../../utils/calc';

/**
 * 画矩形绘制类
 */
export class DrawRectangle extends BaseDraw {
  private currentRectangleEntity: Entity | null = null;

  /**
   * 开始绘制
   */
  public startDrawing(options?: DrawOptions): void {
    this.drawOptions = options;
    // 保证绘制期间场景处于连续渲染模式（如果原来为手动渲染）
    this.enableContinuousRenderingIfNeeded();

    this.clearTempEntities();
    this.tempPositions = [];
    this.currentRectangleEntity = null;

    if (this.originalDepthTestAgainstTerrain === null) {
      this.originalDepthTestAgainstTerrain = this.scene.globe.depthTestAgainstTerrain;
    }
    this.scene.globe.depthTestAgainstTerrain = false;

    if (this.callbacks.onDrawStart) {
      this.callbacks.onDrawStart();
    }
  }

  /**
   * 更新绘制实体（预览）
   */
  public updateDrawingEntity(previewPoint?: Cartesian3): void {
    const positions = [...this.tempPositions];
    if (previewPoint) {
      positions.push(previewPoint);
    }

    if (positions.length < 2) {
      if (this.currentRectangleEntity) {
        this.entities.remove(this.currentRectangleEntity);
        const index = this.tempEntities.indexOf(this.currentRectangleEntity);
        if (index > -1) {
          this.tempEntities.splice(index, 1);
        }
        this.currentRectangleEntity = null;
      }
      return;
    }

    const rect = calculateRectangle(positions[0], positions[1]);
    const rectHeightReference = Cesium.HeightReference.NONE;

    // 支持 strokeColor/strokeWidth 作为 outlineColor/outlineWidth 的别名
    // 如果提供了 strokeColor，优先使用它作为 outlineColor；否则使用 fillColor 或默认值
    const fillColor = this.drawOptions?.fillColor ? this.resolveColor(this.drawOptions.fillColor) : Cesium.Color.GREEN;
    const outlineColor = this.drawOptions?.strokeColor 
      ? this.resolveColor(this.drawOptions.strokeColor)
      : (this.drawOptions?.outlineColor ? this.resolveColor(this.drawOptions.outlineColor) : Cesium.Color.DARKGREEN);
    const outlineWidth = this.drawOptions?.strokeWidth ?? (this.drawOptions?.outlineWidth ?? 1);

    // 如果预览矩形实体已从实体集合中移除，则重置引用，后续重新创建
    if (this.currentRectangleEntity && !this.entities.contains(this.currentRectangleEntity)) {
      this.currentRectangleEntity = null;
    }

    if (this.currentRectangleEntity) {
      this.currentRectangleEntity.rectangle!.coordinates =
        new Cesium.ConstantProperty(rect);
      this.currentRectangleEntity.rectangle!.heightReference =
        new Cesium.ConstantProperty(rectHeightReference);
      this.currentRectangleEntity.rectangle!.extrudedHeight =
        this.offsetHeight > 0
          ? new Cesium.ConstantProperty(this.offsetHeight)
          : undefined;
      this.currentRectangleEntity.rectangle!.material = new Cesium.ColorMaterialProperty(fillColor.withAlpha(0.5));
      this.currentRectangleEntity.rectangle!.outlineColor = new Cesium.ConstantProperty(outlineColor);
      this.currentRectangleEntity.rectangle!.outlineWidth = new Cesium.ConstantProperty(outlineWidth);
    } else {
      this.currentRectangleEntity = this.entities.add({
        rectangle: {
          coordinates: rect,
          material: fillColor.withAlpha(0.5),
          heightReference: rectHeightReference,
          extrudedHeight:
            this.offsetHeight > 0 ? this.offsetHeight : undefined,
          outline: true,
          outlineColor: outlineColor,
          outlineWidth: outlineWidth,
        },
      });
      this.tempEntities.push(this.currentRectangleEntity);
    }
  }

  /**
   * 完成绘制
   */
  public finishDrawing(): DrawResult | null {
    if (this.tempPositions.length < 2) {
      this.restoreRequestRenderModeIfNeeded();
      return null;
    }

    const validPositions = this.tempPositions.filter((p) => isValidCartesian3(p));
    if (validPositions.length < 2) {
      this.restoreRequestRenderModeIfNeeded();
      return null;
    }

    const groundPositions = validPositions.map((p) => {
      const carto = Cesium.Cartographic.fromCartesian(p);
      return Cesium.Cartesian3.fromRadians(
        carto.longitude,
        carto.latitude,
        carto.height || 0
      );
    });

    const rect = calculateRectangle(groundPositions[0], groundPositions[1]);
    let finalEntity: Entity | null = null;

    // 支持 strokeColor/strokeWidth 作为 outlineColor/outlineWidth 的别名
    // 如果提供了 strokeColor，优先使用它作为 outlineColor；否则使用 fillColor 或默认值
    const fillColor = this.drawOptions?.fillColor ? this.resolveColor(this.drawOptions.fillColor) : Cesium.Color.GREEN;
    const outlineColor = this.drawOptions?.strokeColor 
      ? this.resolveColor(this.drawOptions.strokeColor)
      : (this.drawOptions?.outlineColor ? this.resolveColor(this.drawOptions.outlineColor) : Cesium.Color.DARKGREEN);
    const outlineWidth = this.drawOptions?.strokeWidth ?? (this.drawOptions?.outlineWidth ?? 1);

    if (this.offsetHeight > 0) {
      finalEntity = this.entities.add({
        name: "绘制的矩形",
        rectangle: {
          coordinates: rect,
          material: fillColor.withAlpha(0.5),
          heightReference: Cesium.HeightReference.NONE,
          extrudedHeight: this.offsetHeight,
          outline: true,
          outlineColor: outlineColor,
          outlineWidth: outlineWidth,
        },
      });
      (finalEntity as any)._groundRectangle = rect;
    } else {
      finalEntity = this.entities.add({
        name: "绘制的矩形",
        rectangle: {
          coordinates: rect,
          material: fillColor.withAlpha(0.5),
          heightReference: Cesium.HeightReference.NONE,
          outline: true,
          outlineColor: outlineColor,
          outlineWidth: outlineWidth,
        },
      });
      (finalEntity as any)._groundRectangle = rect;
    }

    if (finalEntity) {
      (finalEntity as any)._drawOptions = this.drawOptions;
      (finalEntity as any)._drawType = this.getDrawType();
      if (this.drawOptions?.onClick) {
        (finalEntity as any)._onClick = this.drawOptions.onClick;
      }
    }

    // 添加面积标签（可通过 showAreaLabel 关闭）
    const area = calculateRectangleArea(rect);
    if (area > 0 && this.drawOptions?.showAreaLabel !== false) {
      const rectCenter = Cesium.Rectangle.center(rect);
      const rectCenterGround = Cesium.Cartesian3.fromRadians(
        rectCenter.longitude,
        rectCenter.latitude,
        0
      );

      let rectDisplayCenter = rectCenterGround;
      if (this.offsetHeight > 0) {
        rectDisplayCenter = Cesium.Cartesian3.fromRadians(
          rectCenter.longitude,
          rectCenter.latitude,
          this.offsetHeight
        );
      }

      const areaText = `面积: ${formatArea(area)}`;
      const areaImage = this.createTotalLengthBillboardImage(areaText);

      const rectAreaLabelEntity = this.entities.add({
        position: rectDisplayCenter,
        billboard: {
          image: areaImage,
          pixelOffset: new Cesium.ConstantProperty(new Cesium.Cartesian2(0, -25)),
          heightReference: new Cesium.ConstantProperty(
            this.offsetHeight > 0
              ? Cesium.HeightReference.RELATIVE_TO_GROUND
              : Cesium.HeightReference.NONE
          ),
          verticalOrigin: new Cesium.ConstantProperty(Cesium.VerticalOrigin.BOTTOM),
          horizontalOrigin: new Cesium.ConstantProperty(Cesium.HorizontalOrigin.CENTER),
          scale: new Cesium.ConstantProperty(1.0),
          disableDepthTestDistance: new Cesium.ConstantProperty(Number.POSITIVE_INFINITY),
        },
      });
      (rectAreaLabelEntity as any)._groundPosition = rectCenterGround;
      (rectAreaLabelEntity as any)._ownerEntityId = (finalEntity as any).id;
      const drawEntity = finalEntity as DrawEntity;
      drawEntity._labelEntities = [...(drawEntity._labelEntities || []), rectAreaLabelEntity];
      this.tempLabelEntities.push(rectAreaLabelEntity);
    }

    // 结束绘制后移除所有红色点实体（不保留）
    this.tempEntities.forEach((entity) => {
      if (entity) {
        this.entities.remove(entity);
      }
    });

    this.tempEntities = [];
    this.tempPositions = [];
    this.currentRectangleEntity = null;

    if (this.originalDepthTestAgainstTerrain !== null) {
      this.scene.globe.depthTestAgainstTerrain = this.originalDepthTestAgainstTerrain;
      this.originalDepthTestAgainstTerrain = null;
    }

    // Cesium.Rectangle.subsample 通常会返回一个首尾闭合的点列（最后一个点与第一个点相同），
    // 这里为了方便业务侧直接使用 positions，去掉末尾与首点重复的那个点。
    const rectSampledPositions = Cesium.Rectangle.subsample(rect, this.scene.globe.ellipsoid);
    const rectPositions = (() => {
      if (rectSampledPositions.length > 1) {
        const first = rectSampledPositions[0];
        const last = rectSampledPositions[rectSampledPositions.length - 1];
        if (Cesium.Cartesian3.equalsEpsilon(first, last, Cesium.Math.EPSILON9)) {
          return rectSampledPositions.slice(0, rectSampledPositions.length - 1);
        }
      }
      return rectSampledPositions;
    })();
    const result: DrawResult = {
      entity: finalEntity,
      type: "rectangle",
      positions: rectPositions,
      areaKm2: area,
    };

    if (this.callbacks.onMeasureComplete) {
      this.callbacks.onMeasureComplete(result);
    }

    // 恢复渲染模式（如果之前修改过）
    this.restoreRequestRenderModeIfNeeded();

    if (this.callbacks.onDrawEnd) {
      // 把矩形的 DrawResult 一并传给 onDrawEnd
      this.callbacks.onDrawEnd(finalEntity, result);
    }

    return result;
  }

  /**
   * 获取绘制类型
   */
  public getDrawType(): "line" | "polygon" | "rectangle" | "circle" {
    return "rectangle";
  }
}

