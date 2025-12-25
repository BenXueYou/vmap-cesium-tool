import * as Cesium from "cesium";
import type { Entity, Cartesian3 } from "cesium";
import { BaseDraw, type DrawResult, type DrawOptions } from './BaseDraw';
import { isValidCartesian3, calculatePolygonArea, calculatePolygonCenter, formatArea } from '../../utils/calc';

/**
 * 画多边形绘制类
 */
export class DrawPolygon extends BaseDraw {
  private currentPolygonEntity: Entity | null = null;
  private currentBorderEntity: Entity | null = null;

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
    this.currentBorderEntity = null;

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

      // 使用输入参数：填充色、描边颜色与宽度
      const fillColor = this.drawOptions?.fillColor
        ? this.resolveColor(this.drawOptions.fillColor)
        : Cesium.Color.LIGHTGREEN;
      const strokeColor = this.drawOptions?.strokeColor
        ? this.resolveColor(this.drawOptions.strokeColor)
        : (this.drawOptions?.outlineColor ? this.resolveColor(this.drawOptions.outlineColor) : Cesium.Color.DARKGREEN);
      const strokeWidth = this.drawOptions?.strokeWidth ?? (this.drawOptions?.outlineWidth ?? 2);

      // 先更新/创建填充面
      if (this.currentPolygonEntity) {
        this.currentPolygonEntity.polygon!.hierarchy = new Cesium.ConstantProperty(
          new Cesium.PolygonHierarchy(polygonPositions)
        );
        this.currentPolygonEntity.polygon!.heightReference = new Cesium.ConstantProperty(heightReference);
        this.currentPolygonEntity.polygon!.material = new Cesium.ColorMaterialProperty(fillColor);
        this.currentPolygonEntity.polygon!.outline = new Cesium.ConstantProperty(false);
      } else {
        this.currentPolygonEntity = this.entities.add({
          polygon: {
            hierarchy: new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(polygonPositions)),
            material: new Cesium.ColorMaterialProperty(fillColor),
            outline: false,
            heightReference,
          },
        });
        this.tempEntities.push(this.currentPolygonEntity);
      }

      // 再更新/创建边框折线（闭合）
      const closedPositions = polygonPositions.slice();
      if (closedPositions.length >= 2) closedPositions.push(polygonPositions[0]);

      if (this.currentBorderEntity && this.currentBorderEntity.polyline) {
        this.currentBorderEntity.polyline.positions = new Cesium.ConstantProperty(closedPositions);
        this.currentBorderEntity.polyline.width = new Cesium.ConstantProperty(strokeWidth);
        this.currentBorderEntity.polyline.material = new Cesium.ColorMaterialProperty(strokeColor);
        this.currentBorderEntity.polyline.clampToGround = new Cesium.ConstantProperty(false);
      } else {
        this.currentBorderEntity = this.entities.add({
          polyline: {
            positions: new Cesium.ConstantProperty(closedPositions),
            width: strokeWidth,
            material: new Cesium.ColorMaterialProperty(strokeColor),
            clampToGround: false,
          },
        });
        this.tempEntities.push(this.currentBorderEntity);
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
      if (this.currentBorderEntity) {
        this.entities.remove(this.currentBorderEntity);
        const idx = this.tempEntities.indexOf(this.currentBorderEntity);
        if (idx > -1) {
          this.tempEntities.splice(idx, 1);
        }
        this.currentBorderEntity = null;
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
    let finalBorder: Entity | null = null;

    // 使用 drawOptions 中的颜色和边框设置
    const fillColor = this.drawOptions?.fillColor
      ? this.resolveColor(this.drawOptions.fillColor)
      : Cesium.Color.LIGHTGREEN;
    const strokeColor = this.drawOptions?.strokeColor
      ? this.resolveColor(this.drawOptions.strokeColor)
      : (this.drawOptions?.outlineColor ? this.resolveColor(this.drawOptions.outlineColor) : Cesium.Color.DARKGREEN);
    const strokeWidth = this.drawOptions?.strokeWidth ?? (this.drawOptions?.outlineWidth ?? 2);

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
          material: new Cesium.ColorMaterialProperty(fillColor),
          outline: false,
          heightReference: Cesium.HeightReference.NONE,
        },
      });
      // 边框（不贴地，随高度提升）
      const closedElev = elevatedPositions.slice();
      if (closedElev.length >= 2) closedElev.push(elevatedPositions[0]);
      finalBorder = this.entities.add({
        polyline: {
          positions: closedElev,
          width: strokeWidth,
          material: new Cesium.ColorMaterialProperty(strokeColor),
          clampToGround: false,
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
          material: new Cesium.ColorMaterialProperty(fillColor),
          outline: false,
          heightReference: Cesium.HeightReference.NONE,
        },
      });
      // 边框（贴地）
      const closedGround = groundPositions.slice();
      if (closedGround.length >= 2) closedGround.push(groundPositions[0]);
      finalBorder = this.entities.add({
        polyline: {
          positions: closedGround,
          width: strokeWidth,
          material: new Cesium.ColorMaterialProperty(strokeColor),
          clampToGround: true,
        },
      });
      (finalEntity as any)._groundPositions = groundPositions;

      if (finalEntity) {
        (finalEntity as any)._drawOptions = this.drawOptions;
        (finalEntity as any)._drawType = this.getDrawType();
        if (this.drawOptions?.onClick) {
          (finalEntity as any)._onClick = this.drawOptions.onClick;
        }
        if (finalBorder) {
          (finalEntity as any)._borderEntity = finalBorder;
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
    this.currentBorderEntity = null;

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

