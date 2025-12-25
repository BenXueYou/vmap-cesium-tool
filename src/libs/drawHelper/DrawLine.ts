import * as Cesium from "cesium";
import type { Entity, Cartesian3 } from "cesium";
import { BaseDraw, type DrawResult, type DrawOptions } from './BaseDraw';
import { formatDistance, isValidCartesian3 } from '../../utils/calc';

/**
 * 画线绘制类
 */
export class DrawLine extends BaseDraw {
  private currentLineEntity: Entity | null = null;
  private currentSegmentLabels: Entity[] = [];
  private currentTotalLabel: Entity | null = null;
  private currentLinePositions: Cartesian3[] = [];
  private isTotalLabelWarmedUp: boolean = false;

  /**
   * 开始绘制
   */
  public startDrawing(options?: DrawOptions): void {
    this.drawOptions = options;
    // 如果场景是手动渲染模式（requestRenderMode），绘制期间需要关闭以保证连续渲染
    this.enableContinuousRenderingIfNeeded();

    this.warmupTotalLengthLabel();
    this.clearTempEntities();
    this.tempPositions = [];
    this.currentLineEntity = null;
    this.currentSegmentLabels = [];
    this.currentTotalLabel = null;
    this.currentLinePositions = [];

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
      this.clearLineEntity();
      return;
    }

    const elevatedPositions = this.offsetHeight > 0
      ? positions.map(pos => {
          const carto = Cesium.Cartographic.fromCartesian(pos);
          return Cesium.Cartesian3.fromRadians(
            carto.longitude,
            carto.latitude,
            (carto.height || 0) + this.offsetHeight
          );
        })
      : positions;

    // 更新或创建线条实体
    const strokeColor = this.drawOptions?.strokeColor ? this.resolveColor(this.drawOptions.strokeColor) : Cesium.Color.YELLOW;
    const strokeWidth = this.drawOptions?.strokeWidth ?? 5;

