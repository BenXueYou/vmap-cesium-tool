import * as Cesium from "cesium";
import type { Entity, Cartesian3 } from "cesium";
import { BaseDraw, type DrawResult, type DrawOptions } from './BaseDraw';
import { calculateRectangle, calculateRectangleArea, formatArea, isValidCartesian3 } from '../../utils/calc';

/**
 * 画矩形绘制类
 */
export class DrawRectangle extends BaseDraw {
  private currentRectangleEntity: Entity | null = null;

  /**
   * 开始绘制
   */
  public startDrawing(): void {
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

    const fillColor = this.drawOptions?.fillColor ? this.resolveColor(this.drawOptions.fillColor) : Cesium.Color.GREEN;
    const outlineColor = this.drawOptions?.outlineColor ? this.resolveColor(this.drawOptions.outlineColor) : Cesium.Color.DARKGREEN;
    const outlineWidth = this.drawOptions?.outlineWidth ?? 1;

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

    const fillColor = this.drawOptions?.fillColor ? this.resolveColor(this.drawOptions.fillColor) : Cesium.Color.GREEN;
    const outlineColor = this.drawOptions?.outlineColor ? this.resolveColor(this.drawOptions.outlineColor) : Cesium.Color.DARKGREEN;
    const outlineWidth = this.drawOptions?.outlineWidth ?? 1;

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

    // 添加面积标签
    const area = calculateRectangleArea(rect);
    if (area > 0) {
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
      this.tempLabelEntities.push(rectAreaLabelEntity);
    }

    // 将临时点实体转移到已完成点实体数组
    this.tempEntities.forEach((entity) => {
      if (entity && entity.point) {
        this.finishedPointEntities.push(entity);
      } else {
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

    const rectPositions = Cesium.Rectangle.subsample(rect, this.scene.globe.ellipsoid);
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
      this.callbacks.onDrawEnd(finalEntity);
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

