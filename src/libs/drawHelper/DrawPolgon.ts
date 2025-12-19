import * as Cesium from "cesium";
import type { Entity, Cartesian3 } from "cesium";
import { BaseDraw, type DrawResult, type DrawOptions } from './BaseDraw';
import { isValidCartesian3, calculatePolygonArea, calculatePolygonCenter, formatArea } from '../../utils/calc';

/**
 * 画多边形绘制类
 */
export class DrawPolygon extends BaseDraw {
  private currentPolygonEntity: Entity | null = null;

  /**
   * 开始绘制
   */
  public startDrawing(options?: DrawOptions): void {
    this.drawOptions = options;
    // 如果启用了手动渲染模式，绘制期间临时关闭以保证连贯的预览
    this.enableContinuousRenderingIfNeeded();

    this.clearTempEntities();
    this.tempPositions = [];
    this.currentPolygonEntity = null;

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
    // 在 3D 模式下如果地形尚未加载完成，不创建多边形预览
    if (this.scene.mode === Cesium.SceneMode.SCENE3D && !this.scene.globe.tilesLoaded) {
      return;
    }

    const committedPositions = this.tempPositions.filter((p) => isValidCartesian3(p));
    const sourceBase = committedPositions;
    const polygonSource =
      previewPoint && isValidCartesian3(previewPoint) && sourceBase.length >= 2
        ? [...sourceBase, previewPoint]
        : sourceBase;

    if (polygonSource.length >= 3) {
      const polygonPositions = polygonSource.map((pos) => {
        const carto = Cesium.Cartographic.fromCartesian(pos);
        const baseHeight = carto.height || 0;
        const extraHeight = this.offsetHeight > 0 ? this.offsetHeight : 0.1;
        return Cesium.Cartesian3.fromRadians(
          carto.longitude,
          carto.latitude,
          baseHeight + extraHeight
        );
      });
      const heightReference = Cesium.HeightReference.NONE;

      const fillColor = this.drawOptions?.fillColor ? this.resolveColor(this.drawOptions.fillColor) : Cesium.Color.LIGHTGREEN;
      const outlineColor = this.drawOptions?.outlineColor ? this.resolveColor(this.drawOptions.outlineColor) : Cesium.Color.DARKGREEN;
      const outlineWidth = this.drawOptions?.outlineWidth ?? 2;

      if (this.currentPolygonEntity) {
        this.currentPolygonEntity.polygon!.hierarchy =
          new Cesium.ConstantProperty(
            new Cesium.PolygonHierarchy(polygonPositions)
          );
        this.currentPolygonEntity.polygon!.heightReference =
          new Cesium.ConstantProperty(heightReference);
        this.currentPolygonEntity.polygon!.material = new Cesium.ColorMaterialProperty(fillColor.withAlpha(0.3));
        this.currentPolygonEntity.polygon!.outlineColor = new Cesium.ConstantProperty(outlineColor);
        this.currentPolygonEntity.polygon!.outlineWidth = new Cesium.ConstantProperty(outlineWidth);
      } else {
        this.currentPolygonEntity = this.entities.add({
          polygon: {
            hierarchy: new Cesium.ConstantProperty(
              new Cesium.PolygonHierarchy(polygonPositions)
            ),
            material: fillColor.withAlpha(0.3),
            outline: true,
            outlineColor: outlineColor,
            outlineWidth: outlineWidth,
            heightReference,
          },
        });
        this.tempEntities.push(this.currentPolygonEntity);
      }
    } else {
      if (this.currentPolygonEntity) {
        this.entities.remove(this.currentPolygonEntity);
        const index = this.tempEntities.indexOf(this.currentPolygonEntity);
        if (index > -1) {
          this.tempEntities.splice(index, 1);
        }
        this.currentPolygonEntity = null;
      }
    }
  }

  /**
   * 完成绘制
   */
  public finishDrawing(): DrawResult | null {
    const validPositions = this.tempPositions.filter((p) => isValidCartesian3(p));
    if (validPositions.length < 3) {
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
        name: "绘制的多边形区域",
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(elevatedPositions),
          material: Cesium.Color.LIGHTGREEN.withAlpha(0.3),
          outline: true,
          outlineColor: Cesium.Color.DARKGREEN,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.NONE,
        },
      });
      (finalEntity as any)._groundPositions = groundPositions;

      if (finalEntity) {
        (finalEntity as any)._drawOptions = this.drawOptions;
        (finalEntity as any)._drawType = this.getDrawType();
        if (this.drawOptions?.onClick) {
          (finalEntity as any)._onClick = this.drawOptions.onClick;
        }
      }
    } else {
      finalEntity = this.entities.add({
        name: "绘制的多边形区域",
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(groundPositions),
          material: Cesium.Color.LIGHTGREEN.withAlpha(0.3),
          outline: true,
          outlineColor: Cesium.Color.DARKGREEN,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.NONE,
        },
      });
      (finalEntity as any)._groundPositions = groundPositions;

      if (finalEntity) {
        (finalEntity as any)._drawOptions = this.drawOptions;
        (finalEntity as any)._drawType = this.getDrawType();
        if (this.drawOptions?.onClick) {
          (finalEntity as any)._onClick = this.drawOptions.onClick;
        }
      }
    }

    // 添加面积标签
    const area = calculatePolygonArea(groundPositions, this.scene.globe.ellipsoid);
    if (area > 0) {
      const center = calculatePolygonCenter(groundPositions);
      const centerCarto = Cesium.Cartographic.fromCartesian(center);
      const groundCenter = Cesium.Cartesian3.fromRadians(
        centerCarto.longitude,
        centerCarto.latitude,
        centerCarto.height || 0
      );

      let displayCenter = groundCenter;
      if (this.offsetHeight > 0) {
        displayCenter = Cesium.Cartesian3.fromRadians(
          centerCarto.longitude,
          centerCarto.latitude,
          (centerCarto.height || 0) + this.offsetHeight
        );
      }

      const areaText = `面积: ${formatArea(area)}`;
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
      (areaLabelEntity as any)._groundPosition = groundCenter;
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
    this.currentPolygonEntity = null;

    if (this.originalDepthTestAgainstTerrain !== null) {
      this.scene.globe.depthTestAgainstTerrain = this.originalDepthTestAgainstTerrain;
      this.originalDepthTestAgainstTerrain = null;
    }

    const result: DrawResult = {
      entity: finalEntity,
      type: "polygon",
      positions: groundPositions,
      areaKm2: calculatePolygonArea(groundPositions, this.scene.globe.ellipsoid),
    };

    if (this.callbacks.onMeasureComplete) {
      this.callbacks.onMeasureComplete(result);
    }

    // 恢复 requestRenderMode（如果需要）
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
    return "polygon";
  }
}