    if (this.currentLineEntity) {
      const positionsProperty = this.currentLineEntity.polyline!.positions;
      if (positionsProperty instanceof Cesium.CallbackProperty) {
        this.currentLinePositions.length = 0;
        this.currentLinePositions.push(...elevatedPositions);
      } else {
        this.currentLinePositions = [...elevatedPositions];
        this.currentLineEntity.polyline!.positions = new Cesium.CallbackProperty(
          () => this.currentLinePositions,
          false
        );
      }
      // 更新样式
      this.currentLineEntity.polyline!.material = new Cesium.ColorMaterialProperty(strokeColor);
      this.currentLineEntity.polyline!.width = new Cesium.ConstantProperty(strokeWidth);
    } else {
      this.currentLinePositions = [...elevatedPositions];
      this.currentLineEntity = this.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(
            () => this.currentLinePositions,
            false
          ),
          width: strokeWidth,
          material: strokeColor,
          clampToGround: this.offsetHeight === 0,
        },
      });
      this.tempEntities.push(this.currentLineEntity);
    }

    // 更新分段标签
    this.updateSegmentLabels(positions);

    // 更新总距离标签
    this.updateTotalLabel();
  }

  /**
   * 完成绘制
   */
  public finishDrawing(): DrawResult | null {
    // 在返回之前确保恢复渲染模式（若有变动）
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

    let finalEntity: Entity | null = null;
    let totalDistance = 0;

    const strokeColor = this.drawOptions?.strokeColor ? this.resolveColor(this.drawOptions.strokeColor) : Cesium.Color.YELLOW;
    const strokeWidth = this.drawOptions?.strokeWidth ?? 5;

    if (this.offsetHeight > 0) {
      const elevatedPositions = groundPositions.map(pos => {
        const carto = Cesium.Cartographic.fromCartesian(pos);
        return Cesium.Cartesian3.fromRadians(
          carto.longitude,
          carto.latitude,
          (carto.height || 0) + this.offsetHeight
        );
      });

      finalEntity = this.entities.add({
        name: "绘制的线",
        polyline: {
          positions: elevatedPositions,
          width: strokeWidth,
          material: strokeColor,
          clampToGround: false,
        },
      });
      (finalEntity as any)._groundPositions = groundPositions;
    } else {
      finalEntity = this.entities.add({
        name: "绘制的线",
        polyline: {
          positions: groundPositions,
          width: strokeWidth,
          material: strokeColor,
          clampToGround: true,
        },
      });
      (finalEntity as any)._groundPositions = groundPositions;
    }

    // 记录绘制选项与类型和回调
    if (finalEntity) {
      (finalEntity as any)._drawOptions = this.drawOptions;
      (finalEntity as any)._drawType = this.getDrawType();
      if (this.drawOptions?.onClick) {
        (finalEntity as any)._onClick = this.drawOptions.onClick;
      }
    }

    for (let i = 1; i < groundPositions.length; i++) {
      totalDistance += Cesium.Cartesian3.distance(
        groundPositions[i - 1],
        groundPositions[i]
      );
    }

    // 将临时标签实体转移到已完成标签实体数组
    this.tempLabelEntities.forEach((entity) => {
      // 标签已经在 updateDrawingEntity 中创建，这里不需要重复创建
    });

    // 结束绘制后移除所有红色点实体（不保留）
    this.tempEntities.forEach((entity) => {
      if (entity) {
        this.entities.remove(entity);
      }
    });

    this.tempEntities = [];
    this.tempPositions = [];
    this.currentLineEntity = null;
    this.currentSegmentLabels = [];
    this.currentTotalLabel = null;

    if (this.originalDepthTestAgainstTerrain !== null) {
      this.scene.globe.depthTestAgainstTerrain = this.originalDepthTestAgainstTerrain;
      this.originalDepthTestAgainstTerrain = null;
    }

    const result: DrawResult = {
      entity: finalEntity,
      type: "line",
      positions: groundPositions,
      distance: totalDistance,
    };

    if (this.callbacks.onMeasureComplete) {
      this.callbacks.onMeasureComplete(result);
    }

    // 恢复 requestRenderMode 到原始状态（如果之前被修改）
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
    return "line";
  }

  /**
   * 清理线条实体
   */
  private clearLineEntity(): void {
    if (this.currentLineEntity) {
      this.entities.remove(this.currentLineEntity);
      const index = this.tempEntities.indexOf(this.currentLineEntity);
      if (index > -1) {
        this.tempEntities.splice(index, 1);
      }
      this.currentLineEntity = null;
      this.currentLinePositions = [];
    }

    this.currentSegmentLabels.forEach((entity) => {
      if (entity) {
        this.entities.remove(entity);
        const index = this.tempLabelEntities.indexOf(entity);
        if (index > -1) {
          this.tempLabelEntities.splice(index, 1);
        }
      }
    });
    this.currentSegmentLabels = [];

    if (this.currentTotalLabel) {
      this.entities.remove(this.currentTotalLabel);
      const index = this.tempLabelEntities.indexOf(this.currentTotalLabel);
      if (index > -1) {
        this.tempLabelEntities.splice(index, 1);
      }
      this.currentTotalLabel = null;
    }
  }

  /**
   * 更新分段标签
   */
  private updateSegmentLabels(positions: Cartesian3[]): void {
    const currentSegmentCount = positions.length - 1;
    const existingLabelCount = this.currentSegmentLabels.length;

    // 移除多余的分段标签
    if (existingLabelCount > currentSegmentCount) {
      for (let i = currentSegmentCount; i < existingLabelCount; i++) {
        const entity = this.currentSegmentLabels[i];
        if (entity) {
          this.entities.remove(entity);
          const index = this.tempLabelEntities.indexOf(entity);
          if (index > -1) {
            this.tempLabelEntities.splice(index, 1);
          }
        }
      }
      this.currentSegmentLabels = this.currentSegmentLabels.slice(0, currentSegmentCount);
    }

    // 更新或创建分段标签
    for (let i = 0; i < currentSegmentCount; i++) {
      const startPos = positions[i];
      const endPos = positions[i + 1];
      const distance = Cesium.Cartesian3.distance(startPos, endPos);

      if (distance > 5.0) {
        const midPoint = Cesium.Cartesian3.midpoint(
          startPos,
          endPos,
          new Cesium.Cartesian3()
        );

        const midCarto = Cesium.Cartographic.fromCartesian(midPoint);
        const groundMidPoint = Cesium.Cartesian3.fromRadians(
          midCarto.longitude,
          midCarto.latitude,
          midCarto.height || 0
        );

        let elevatedMidPoint = midPoint;
        if (this.offsetHeight > 0) {
          elevatedMidPoint = Cesium.Cartesian3.fromRadians(
            midCarto.longitude,
            midCarto.latitude,
            (midCarto.height || 0) + this.offsetHeight
          );
        }

        const labelOffset = i % 2 === 0 ? -25 : 25;
        const segmentText = formatDistance(distance);

        if (i < this.currentSegmentLabels.length && this.currentSegmentLabels[i].billboard) {
          const segEntity = this.currentSegmentLabels[i];
          segEntity.position = new Cesium.ConstantPositionProperty(elevatedMidPoint);
          segEntity.billboard!.pixelOffset = new Cesium.ConstantProperty(new Cesium.Cartesian2(0, labelOffset));
          (segEntity as any)._groundPosition = groundMidPoint;

          const lastText = (segEntity as any)._segmentText as string | undefined;
          if (lastText !== segmentText) {
            const segmentImage = this.createSegmentLengthBillboardImage(segmentText);
            segEntity.billboard!.image = new Cesium.ConstantProperty(segmentImage);
            (segEntity as any)._segmentText = segmentText;
          }
        } else {
          const segmentImage = this.createSegmentLengthBillboardImage(segmentText);
          const segBillboardEntity = this.entities.add({
            position: elevatedMidPoint,
            billboard: {
              image: segmentImage,
              pixelOffset: new Cesium.ConstantProperty(new Cesium.Cartesian2(0, labelOffset)),
              heightReference: new Cesium.ConstantProperty(
                this.offsetHeight > 0
                  ? Cesium.HeightReference.RELATIVE_TO_GROUND
                  : Cesium.HeightReference.NONE
              ),
              verticalOrigin: new Cesium.ConstantProperty(Cesium.VerticalOrigin.CENTER),
              horizontalOrigin: new Cesium.ConstantProperty(Cesium.HorizontalOrigin.CENTER),
              scale: new Cesium.ConstantProperty(1.0),
              disableDepthTestDistance: new Cesium.ConstantProperty(Number.POSITIVE_INFINITY),
            },
          });
          (segBillboardEntity as any)._segmentText = segmentText;
          (segBillboardEntity as any)._groundPosition = groundMidPoint;
          this.currentSegmentLabels.push(segBillboardEntity);
          this.tempLabelEntities.push(segBillboardEntity);
        }
      } else {
        if (i < this.currentSegmentLabels.length) {
          const entity = this.currentSegmentLabels[i];
          if (entity) {
            this.entities.remove(entity);
            const index = this.tempLabelEntities.indexOf(entity);
            if (index > -1) {
              this.tempLabelEntities.splice(index, 1);
            }
          }
          this.currentSegmentLabels.splice(i, 1);
          i--;
        }
      }
    }
  }

  /**
   * 更新总距离标签
   */
  private updateTotalLabel(): void {
    if (this.tempPositions.length > 1) {
      let totalDistance = 0;
      for (let i = 1; i < this.tempPositions.length; i++) {
        totalDistance += Cesium.Cartesian3.distance(
          this.tempPositions[i - 1],
          this.tempPositions[i]
        );
      }

      const lastPos = this.tempPositions[this.tempPositions.length - 1];
      const lastCarto = Cesium.Cartographic.fromCartesian(lastPos);

      const groundLabelPosition = Cesium.Cartesian3.fromRadians(
        lastCarto.longitude,
        lastCarto.latitude,
        lastCarto.height || 0
      );

      let labelPosition = groundLabelPosition;
      if (this.offsetHeight > 0) {
        labelPosition = Cesium.Cartesian3.fromRadians(
          lastCarto.longitude,
          lastCarto.latitude,
          (lastCarto.height || 0) + this.offsetHeight
        );
      }

      const formattedDistance = formatDistance(totalDistance);
      const labelText = `总长: ${formattedDistance}`;
      const image = this.createTotalLengthBillboardImage(labelText);

      if (this.currentTotalLabel && this.currentTotalLabel.billboard) {
        this.currentTotalLabel.position = new Cesium.ConstantPositionProperty(labelPosition);
        this.currentTotalLabel.billboard.image = new Cesium.ConstantProperty(image);
        (this.currentTotalLabel as any)._groundPosition = groundLabelPosition;
      } else {
        const totalBillboardEntity = this.entities.add({
          position: labelPosition,
          billboard: {
            image,
            pixelOffset: new Cesium.ConstantProperty(new Cesium.Cartesian2(0, -35)),
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
        this.currentTotalLabel = totalBillboardEntity;
        (this.currentTotalLabel as any)._groundPosition = groundLabelPosition;
        this.tempLabelEntities.push(totalBillboardEntity);
      }
    } else {
      if (this.currentTotalLabel) {
        this.entities.remove(this.currentTotalLabel);
        const index = this.tempLabelEntities.indexOf(this.currentTotalLabel);
        if (index > -1) {
          this.tempLabelEntities.splice(index, 1);
        }
        this.currentTotalLabel = null;
      }
    }
  }

  /**
   * 总长标签预热
   */
  private warmupTotalLengthLabel(): void {
    if (this.isTotalLabelWarmedUp) return;

    let carto: Cesium.Cartographic;
    try {
      carto = this.viewer.camera.positionCartographic.clone();
    } catch {
      carto = Cesium.Cartographic.fromDegrees(120.2052342, 30.2489634, this.offsetHeight);
    }

    const position = Cesium.Cartesian3.fromRadians(
      carto.longitude,
      carto.latitude,
      (carto.height || 0) + this.offsetHeight
    );

    const warmupLabel = this.entities.add({
      position,
      label: {
        text: "总长: 0.00 m",
        font: "bold 16px 'Microsoft YaHei', 'PingFang SC', sans-serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -35),
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        scale: 1.0,
        showBackground: true,
        backgroundPadding: new Cesium.Cartesian2(6, 3),
        backgroundColor: Cesium.Color.BLACK.withAlpha(0.8),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        show: false,
      },
    });

    this.isTotalLabelWarmedUp = true;

    requestAnimationFrame(() => {
      try {
        this.entities.remove(warmupLabel);
      } catch {
        // 安全忽略移除错误
      }
    });
  }
}

