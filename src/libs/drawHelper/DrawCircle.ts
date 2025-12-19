import * as Cesium from "cesium";
import type { Entity, Cartesian3 } from "cesium";
import { BaseDraw, type DrawResult } from './BaseDraw';
import { formatArea } from '../../utils/calc';

/**
 * 画圆绘制类
 */
export class DrawCircle extends BaseDraw {
  private currentCircleEntity: Entity | null = null;
  private centerPosition: Cartesian3 | null = null;

  /**
   * 开始绘制
   */
  public startDrawing(): void {
    this.clearTempEntities();
    this.tempPositions = [];
    this.currentCircleEntity = null;
    this.centerPosition = null;

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
    if (this.tempPositions.length === 0) {
      if (this.currentCircleEntity) {
        this.entities.remove(this.currentCircleEntity);
        const index = this.tempEntities.indexOf(this.currentCircleEntity);
        if (index > -1) {
          this.tempEntities.splice(index, 1);
        }
        this.currentCircleEntity = null;
      }
      return;
    }

    if (!previewPoint) {
      return;
    }

    const center = this.tempPositions[0];
    const radius = Cesium.Cartesian3.distance(center, previewPoint);

    if (radius < 1) {
      return;
    }

    const centerCarto = Cesium.Cartographic.fromCartesian(center);
    const centerGround = Cesium.Cartesian3.fromRadians(
      centerCarto.longitude,
      centerCarto.latitude,
      centerCarto.height || 0
    );

    let displayCenter = centerGround;
    if (this.offsetHeight > 0) {
      displayCenter = Cesium.Cartesian3.fromRadians(
        centerCarto.longitude,
        centerCarto.latitude,
        (centerCarto.height || 0) + this.offsetHeight
      );
    }

    // 计算圆的边界矩形（使用简单的近似方法）
    const radiusInRadians = radius / this.scene.globe.ellipsoid.maximumRadius;
    const rectangle = new Cesium.Rectangle(
      centerCarto.longitude - radiusInRadians,
      centerCarto.latitude - radiusInRadians,
      centerCarto.longitude + radiusInRadians,
      centerCarto.latitude + radiusInRadians
    );

    if (this.currentCircleEntity) {
      this.currentCircleEntity.ellipse!.semiMajorAxis = new Cesium.ConstantProperty(radius);
      this.currentCircleEntity.ellipse!.semiMinorAxis = new Cesium.ConstantProperty(radius);
      this.currentCircleEntity.position = new Cesium.ConstantPositionProperty(displayCenter);
    } else {
      this.currentCircleEntity = this.entities.add({
        position: displayCenter,
        ellipse: {
          semiMajorAxis: radius,
          semiMinorAxis: radius,
          material: Cesium.Color.BLUE.withAlpha(0.3),
          outline: true,
          outlineColor: Cesium.Color.BLUE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.NONE,
        },
      });
      this.tempEntities.push(this.currentCircleEntity);
    }

    this.centerPosition = centerGround;
  }

  /**
   * 完成绘制
   */
  public finishDrawing(): DrawResult | null {
    if (this.tempPositions.length < 1) {
      return null;
    }

    const center = this.tempPositions[0];
    const centerCarto = Cesium.Cartographic.fromCartesian(center);
    const centerGround = Cesium.Cartesian3.fromRadians(
      centerCarto.longitude,
      centerCarto.latitude,
      centerCarto.height || 0
    );

    // 如果没有第二个点，使用当前圆实体
    let radius = 0;
    if (this.tempPositions.length >= 2) {
      radius = Cesium.Cartesian3.distance(center, this.tempPositions[1]);
    } else if (this.currentCircleEntity) {
      const ellipse = this.currentCircleEntity.ellipse;
      if (ellipse) {
        const semiMajorAxis = ellipse.semiMajorAxis?.getValue(Cesium.JulianDate.now());
        radius = typeof semiMajorAxis === 'number' ? semiMajorAxis : 0;
      }
    }

    if (radius < 1) {
      return null;
    }

    let finalEntity: Entity | null = null;

    let displayCenter = centerGround;
    if (this.offsetHeight > 0) {
      displayCenter = Cesium.Cartesian3.fromRadians(
        centerCarto.longitude,
        centerCarto.latitude,
        (centerCarto.height || 0) + this.offsetHeight
      );
    }

    finalEntity = this.entities.add({
      name: "绘制的圆",
      position: displayCenter,
      ellipse: {
        semiMajorAxis: radius,
        semiMinorAxis: radius,
        material: Cesium.Color.BLUE.withAlpha(0.3),
        outline: true,
        outlineColor: Cesium.Color.BLUE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.NONE,
      },
    });
    (finalEntity as any)._groundPosition = centerGround;
    (finalEntity as any)._radius = radius;

    // 计算面积（π * r²）
    const areaKm2 = (Math.PI * radius * radius) / 1e6;

    // 添加面积标签
    if (areaKm2 > 0) {
      const areaText = `面积: ${formatArea(areaKm2)}`;
      const areaImage = this.createTotalLengthBillboardImage(areaText);

      const areaLabelEntity = this.entities.add({
        position: displayCenter,
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
      (areaLabelEntity as any)._groundPosition = centerGround;
      this.tempLabelEntities.push(areaLabelEntity);
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
    this.currentCircleEntity = null;
    this.centerPosition = null;

    if (this.originalDepthTestAgainstTerrain !== null) {
      this.scene.globe.depthTestAgainstTerrain = this.originalDepthTestAgainstTerrain;
      this.originalDepthTestAgainstTerrain = null;
    }

    // 生成圆的边界点（用于返回）
    const radiusInRadians = radius / this.scene.globe.ellipsoid.maximumRadius;
    const rectangle = new Cesium.Rectangle(
      centerCarto.longitude - radiusInRadians,
      centerCarto.latitude - radiusInRadians,
      centerCarto.longitude + radiusInRadians,
      centerCarto.latitude + radiusInRadians
    );
    const positions = Cesium.Rectangle.subsample(rectangle, this.scene.globe.ellipsoid);

    const result: DrawResult = {
      entity: finalEntity,
      type: "circle",
      positions: positions,
      areaKm2: areaKm2,
    };

    if (this.callbacks.onMeasureComplete) {
      this.callbacks.onMeasureComplete(result);
    }

    if (this.callbacks.onDrawEnd) {
      this.callbacks.onDrawEnd(finalEntity);
    }

    return result;
  }

  /**
   * 获取绘制类型
   */
  public getDrawType(): "line" | "polygon" | "rectangle" | "circle" {
    return "circle";
  }
}

