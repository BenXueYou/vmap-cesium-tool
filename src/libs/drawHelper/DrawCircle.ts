import * as Cesium from "cesium";
import type { Entity, Cartesian3 } from "cesium";
import { BaseDraw, type DrawResult, type DrawOptions, type DrawEntity } from './BaseDraw';
import { formatArea } from '../../utils/calc';
import { i18n } from '../i18n';

/**
 * 画圆绘制类
 */
export class DrawCircle extends BaseDraw {
  private currentCircleEntity: Entity | null = null;
  private currentBorderEntity: Entity | null = null; // 边框折线，用作粗边框
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
    this.currentBorderEntity = null;
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

    // 如果预览圆实体或边框折线实体已从实体集合中移除，则重置引用，后续重新创建
    if (this.currentCircleEntity && !this.entities.contains(this.currentCircleEntity)) {
      this.currentCircleEntity = null;
    }
    if (this.currentBorderEntity && !this.entities.contains(this.currentBorderEntity)) {
      this.currentBorderEntity = null;
    }

    // 始终使用椭圆作为填充
    if (this.currentCircleEntity) {
      this.currentCircleEntity.ellipse!.semiMajorAxis = new Cesium.ConstantProperty(radius);
      this.currentCircleEntity.ellipse!.semiMinorAxis = new Cesium.ConstantProperty(radius);
      this.currentCircleEntity.position = new Cesium.ConstantPositionProperty(displayCenter);
      this.currentCircleEntity.ellipse!.material = new Cesium.ColorMaterialProperty(fillColor.withAlpha(0.3));
      this.currentCircleEntity.ellipse!.outline = new Cesium.ConstantProperty(outlineWidth <= 1);
      this.currentCircleEntity.ellipse!.outlineColor = new Cesium.ConstantProperty(outlineColor);
      this.currentCircleEntity.ellipse!.outlineWidth = new Cesium.ConstantProperty(outlineWidth <= 1 ? outlineWidth : 1);
    } else {
      this.currentCircleEntity = this.entities.add({
        position: displayCenter,
        ellipse: {
          semiMajorAxis: radius,
          semiMinorAxis: radius,
          material: fillColor.withAlpha(0.3),
          outline: outlineWidth <= 1,
          outlineColor: outlineColor,
          outlineWidth: outlineWidth <= 1 ? outlineWidth : 1,
          heightReference: Cesium.HeightReference.NONE,
        },
      });
      this.tempEntities.push(this.currentCircleEntity);
    }

    // 对于粗边框（outlineWidth > 1），使用闭合折线作为边框，避免环带导致的异常
    if (outlineWidth > 1) {
      const centerCarto2 = Cesium.Cartographic.fromCartesian(displayCenter);
      const baseHeight = centerCarto2.height || 0;
      const heightEpsilon = 0.1;
      const outerRadius = radius;
      const strokePositions = this.generateCirclePositions(centerCarto2, outerRadius, baseHeight + heightEpsilon);
      // 闭合折线
      const closedStroke = [...strokePositions, strokePositions[0]];

      if (this.currentBorderEntity && this.currentBorderEntity.polyline) {
        this.currentBorderEntity.polyline.positions = new Cesium.ConstantProperty(closedStroke);
        this.currentBorderEntity.polyline.material = new Cesium.ColorMaterialProperty(outlineColor);
        this.currentBorderEntity.polyline.width = new Cesium.ConstantProperty(outlineWidth);
        this.currentBorderEntity.polyline.clampToGround = new Cesium.ConstantProperty(false);
      } else {
        this.currentBorderEntity = this.entities.add({
          polyline: {
            positions: closedStroke,
            material: new Cesium.ColorMaterialProperty(outlineColor),
            width: outlineWidth,
            clampToGround: false,
          },
        });
        this.tempEntities.push(this.currentBorderEntity);
      }
    } else {
      // 细边框时不需要额外折线，清理可能存在的预览折线
      if (this.currentBorderEntity) {
        this.entities.remove(this.currentBorderEntity);
        const idx = this.tempEntities.indexOf(this.currentBorderEntity);
        if (idx > -1) this.tempEntities.splice(idx, 1);
        this.currentBorderEntity = null;
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
      // 粗边框：使用填充椭圆 + 闭合折线边框
      finalEntity = this.entities.add({
        name: "绘制的圆",
        position: displayCenter,
        ellipse: {
          semiMajorAxis: radius,
          semiMinorAxis: radius,
          material: fillColor.withAlpha(0.3),
          outline: false,
          heightReference: Cesium.HeightReference.NONE,
        },
      });

      const centerCarto2 = Cesium.Cartographic.fromCartesian(displayCenter);
      const baseHeight = centerCarto2.height || 0;
      const heightEpsilon = 0.1;
      const outerRadius = radius;
      const strokePositions = this.generateCirclePositions(centerCarto2, outerRadius, baseHeight + heightEpsilon);
      const closedStroke = [...strokePositions, strokePositions[0]];

      const borderEntity = this.entities.add({
        name: "绘制的圆-边框",
        polyline: {
          positions: closedStroke,
          material: new Cesium.ColorMaterialProperty(outlineColor),
          width: outlineWidth,
          clampToGround: this.offsetHeight > 0 ? false : true,
        },
      });
      (finalEntity as any)._borderEntity = borderEntity;
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

    // 添加面积标签（可通过 showAreaLabel 关闭）
    if (areaKm2 > 0 && this.drawOptions?.showAreaLabel !== false) {
      const areaText = i18n.t('draw.label.area', { value: formatArea(areaKm2) });
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
      (areaLabelEntity as any)._ownerEntityId = (finalEntity as any).id;
      const drawEntity = finalEntity as DrawEntity;
      drawEntity._labelEntities = [...(drawEntity._labelEntities || []), areaLabelEntity];
      this.tempLabelEntities.push(areaLabelEntity);
    }

    // 保留圆心位置的红色球体，删除半径上的点（第二个点）
    this.tempEntities.forEach((entity, index) => {
      if (entity) {
          this.entities.remove(entity);
      }
    });

    this.tempEntities = [];
    this.tempPositions = [];
    this.currentCircleEntity = null;
    this.currentBorderEntity = null;
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
    // Rectangle.subsample 返回的点列同样是闭合的（最后一个点与第一个点相同），
    // 这里做一次去重，避免业务使用 positions 时看到两个相同经纬度的点。
    const sampledPositions = Cesium.Rectangle.subsample(rectangle, this.scene.globe.ellipsoid);
    const positions = (() => {
      if (sampledPositions.length > 1) {
        const first = sampledPositions[0];
        const last = sampledPositions[sampledPositions.length - 1];
        if (Cesium.Cartesian3.equalsEpsilon(first, last, Cesium.Math.EPSILON9)) {
          return sampledPositions.slice(0, sampledPositions.length - 1);
        }
      }
      return sampledPositions;
    })();

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
      // 在 onDrawEnd 中同时传出实体和完整的 DrawResult
      this.callbacks.onDrawEnd(finalEntity, result);
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

