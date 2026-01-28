import * as Cesium from "cesium";
import type { Entity, Cartesian3 } from "cesium";
import { BaseDraw, type DrawResult, type DrawOptions, type DrawEntity } from './BaseDraw';
import { isValidCartesian3, calculatePolygonArea, calculatePolygonCenter, formatArea } from '../../utils/calc';
import { i18n } from '../i18n';
import { isClosedPolygonSelfIntersecting } from '../../utils/selfIntersection';

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
    if (previewPoint && !isValidCartesian3(previewPoint)) {
      console.error("[DrawPolygon] Invalid preview point detected:", previewPoint);
      return; // 中断流程，避免无效点导致后续错误
    }

    // 不因 tilesLoaded 停止预览：地形未就绪时用椭球拾取点预览，后续再做采样修正

    const committedPositions = this.tempPositions.filter((p) => isValidCartesian3(p));
    const sourceBase = committedPositions;
    const polygonSource =
      previewPoint && isValidCartesian3(previewPoint) && sourceBase.length >= 2
        ? [...sourceBase, previewPoint]
        : sourceBase;

    if (polygonSource.length >= 3) {
      // 先将源点转换为 Cartographic，并过滤掉经纬度为非有限数值的点
      const cartos = polygonSource
        .map((pos) => {
          try {
            return Cesium.Cartographic.fromCartesian(pos);
          } catch {
            return null;
          }
        })
        .filter((c) => c && Number.isFinite(c.longitude) && Number.isFinite(c.latitude)) as Cesium.Cartographic[];

      if (cartos.length < 3) {
        // 不满足有效点数量，清理预览实体
        if (this.currentPolygonEntity) {
          this.entities.remove(this.currentPolygonEntity);
          const index = this.tempEntities.indexOf(this.currentPolygonEntity);
          if (index > -1) this.tempEntities.splice(index, 1);
          this.currentPolygonEntity = null;
        }
        if (this.currentBorderEntity) {
          this.entities.remove(this.currentBorderEntity);
          const idx = this.tempEntities.indexOf(this.currentBorderEntity);
          if (idx > -1) this.tempEntities.splice(idx, 1);
          this.currentBorderEntity = null;
        }
        return;
      }

      const polygonPositions = cartos.map((carto) => {
        const baseHeight = Number.isFinite(carto.height) ? (carto.height as number) : 0;
        const extraHeight = this.offsetHeight > 0 ? this.offsetHeight : 0.1;
        const p = Cesium.Cartesian3.fromRadians(
          carto.longitude,
          carto.latitude,
          baseHeight + extraHeight
        );
        return p;
      });
      // 过滤掉 fromRadians 产生的非有限坐标（fromRadians 不会抛异常，但可能返回 NaN）
      const safePolygonPositions = polygonPositions.filter((p) => isValidCartesian3(p));
      if (safePolygonPositions.length < 3) {
        return;
      }
      const heightReference = Cesium.HeightReference.NONE;

      // 使用输入参数：填充色、描边颜色与宽度
      const fillColor = this.drawOptions?.fillColor
        ? this.resolveColor(this.drawOptions.fillColor)
        : Cesium.Color.LIGHTGREEN.withAlpha(0.3);
      const strokeColor = this.drawOptions?.strokeColor
        ? this.resolveColor(this.drawOptions.strokeColor)
        : (this.drawOptions?.outlineColor ? this.resolveColor(this.drawOptions.outlineColor) : Cesium.Color.LIGHTGREEN);
      const strokeWidth = this.drawOptions?.strokeWidth ?? (this.drawOptions?.outlineWidth ?? 2);

      // 防御：如果历史版本产生了多个重叠预览面/边框（重复创建未更新），这里清理重复项
      const previewPolygons = this.tempEntities.filter((e) => !!(e as any)?.polygon);
      const previewBorders = this.tempEntities.filter((e) => {
        const anyE = e as any;
        return !!anyE?.polyline && !anyE?.point && !anyE?.polygon;
      });
      if (previewPolygons.length > 1 || previewBorders.length > 1) {
        [...previewPolygons, ...previewBorders].forEach((e) => {
          this.entities.remove(e);
        });
        this.tempEntities = this.tempEntities.filter((e) => {
          const anyE = e as any;
          if (anyE?.point) return true;
          if (anyE?.polygon) return false;
          if (anyE?.polyline && !anyE?.polygon) return false;
          return true;
        });
        this.currentPolygonEntity = null;
        this.currentBorderEntity = null;
      }

      // 如果预览实体引用已失效（例如被 BaseDraw.clearTempEntities 清理过），重置引用，后续重新创建
      if (this.currentPolygonEntity && this.tempEntities.indexOf(this.currentPolygonEntity) === -1) {
        this.currentPolygonEntity = null;
      }
      if (this.currentBorderEntity && this.tempEntities.indexOf(this.currentBorderEntity) === -1) {
        this.currentBorderEntity = null;
      }

      // 先更新/创建填充面
      if (this.currentPolygonEntity) {
        this.currentPolygonEntity.polygon!.hierarchy = new Cesium.ConstantProperty(
          new Cesium.PolygonHierarchy(safePolygonPositions)
        );
        this.currentPolygonEntity.polygon!.heightReference = new Cesium.ConstantProperty(heightReference);
        (this.currentPolygonEntity.polygon as any).perPositionHeight = new Cesium.ConstantProperty(true);
        this.currentPolygonEntity.polygon!.material = new Cesium.ColorMaterialProperty(fillColor);
        this.currentPolygonEntity.polygon!.outline = new Cesium.ConstantProperty(false);
      } else {
        this.currentPolygonEntity = this.entities.add({
          polygon: {
            hierarchy: new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(safePolygonPositions)),
            material: new Cesium.ColorMaterialProperty(fillColor),
            outline: false,
            heightReference,
            perPositionHeight: true,
          },
        });
        this.tempEntities.push(this.currentPolygonEntity);
      }

      // 再更新/创建边框折线（闭合）
      const closedPositions = safePolygonPositions.slice();
      if (closedPositions.length >= 2) closedPositions.push(safePolygonPositions[0]);

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
      console.warn("[DrawPolygon] Not enough valid positions to finish drawing:", validPositions);
      this.restoreRequestRenderModeIfNeeded();
      // 清除掉红色的球体实体
      this.tempEntities.forEach((entity) => {
        if (entity) {
          this.entities.remove(entity);
        }
      });
      this.tempEntities.length = 0;
      this.tempPositions = [];
      this.currentPolygonEntity = null;
      this.currentBorderEntity = null;
      return null;
    }

    // 转换为 Cartographic 并过滤掉经纬度为非有限数值的点，防止 NaN 传入地面几何
    const groundCartos = validPositions
      .map((p) => {
        try {
          return Cesium.Cartographic.fromCartesian(p);
        } catch {
          return null;
        }
      })
      .filter((c) => c && Number.isFinite(c.longitude) && Number.isFinite(c.latitude)) as Cesium.Cartographic[];

    if (groundCartos.length < 3) {
      this.restoreRequestRenderModeIfNeeded();
      return null;
    }

    const groundPositions = groundCartos.map((carto) =>
      Cesium.Cartesian3.fromRadians(
        carto.longitude,
        carto.latitude,
        Number.isFinite(carto.height) ? (carto.height as number) : 0
      )
    );

    const safeGroundPositions = groundPositions.filter((p) => isValidCartesian3(p));
    if (safeGroundPositions.length < 3) {
      console.warn("[DrawPolygon] Not enough valid ground positions to finish drawing:", safeGroundPositions);
      this.restoreRequestRenderModeIfNeeded();
      return null;
    }

    // 自相交校验（闭合边也纳入检测）：不允许则阻止完成
    const selfIntersectionEnabled = !!this.drawOptions?.selfIntersectionEnabled;
    const allowTouch = !!this.drawOptions?.selfIntersectionAllowTouch;
    const allowContinue = !!this.drawOptions?.selfIntersectionAllowContinue;
    if (selfIntersectionEnabled) {
      const selfIntersecting = isClosedPolygonSelfIntersecting(safeGroundPositions, { allowTouch });
      if (selfIntersecting && !allowContinue) {
        this.restoreRequestRenderModeIfNeeded();
        return null;
      }
    }

    let finalEntity: Entity | null = null;
    let finalBorder: Entity | null = null;

    // 使用 drawOptions 中的颜色和边框设置
    const fillColor = this.drawOptions?.fillColor
      ? this.resolveColor(this.drawOptions.fillColor)
      : Cesium.Color.LIGHTGREEN.withAlpha(0.3);
    const strokeColor = this.drawOptions?.strokeColor
      ? this.resolveColor(this.drawOptions.strokeColor)
      : (this.drawOptions?.outlineColor ? this.resolveColor(this.drawOptions.outlineColor) : Cesium.Color.LIGHTGREEN);
    const strokeWidth = this.drawOptions?.strokeWidth ?? (this.drawOptions?.outlineWidth ?? 2);
    if (this.offsetHeight > 0) {
      const elevatedPositions = safeGroundPositions
        .map((pos) => {
          try {
            const carto = Cesium.Cartographic.fromCartesian(pos);
            if (!Number.isFinite(carto.longitude) || !Number.isFinite(carto.latitude)) return null;
            const baseHeight = Number.isFinite(carto.height) ? (carto.height as number) : 0;
            const p = Cesium.Cartesian3.fromRadians(
              carto.longitude,
              carto.latitude,
              baseHeight + this.offsetHeight
            );
            return isValidCartesian3(p) ? p : null;
          } catch {
            return null;
          }
        })
        .filter((p): p is Cesium.Cartesian3 => !!p);

      if (elevatedPositions.length < 3) {
        // 兜底：若抬高转换失败，直接使用地面点（仍可完成绘制）
        elevatedPositions.splice(0, elevatedPositions.length, ...safeGroundPositions);
      }

      finalEntity = this.entities.add({
        name: "绘制的多边形区域",
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(elevatedPositions),
          material: new Cesium.ColorMaterialProperty(fillColor),
          outline: false,
          heightReference: Cesium.HeightReference.NONE,
          perPositionHeight: true,
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
      (finalEntity as any)._groundPositions = safeGroundPositions;

      if (finalEntity) {
        (finalEntity as any)._drawOptions = this.drawOptions;
        (finalEntity as any)._drawType = this.getDrawType();
        // 两阶段策略：先以 NONE 方式落地，待地形稳定后再由调度器进行采样/切换
        (finalEntity as any)._pendingTerrainRefine = true;
        if (this.drawOptions?.onClick) {
          (finalEntity as any)._onClick = this.drawOptions.onClick;
        }
        if (finalBorder) {
          (finalEntity as any)._borderEntity = finalBorder;
        }
      }
    } else {
      finalEntity = this.entities.add({
        name: "绘制的多边形区域",
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(safeGroundPositions),
          material: new Cesium.ColorMaterialProperty(fillColor),
          outline: false,
          heightReference: Cesium.HeightReference.NONE,
          perPositionHeight: true,
        },
      });
      // 边框（贴地）
      const closedGround = safeGroundPositions.slice();
      if (closedGround.length >= 2) closedGround.push(safeGroundPositions[0]);
      finalBorder = this.entities.add({
        polyline: {
          positions: closedGround,
          width: strokeWidth,
          material: new Cesium.ColorMaterialProperty(strokeColor),
          // 非 3D 模式下 ground polyline 会走 worker/ground pipeline，易触发 DataCloneError/NaN，改为普通折线。
          clampToGround: false,
        },
      });
      (finalEntity as any)._groundPositions = safeGroundPositions;

      if (finalEntity) {
        (finalEntity as any)._drawOptions = this.drawOptions;
        (finalEntity as any)._drawType = this.getDrawType();
        (finalEntity as any)._pendingTerrainRefine = false;
        if (this.drawOptions?.onClick) {
          (finalEntity as any)._onClick = this.drawOptions.onClick;
        }
        if (finalBorder) {
          (finalEntity as any)._borderEntity = finalBorder;
        }
      }
    }

    // 添加面积标签（可通过 showAreaLabel 关闭）
    const area = calculatePolygonArea(safeGroundPositions, this.scene.globe.ellipsoid);
    if (area > 0 && this.drawOptions?.showAreaLabel !== false) {
      const center = calculatePolygonCenter(safeGroundPositions);
      let centerCarto: Cesium.Cartographic | null = null;
      try {
        centerCarto = Cesium.Cartographic.fromCartesian(center);
      } catch {
        centerCarto = null;
      }
      if (!centerCarto || !Number.isFinite(centerCarto.longitude) || !Number.isFinite(centerCarto.latitude)) {
        // center 可能落在椭球内部或接近原点，cartesianToCartographic 会失败；跳过面积 label
        this.restoreRequestRenderModeIfNeeded();
        // 不直接 return：主体实体已创建
      } else {
        const groundCenter = Cesium.Cartesian3.fromRadians(
          centerCarto.longitude,
          centerCarto.latitude,
          Number.isFinite(centerCarto.height) ? (centerCarto.height as number) : 0
        );

        if (!isValidCartesian3(groundCenter)) {
          this.restoreRequestRenderModeIfNeeded();
        } else {

          let displayCenter = groundCenter;
          if (this.offsetHeight > 0) {
            const elevated = Cesium.Cartesian3.fromRadians(
              centerCarto.longitude,
              centerCarto.latitude,
              (Number.isFinite(centerCarto.height) ? (centerCarto.height as number) : 0) + this.offsetHeight
            );
            if (isValidCartesian3(elevated)) {
              displayCenter = elevated;
            }
          }

          const areaText = i18n.t('draw.label.area', { value: formatArea(area) });
          const areaImage = this.createTotalLengthBillboardImage(areaText);

          const areaLabelEntity = this.entities.add({
            position: displayCenter,
            billboard: {
              image: areaImage,
              pixelOffset: new Cesium.ConstantProperty(new Cesium.Cartesian2(0, -25)),
              // 两阶段策略：先用 NONE，避免 TerrainOffsetProperty 在临界时刻产生 NaN；
              // 地形稳定后由 DrawHelper 进行采样并可切换为 RELATIVE_TO_GROUND。
              heightReference: new Cesium.ConstantProperty(Cesium.HeightReference.NONE),
              verticalOrigin: new Cesium.ConstantProperty(Cesium.VerticalOrigin.BOTTOM),
              horizontalOrigin: new Cesium.ConstantProperty(Cesium.HorizontalOrigin.CENTER),
              scale: new Cesium.ConstantProperty(1.0),
              disableDepthTestDistance: new Cesium.ConstantProperty(Number.POSITIVE_INFINITY),
            },
          });
          (areaLabelEntity as any)._groundPosition = groundCenter;
          (areaLabelEntity as any)._preferRelativeToGround = this.offsetHeight > 0;
          (areaLabelEntity as any)._pendingTerrainRefine = this.offsetHeight > 0;
          // 关联到主实体，便于外部删除时同步移除
          (areaLabelEntity as any)._ownerEntityId = (finalEntity as any).id;
          const drawEntity = finalEntity as DrawEntity;
          drawEntity._labelEntities = [...(drawEntity._labelEntities || []), areaLabelEntity];
          this.tempLabelEntities.push(areaLabelEntity);
        }
      }
    }

    // 结束绘制后移除所有红色点实体（不保留）
    this.tempEntities.forEach((entity) => {
      if (entity) {
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
      positions: safeGroundPositions,
      areaKm2: calculatePolygonArea(safeGroundPositions, this.scene.globe.ellipsoid),
    };

    if (this.callbacks.onMeasureComplete) {
      this.callbacks.onMeasureComplete(result);
    }

    // 恢复 requestRenderMode（如果需要）
    this.restoreRequestRenderModeIfNeeded();

    if (this.callbacks.onDrawEnd) {
      // 将完整的 DrawResult 作为第二个参数传递给 onDrawEnd 回调
      this.callbacks.onDrawEnd(finalEntity, result);
    }

    return result;
  }

  /**
   * 清理所有绘制相关的实体
   */
  public clear(): void {
    // 清理多边形实体
    if (this.currentPolygonEntity) {
      this.entities.remove(this.currentPolygonEntity);
      const index = this.tempEntities.indexOf(this.currentPolygonEntity);
      if (index > -1) {
        this.tempEntities.splice(index, 1);
      }
      this.currentPolygonEntity = null;
    }

    // 清理边框实体
    if (this.currentBorderEntity) {
      this.entities.remove(this.currentBorderEntity);
      const index = this.tempEntities.indexOf(this.currentBorderEntity);
      if (index > -1) {
        this.tempEntities.splice(index, 1);
      }
      this.currentBorderEntity = null;
    }
  }

  /**
   * 获取绘制类型
   */
  public getDrawType(): "line" | "polygon" | "rectangle" | "circle" {
    return "polygon";
  }

  // 增强点击事件的防御逻辑
  public addPoint(position: Cartesian3): void {
    if (!isValidCartesian3(position)) {
      console.error("[DrawPolygon] Invalid Cartesian3 position detected:", position);
      return; // 中断流程，避免无效点导致后续错误
    }

    // 关键：交给 BaseDraw.addPoint 统一处理（clone/cartographic 校验/创建红点实体/偏移高度等）
    super.addPoint(position);

    // 追加点后刷新预览
    this.updateDrawingEntity();
  }
}

