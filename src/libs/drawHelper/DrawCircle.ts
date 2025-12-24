import * as Cesium from "cesium";
import type { Entity, Cartesian3 } from "cesium";
import { BaseDraw, type DrawResult, type DrawOptions } from './BaseDraw';
import { formatArea } from '../../utils/calc';

/**
 * 画圆绘制类
 */
export class DrawCircle extends BaseDraw {
  private currentCircleEntity: Entity | null = null;
  private currentRingEntity: Entity | null = null; // 外圈（带洞）多边形，用作粗边框
  private currentFillEntity: Entity | null = null; // 内圈填充
  private centerPosition: Cartesian3 | null = null;

  /**
   * 开始绘制
   */
  public startDrawing(options?: DrawOptions): void {
    this.drawOptions = options;
    // 如果场景设置了 requestRenderMode（手动渲染），绘制期间临时关闭
    this.enableContinuousRenderingIfNeeded();

    this.clearTempEntities();
    this.tempPositions = [];
    this.currentCircleEntity = null;
    this.currentRingEntity = null;
    this.currentFillEntity = null;
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

    const fillColor = this.drawOptions?.fillColor ? this.resolveColor(this.drawOptions.fillColor) : Cesium.Color.BLUE;
    const outlineColor = this.drawOptions?.outlineColor ? this.resolveColor(this.drawOptions.outlineColor) : Cesium.Color.BLUE;
    const outlineWidth = this.drawOptions?.outlineWidth ?? 2;

    // 粗边框（outlineWidth > 1）时，使用环带多边形 + 内圈填充
    if (outlineWidth > 1) {
      // 清理旧的单椭圆预览
      if (this.currentCircleEntity) {
        this.entities.remove(this.currentCircleEntity);
        const idx = this.tempEntities.indexOf(this.currentCircleEntity);
        if (idx > -1) this.tempEntities.splice(idx, 1);
        this.currentCircleEntity = null;
      }

      const centerCarto2 = Cesium.Cartographic.fromCartesian(displayCenter);
      const baseHeight = centerCarto2.height || 0;
      const heightEpsilon = 0.1;
      const outerRadius = radius;
      const innerRadius = Math.max(0, radius - outlineWidth);

      const outerPositions = this.generateCirclePositions(centerCarto2, outerRadius, baseHeight + heightEpsilon);
      const innerPositions = this.generateCirclePositions(centerCarto2, innerRadius, baseHeight);

      if (this.currentRingEntity && this.currentRingEntity.polygon) {
        this.currentRingEntity.polygon.hierarchy = new Cesium.ConstantProperty(
          new Cesium.PolygonHierarchy(outerPositions, [new Cesium.PolygonHierarchy(innerPositions)])
        );
        this.currentRingEntity.polygon.material = new Cesium.ColorMaterialProperty(outlineColor);
      } else {
        this.currentRingEntity = this.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(outerPositions, [new Cesium.PolygonHierarchy(innerPositions)]),
            material: outlineColor,
            outline: false,
            heightReference: Cesium.HeightReference.NONE,
          },
        });
        this.tempEntities.push(this.currentRingEntity);
      }

      if (this.currentFillEntity && this.currentFillEntity.ellipse) {
        this.currentFillEntity.position = new Cesium.ConstantPositionProperty(displayCenter);
        this.currentFillEntity.ellipse.semiMajorAxis = new Cesium.ConstantProperty(innerRadius);
        this.currentFillEntity.ellipse.semiMinorAxis = new Cesium.ConstantProperty(innerRadius);
        this.currentFillEntity.ellipse.material = new Cesium.ColorMaterialProperty(fillColor.withAlpha(0.3));
        this.currentFillEntity.ellipse.outline = new Cesium.ConstantProperty(false);
      } else {
        this.currentFillEntity = this.entities.add({
          position: displayCenter,
          ellipse: {
            semiMajorAxis: innerRadius,
            semiMinorAxis: innerRadius,
            material: fillColor.withAlpha(0.3),
            outline: false,
            heightReference: Cesium.HeightReference.NONE,
          },
        });
        this.tempEntities.push(this.currentFillEntity);
      }
    } else {
      // 细边框：单椭圆预览
      // 清理环预览
      if (this.currentRingEntity) {
        this.entities.remove(this.currentRingEntity);
        const idx = this.tempEntities.indexOf(this.currentRingEntity);
        if (idx > -1) this.tempEntities.splice(idx, 1);
        this.currentRingEntity = null;
      }
      if (this.currentFillEntity) {
        this.entities.remove(this.currentFillEntity);
        const idx2 = this.tempEntities.indexOf(this.currentFillEntity);
        if (idx2 > -1) this.tempEntities.splice(idx2, 1);
        this.currentFillEntity = null;
      }

      if (this.currentCircleEntity) {
        this.currentCircleEntity.ellipse!.semiMajorAxis = new Cesium.ConstantProperty(radius);
        this.currentCircleEntity.ellipse!.semiMinorAxis = new Cesium.ConstantProperty(radius);
        this.currentCircleEntity.position = new Cesium.ConstantPositionProperty(displayCenter);
        this.currentCircleEntity.ellipse!.material = new Cesium.ColorMaterialProperty(fillColor.withAlpha(0.3));
        this.currentCircleEntity.ellipse!.outlineColor = new Cesium.ConstantProperty(outlineColor);
        this.currentCircleEntity.ellipse!.outlineWidth = new Cesium.ConstantProperty(outlineWidth);
      } else {
        this.currentCircleEntity = this.entities.add({
          position: displayCenter,
          ellipse: {
            semiMajorAxis: radius,
            semiMinorAxis: radius,
            material: fillColor.withAlpha(0.3),
            outline: true,
            outlineColor: outlineColor,
            outlineWidth: outlineWidth,
            heightReference: Cesium.HeightReference.NONE,
          },
        });
        this.tempEntities.push(this.currentCircleEntity);
      }
    }

    this.centerPosition = centerGround;
  }

  /**
   * 完成绘制
   */
  public finishDrawing(): DrawResult | null {
    if (this.tempPositions.length < 1) {
      this.restoreRequestRenderModeIfNeeded();
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
      this.restoreRequestRenderModeIfNeeded();
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

    const fillColor = this.drawOptions?.fillColor ? this.resolveColor(this.drawOptions.fillColor) : Cesium.Color.BLUE;
    const outlineColor = this.drawOptions?.outlineColor ? this.resolveColor(this.drawOptions.outlineColor) : Cesium.Color.BLUE;
    const outlineWidth = this.drawOptions?.outlineWidth ?? 2;

    if (outlineWidth > 1) {
      // 使用环带 + 内圈填充
      const centerCarto2 = Cesium.Cartographic.fromCartesian(displayCenter);
      const baseHeight = centerCarto2.height || 0;
      const heightEpsilon = 0.1;
      const outerRadius = radius;
      const innerRadius = Math.max(0, radius - outlineWidth);
      const outerPositions = this.generateCirclePositions(centerCarto2, outerRadius, baseHeight + heightEpsilon);
      const innerPositions = this.generateCirclePositions(centerCarto2, innerRadius, baseHeight);

      const outer = this.entities.add({
        name: "绘制的圆-环",
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(outerPositions, [new Cesium.PolygonHierarchy(innerPositions)]),
          material: outlineColor,
          outline: false,
          heightReference: Cesium.HeightReference.NONE,
        },
      });
      const inner = this.entities.add({
        name: "绘制的圆-填充",
        position: displayCenter,
        ellipse: {
          semiMajorAxis: innerRadius,
          semiMinorAxis: innerRadius,
          material: fillColor.withAlpha(0.3),
          outline: false,
          heightReference: Cesium.HeightReference.NONE,
        },
      });
      if (this.drawOptions?.onClick) {
        (inner as any)._onClick = this.drawOptions.onClick;
      }
      (outer as any)._innerEntity = inner;
      (outer as any)._isRing = true;
      (outer as any)._ringThickness = outlineWidth;
      finalEntity = outer;
    } else {
      finalEntity = this.entities.add({
        name: "绘制的圆",
        position: displayCenter,
        ellipse: {
          semiMajorAxis: radius,
          semiMinorAxis: radius,
          material: fillColor.withAlpha(0.3),
          outline: true,
          outlineColor: outlineColor,
          outlineWidth: outlineWidth,
          heightReference: Cesium.HeightReference.NONE,
        },
      });
    }
    (finalEntity as any)._groundPosition = centerGround;
    (finalEntity as any)._radius = radius;

    if (finalEntity) {
      (finalEntity as any)._drawOptions = this.drawOptions;
      (finalEntity as any)._drawType = this.getDrawType();
      if (this.drawOptions?.onClick) {
        (finalEntity as any)._onClick = this.drawOptions.onClick;
      }
    }

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

    // 保留圆心位置的红色球体，删除半径上的点（第二个点）
    this.tempEntities.forEach((entity, index) => {
      if (entity) {
        // 保留第一个点（圆心），删除其他点（半径上的点）
        if (index === 0 && entity.point) {
          // 保留圆心点实体
          this.finishedPointEntities.push(entity);
        } else {
          // 删除半径上的点实体和其他临时实体
          this.entities.remove(entity);
        }
      }
    });

    this.tempEntities = [];
    this.tempPositions = [];
    this.currentCircleEntity = null;
    this.currentRingEntity = null;
    this.currentFillEntity = null;
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

    // 确保恢复 requestRenderMode（如果需要）
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
    return "circle";
  }

  /**
   * 生成近似圆（多边形）顶点
   */
  private generateCirclePositions(center: Cesium.Cartographic, radiusMeters: number, heightMeters: number, segments: number = 128): Cesium.Cartesian3[] {
    const R = 6378137.0;
    const lat1 = center.latitude;
    const lon1 = center.longitude;
    const d = radiusMeters / R;
    const positions: Cesium.Cartesian3[] = [];
    for (let i = 0; i < segments; i++) {
      const bearing = (i / segments) * Cesium.Math.TWO_PI;
      const sinLat1 = Math.sin(lat1);
      const cosLat1 = Math.cos(lat1);
      const sinD = Math.sin(d);
      const cosD = Math.cos(d);
      const sinBearing = Math.sin(bearing);
      const cosBearing = Math.cos(bearing);
      const lat2 = Math.asin(sinLat1 * cosD + cosLat1 * sinD * cosBearing);
      const lon2 = lon1 + Math.atan2(sinBearing * sinD * cosLat1, cosD - sinLat1 * Math.sin(lat2));
      positions.push(Cesium.Cartesian3.fromRadians(lon2, lat2, heightMeters));
    }
    return positions;
  }
}

