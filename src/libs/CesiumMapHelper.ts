import * as Cesium from "cesium";
import type { Primitive } from "cesium";
/**
 * Cesium 绘图辅助工具类
 * 支持绘制点、线、多边形、矩形，并提供编辑和删除功能
 * 适用于 Cesium 1.132.0
 */
class DrawHelper {
  private viewer: Cesium.Viewer;
  private scene: Cesium.Scene;
  private entities: Cesium.EntityCollection;
  private frustumPrimitives: Primitive[] = [];

  // 绘图状态和数据
  private drawMode: "line" | "polygon" | "rectangle" | null = null;
  private isDrawing: boolean = false;
  private tempPositions: Cesium.Cartesian3[] = [];
  private tempEntities: Cesium.Entity[] = []; // 临时实体，用于绘制过程中
  private tempLabelEntities: Cesium.Entity[] = []; // 临时标签实体
  private finishedEntities: Cesium.Entity[] = []; // 已完成的实体
  private finishedLabelEntities: Cesium.Entity[] = []; // 已完成的标签实体
  private finishedPointEntities: Cesium.Entity[] = []; // 已完成的点实体
  private publicEntities: Cesium.Entity[] = []; // 通过公共方法创建的实体
  private _doubleClickPending: boolean = false; // 双击判断
  private currentLineEntity: Cesium.Entity | null = null; // 当前正在绘制的线条实体（用于复用）
  private currentPolygonEntity: Cesium.Entity | null = null; // 当前正在绘制的多边形实体
  private currentRectangleEntity: Cesium.Entity | null = null; // 当前正在绘制的矩形实体
  private currentSegmentLabels: Cesium.Entity[] = []; // 当前分段标签实体数组（用于复用）
  private currentTotalLabel: Cesium.Entity | null = null; // 当前总距离标签实体（用于复用）
  // 事件处理器
  private screenSpaceEventHandler: Cesium.ScreenSpaceEventHandler | null = null;
  // 回调函数
  private onDrawStartCallback: (() => void) | null = null;
  private onDrawEndCallback: ((entity: Cesium.Entity | null) => void) | null =
    null;
  private onEntityRemovedCallback: ((entity: Cesium.Entity) => void) | null =
    null;
  private offsetHeight: number = 2;

  /**
   * 构造函数
   * @param viewer Cesium Viewer 实例
   */
  constructor(viewer: Cesium.Viewer) {
    if (!viewer || !(viewer instanceof Cesium.Viewer)) {
      throw new Error("Invalid Cesium Viewer instance provided.");
    }
    this.viewer = viewer;
    this.scene = viewer.scene;
    this.entities = viewer.entities;

    // 根据地图模式设置偏移高度
    this.updateOffsetHeight();
    
    // 监听场景模式变化
    this.scene.morphComplete.addEventListener(() => {
      const oldOffsetHeight = this.offsetHeight;
      this.updateOffsetHeight();
      // 如果偏移高度发生变化，更新所有已完成实体
      if (oldOffsetHeight !== this.offsetHeight) {
        this.updateFinishedEntitiesForModeChange();
      }
    });

    // 确保启用地形深度测试以获得正确的高度
    this.scene.globe.depthTestAgainstTerrain = true;
  }

  /**
   * 根据场景模式更新偏移高度
   */
  private updateOffsetHeight(): void {
    if (this.scene.mode === Cesium.SceneMode.SCENE3D) {
      this.offsetHeight = 100; // 3D模式使用100米偏移，所有元素都浮动
    } else {
      this.offsetHeight = 0; // 2D模式使用0米偏移，所有元素都贴近地面
    }
  }

  /**
   * 开始绘制线条
   */
  startDrawingLine(): void {
    this.startDrawing("line");
  }

  /**
   * 开始绘制多边形（仅边线）
   */
  startDrawingPolygon(): void {
    this.startDrawing("polygon");
  }

  /**
   * 开始绘制矩形
   */
  startDrawingRectangle(): void {
    this.startDrawing("rectangle");
  }

  /**
   * 内部统一的开始绘制方法
   * @param mode 绘制模式
   */
  private startDrawing(mode: "line" | "polygon" | "rectangle"): void {
    this.endDrawingInternal(false); // 结束任何正在进行的绘制，但不清空已完成的实体

    this.drawMode = mode;
    this.isDrawing = true;
    this.tempPositions = [];
    this.tempEntities = [];
    this._doubleClickPending = false; // 重置双击标志，确保第一次点击能正常响应
    
    // 重置实体复用变量
    this.currentLineEntity = null;
    this.currentPolygonEntity = null;
    this.currentRectangleEntity = null;
    this.currentSegmentLabels = [];
    this.currentTotalLabel = null;

    this.activateDrawingHandlers();

    // 触发开始绘制回调
    if (this.onDrawStartCallback) {
      this.onDrawStartCallback();
    }
  }

  /**
   * 激活屏幕空间事件处理器
   */
  private activateDrawingHandlers(): void {
    this.deactivateDrawingHandlers(); // 确保之前的手柄已销毁

    this.screenSpaceEventHandler = new Cesium.ScreenSpaceEventHandler(
      this.scene.canvas
    );

    // 左键点击添加点
    this.screenSpaceEventHandler.setInputAction(
      (click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        if (!this.isDrawing) return;
        if (this._doubleClickPending) {
          this._doubleClickPending = false;
          return;
        }
        const cartesian = this.pickGlobePosition(click.position);
        if (cartesian) {
          this.addPoint(cartesian);
        }
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    );

    // 右键删除最后一个点
    this.screenSpaceEventHandler.setInputAction(() => {
      if (!this.isDrawing || this.tempPositions.length === 0) return;
      this.removeLastPoint();
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    // 鼠标移动更新预览
    this.screenSpaceEventHandler.setInputAction(
      (move: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
        if (!this.isDrawing || this.tempPositions.length === 0) return;
        const cartesian = this.pickGlobePosition(move.endPosition);
        if (cartesian) {
          this.updatePreview(cartesian);
        }
      },
      Cesium.ScreenSpaceEventType.MOUSE_MOVE
    );

    // 双击结束绘制
    const mapDoubleClickAct =
      this.viewer.cesiumWidget.screenSpaceEventHandler.getInputAction(
        Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
      );
    this.viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );
    this.screenSpaceEventHandler.setInputAction(
      (dblClick: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        if (!this.isDrawing) return;
        this._doubleClickPending = true;
        this.finishDrawing();
        // 恢复 Cesium 默认的双击行为（如果存在的话）
        if (mapDoubleClickAct) {
          this.viewer.cesiumWidget.screenSpaceEventHandler.setInputAction(
            mapDoubleClickAct,
            Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
          );
        }
      },
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );
  }

  /**
   * 拾取地形或椭球体上的位置
   * @param windowPosition 屏幕坐标
   * @returns 世界坐标 Cartesian3 或 null
   */
  private pickGlobePosition(
    windowPosition: Cesium.Cartesian2
  ): Cesium.Cartesian3 | null {
    // 首先尝试从地形拾取
    const ray = this.viewer.camera.getPickRay(windowPosition);
    if (ray) {
      const position = this.scene.globe.pick(ray, this.scene);
      if (Cesium.defined(position)) {
        return position;
      }
    }
    // 如果地形拾取失败，回退到椭球体拾取
    const ellipsoidPosition = this.viewer.camera.pickEllipsoid(
      windowPosition,
      this.scene.globe.ellipsoid
    );
    return ellipsoidPosition ?? null;
  }

  /**
   * 添加一个点到临时位置数组并创建点实体
   * @param position 世界坐标
   */
  private addPoint(position: Cesium.Cartesian3): void {
    this.tempPositions.push(position.clone());

    // 根据2D/3D模式设置点的高度
    const carto = Cesium.Cartographic.fromCartesian(position);
    const elevatedPosition = Cesium.Cartesian3.fromRadians(
      carto.longitude,
      carto.latitude,
      (carto.height || 0) + (this.drawMode !== "line" ? 0 : this.offsetHeight)
    );

    const pointEntity = this.entities.add({
      position: elevatedPosition,
      point: {
        pixelSize: 8,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        scaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.0, 1.5e7, 0.5),
      },
    });
    this.tempEntities.push(pointEntity);
    this.updateDrawingEntity();
  }

  /**
   * 删除最后一个添加的点及其相关的临时实体
   */
  private removeLastPoint(): void {
    if (this.tempPositions.length > 0) {
      // 移除最后一个位置
      this.tempPositions.pop();

      // 移除所有临时实体（包括点实体和线/面实体）
      this.tempEntities.forEach((entity) => {
        if (entity) {
          this.entities.remove(entity);
        }
      });
      this.tempEntities = [];

      // 移除所有临时标签实体
      this.tempLabelEntities.forEach((entity) => {
        if (entity) {
          this.entities.remove(entity);
        }
      });
      this.tempLabelEntities = [];

      // 重置复用变量
      this.currentLineEntity = null;
      this.currentPolygonEntity = null;
      this.currentRectangleEntity = null;
      this.currentSegmentLabels = [];
      this.currentTotalLabel = null;

      // 重新创建剩余的点实体和绘制实体
      this.recreateRemainingEntities();
    }
  }

  /**
   * 重新创建剩余的点实体和绘制实体
   * 用于右键删除点后的重建
   */
  private recreateRemainingEntities(): void {
    // 重新创建所有剩余的点实体
    this.tempPositions.forEach((position) => {
      const carto = Cesium.Cartographic.fromCartesian(position);
      const elevatedPosition = Cesium.Cartesian3.fromRadians(
        carto.longitude,
        carto.latitude,
        (carto.height || 0) + this.offsetHeight
      );

      const pointEntity = this.entities.add({
        position: elevatedPosition,
        point: {
          pixelSize: 8,
          color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 3,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
          scaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.0, 1.5e7, 0.5),
        },
      });
      this.tempEntities.push(pointEntity);
    });

    // 重新创建绘制实体（线/面）
    this.updateDrawingEntity();
  }

  /**
   * 更新预览线/面
   * @param currentMousePosition 当前鼠标位置世界坐标
   */
  private updatePreview(currentMousePosition: Cesium.Cartesian3): void {
    this.updateDrawingEntity(currentMousePosition);
  }

  /**
   * 核心方法：根据当前点序列更新或创建临时的线/面实体
   * @param previewPoint 可选的预览点，用于显示动态效果
   */
  private updateDrawingEntity(previewPoint?: Cesium.Cartesian3): void {
    const positions = [...this.tempPositions];
    if (previewPoint) {
      positions.push(previewPoint);
    }

    if (positions.length < 2) {
      // 如果点数不足，清理线条和标签实体
      if (this.currentLineEntity) {
        this.entities.remove(this.currentLineEntity);
        const index = this.tempEntities.indexOf(this.currentLineEntity);
        if (index > -1) {
          this.tempEntities.splice(index, 1);
        }
        this.currentLineEntity = null;
      }
      if (this.currentPolygonEntity) {
        this.entities.remove(this.currentPolygonEntity);
        const index = this.tempEntities.indexOf(this.currentPolygonEntity);
        if (index > -1) {
          this.tempEntities.splice(index, 1);
        }
        this.currentPolygonEntity = null;
      }
      if (this.currentRectangleEntity) {
        this.entities.remove(this.currentRectangleEntity);
        const index = this.tempEntities.indexOf(this.currentRectangleEntity);
        if (index > -1) {
          this.tempEntities.splice(index, 1);
        }
        this.currentRectangleEntity = null;
      }
      // 清理分段标签
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
      // 清理总距离标签
      if (this.currentTotalLabel) {
        this.entities.remove(this.currentTotalLabel);
        const index = this.tempLabelEntities.indexOf(this.currentTotalLabel);
        if (index > -1) {
          this.tempLabelEntities.splice(index, 1);
        }
        this.currentTotalLabel = null;
      }
      return;
    }

    let activeEntity: Cesium.Entity | undefined;

    if (this.drawMode === "line") {
      // 计算抬高的位置（如果需要）
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

      // 复用或创建线条实体
      if (this.currentLineEntity) {
        // 更新现有实体的位置
        this.currentLineEntity.polyline!.positions = new Cesium.ConstantProperty(elevatedPositions);
      } else {
        // 创建新的线条实体
        activeEntity = this.entities.add({
          polyline: {
            positions: elevatedPositions,
            width: 5,
            material: Cesium.Color.YELLOW,
            clampToGround: this.offsetHeight === 0,
          },
        });
        this.currentLineEntity = activeEntity;
        this.tempEntities.push(activeEntity);
      }

      // 更新分段标签
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
        
        // 只显示距离大于5米的标签
        if (distance > 5.0) {
          const midPoint = Cesium.Cartesian3.midpoint(
            startPos,
            endPos,
            new Cesium.Cartesian3()
          );
          
          // 计算抬高的中点位置（如果需要）
          let elevatedMidPoint = midPoint;
          if (this.offsetHeight > 0) {
            const carto = Cesium.Cartographic.fromCartesian(midPoint);
            elevatedMidPoint = Cesium.Cartesian3.fromRadians(
              carto.longitude,
              carto.latitude,
              (carto.height || 0) + this.offsetHeight
            );
          }
          
          const labelOffset = i % 2 === 0 ? -25 : 25;
          
          if (i < this.currentSegmentLabels.length) {
            // 更新现有标签
            const labelEntity = this.currentSegmentLabels[i];
            if (labelEntity) {
              labelEntity.position = new Cesium.ConstantPositionProperty(elevatedMidPoint);
              labelEntity.label!.text = new Cesium.ConstantProperty(this.formatDistance(distance));
            }
          } else {
            // 创建新标签
            const labelEntity = this.entities.add({
              position: elevatedMidPoint,
              label: {
                text: this.formatDistance(distance),
                font: "16px Arial",
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(0, labelOffset),
                heightReference: this.offsetHeight > 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND,
                scale: 1.0,
                showBackground: true,
                backgroundColor: Cesium.Color.BLACK.withAlpha(0.8),
                backgroundPadding: new Cesium.Cartesian2(6, 3),
              },
            });
            this.currentSegmentLabels.push(labelEntity);
            this.tempLabelEntities.push(labelEntity);
          }
        } else {
          // 距离太小，移除对应的标签（如果存在）
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
            i--; // 调整索引
          }
        }
      }

      // 更新总距离标签（只基于已确定的点，不包括预览点）
      if (this.tempPositions.length > 1) {
        let totalDistance = 0;
        for (let i = 1; i < this.tempPositions.length; i++) {
          totalDistance += Cesium.Cartesian3.distance(
            this.tempPositions[i - 1],
            this.tempPositions[i]
          );
        }
        
        // 计算标签位置
        let labelPosition = this.tempPositions[this.tempPositions.length - 1];
        if (this.offsetHeight > 0) {
          const carto = Cesium.Cartographic.fromCartesian(labelPosition);
          labelPosition = Cesium.Cartesian3.fromRadians(
            carto.longitude,
            carto.latitude,
            (carto.height || 0) + this.offsetHeight
          );
        }
        
        const formattedDistance = this.formatDistance(totalDistance);
        const labelText = `总长: ${formattedDistance}`;
        const segmentCount = this.tempPositions.length - 1;
        const labelOffset = segmentCount % 2 === 0 ? -35 : 35;
        
        if (this.currentTotalLabel) {
          // 更新现有总距离标签
          this.currentTotalLabel.position = new Cesium.ConstantPositionProperty(labelPosition);
          this.currentTotalLabel.label!.text = new Cesium.ConstantProperty(labelText);
        } else {
          // 创建新的总距离标签
          const totalLabelEntity = this.entities.add({
            position: labelPosition,
            label: {
              text: labelText,
              font: "16px Arial",
              fillColor: Cesium.Color.YELLOW,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(0, labelOffset),
              heightReference: this.offsetHeight > 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND,
              scale: 1.0,
              showBackground: true,
              backgroundColor: Cesium.Color.BLACK.withAlpha(0.8),
              backgroundPadding: new Cesium.Cartesian2(8, 4),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              verticalOrigin: Cesium.VerticalOrigin.CENTER,
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            },
          });
          this.currentTotalLabel = totalLabelEntity;
          this.tempLabelEntities.push(totalLabelEntity);
        }
      } else {
        // 点数不足，移除总距离标签
        if (this.currentTotalLabel) {
          this.entities.remove(this.currentTotalLabel);
          const index = this.tempLabelEntities.indexOf(this.currentTotalLabel);
          if (index > -1) {
            this.tempLabelEntities.splice(index, 1);
          }
          this.currentTotalLabel = null;
        }
      }
    } else if (this.drawMode === "polygon") {
      const committedPositions = [...this.tempPositions];
      const polygonSource =
        previewPoint && this.tempPositions.length >= 2
          ? [...committedPositions, previewPoint]
          : committedPositions;

      if (polygonSource.length >= 3) {
        const polygonPositions =
          this.offsetHeight > 0
            ? polygonSource.map((pos) => {
                const carto = Cesium.Cartographic.fromCartesian(pos);
                return Cesium.Cartesian3.fromRadians(
                  carto.longitude,
                  carto.latitude,
                  (carto.height || 0) + this.offsetHeight
                );
              })
            : polygonSource;
        const heightReference =
          this.offsetHeight > 0
            ? Cesium.HeightReference.NONE
            : Cesium.HeightReference.CLAMP_TO_GROUND;

        if (this.currentPolygonEntity) {
          this.currentPolygonEntity.polygon!.hierarchy =
            new Cesium.ConstantProperty(
              new Cesium.PolygonHierarchy(polygonPositions)
            );
          this.currentPolygonEntity.polygon!.heightReference =
            new Cesium.ConstantProperty(heightReference);
        } else {
          activeEntity = this.entities.add({
            polygon: {
              hierarchy: new Cesium.ConstantProperty(
                new Cesium.PolygonHierarchy(polygonPositions)
              ),
              material: Cesium.Color.LIGHTGREEN.withAlpha(0.3), // 淡绿色填充
              outline: true,
              outlineColor: Cesium.Color.GREEN,
              outlineWidth: 2,
              heightReference,
            },
          });
          this.currentPolygonEntity = activeEntity;
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
    } else if (this.drawMode === "rectangle" && positions.length >= 2) {
      const rect = this.calculateRectangle(positions[0], positions[1]);
      const rectHeightReference =
        this.offsetHeight > 0
          ? Cesium.HeightReference.NONE
          : Cesium.HeightReference.CLAMP_TO_GROUND;

      if (this.currentRectangleEntity) {
        this.currentRectangleEntity.rectangle!.coordinates =
          new Cesium.ConstantProperty(rect);
        this.currentRectangleEntity.rectangle!.heightReference =
          new Cesium.ConstantProperty(rectHeightReference);
        this.currentRectangleEntity.rectangle!.extrudedHeight =
          this.offsetHeight > 0
            ? new Cesium.ConstantProperty(this.offsetHeight)
            : undefined;
      } else {
        activeEntity = this.entities.add({
          rectangle: {
            coordinates: rect,
            material: Cesium.Color.GREEN.withAlpha(0.5),
            heightReference: rectHeightReference,
            extrudedHeight:
              this.offsetHeight > 0 ? this.offsetHeight : undefined,
          },
        });
        this.currentRectangleEntity = activeEntity;
      }
    }

    if (activeEntity) {
      this.tempEntities.push(activeEntity);
    }
  }

  /**
   * 完成当前绘制操作
   */
  private finishDrawing(): void {
    if (this.tempPositions.length < (this.drawMode === "rectangle" ? 2 : 2)) {
      // 点数不足，取消绘制
      this.endDrawingInternal(true);
      return;
    }
    let finalEntity: Cesium.Entity | null = null;
    // 保存原始地面位置（不包含offsetHeight）
    const groundPositions = this.tempPositions.map((p) => {
      const carto = Cesium.Cartographic.fromCartesian(p);
      return Cesium.Cartesian3.fromRadians(
        carto.longitude,
        carto.latitude,
        carto.height || 0
      );
    });

    if (this.drawMode === "line") {
      // 根据2D/3D模式创建最终线条
      if (this.offsetHeight > 0) {
        // 3D模式：使用抬高的位置
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
            width: 5,
            material: Cesium.Color.YELLOW,
            clampToGround: false,
          },
        });
        // 保存原始地面位置
        (finalEntity as any)._groundPositions = groundPositions;
      } else {
        // 2D模式：贴近地面
        finalEntity = this.entities.add({
          name: "绘制的线",
          polyline: {
            positions: groundPositions,
            width: 5,
            material: Cesium.Color.YELLOW,
            clampToGround: true,
          },
        });
        // 保存原始地面位置
        (finalEntity as any)._groundPositions = groundPositions;
      }

      // 标签已经在 updateDrawingEntity 中创建，这里不需要重复创建
    } else if (this.drawMode === "polygon") {
      // 根据2D/3D模式绘制最终多边形区域
      if (this.offsetHeight > 0) {
        // 3D模式：使用抬高的位置
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
            material: Cesium.Color.LIGHTGREEN.withAlpha(0.3), // 淡绿色填充
            outline: true,
            outlineColor: Cesium.Color.GREEN,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.NONE,
          },
        });
        // 保存原始地面位置
        (finalEntity as any)._groundPositions = groundPositions;
      } else {
        // 2D模式：贴近地面
        finalEntity = this.entities.add({
          name: "绘制的多边形区域",
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(groundPositions),
            material: Cesium.Color.LIGHTGREEN.withAlpha(0.3), // 淡绿色填充
            outline: true,
            outlineColor: Cesium.Color.GREEN,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
        // 保存原始地面位置
        (finalEntity as any)._groundPositions = groundPositions;
      }
      // 添加面积标签
      const area = this.calculatePolygonArea(groundPositions);
      if (area > 0) {
        const center = this.calculatePolygonCenter(groundPositions);
        const areaLabelEntity = this.entities.add({
          position: center,
          label: {
            text: `面积: ${this.formatArea(area)}`,
            font: "14px sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -20),
            heightReference: this.offsetHeight > 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
        // 保存原始地面位置
        (areaLabelEntity as any)._groundPosition = center;
        this.finishedLabelEntities.push(areaLabelEntity);
      }
    } else if (this.drawMode === "rectangle" && groundPositions.length >= 2) {
      const rect = this.calculateRectangle(groundPositions[0], groundPositions[1]);
      if (this.offsetHeight > 0) {
        // 3D模式：使用挤压高度
        finalEntity = this.entities.add({
          name: "绘制的矩形",
          rectangle: {
            coordinates: rect,
            material: Cesium.Color.GREEN.withAlpha(0.5),
            heightReference: Cesium.HeightReference.NONE,
            extrudedHeight: this.offsetHeight,
          },
        });
        // 保存原始矩形坐标
        (finalEntity as any)._groundRectangle = rect;
      } else {
        // 2D模式：贴近地面
        finalEntity = this.entities.add({
          name: "绘制的矩形",
          rectangle: {
            coordinates: rect,
            material: Cesium.Color.GREEN.withAlpha(0.5),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
        // 保存原始矩形坐标
        (finalEntity as any)._groundRectangle = rect;
      }
      // 添加面积标签
      const area = this.calculateRectangleArea(rect);
      if (area > 0) {
        const rectCenter = Cesium.Rectangle.center(rect);
        const rectCenterPosition = Cesium.Cartesian3.fromRadians(
          rectCenter.longitude,
          rectCenter.latitude,
          0
        );
        const rectAreaLabelEntity = this.entities.add({
          position: rectCenterPosition,
          label: {
            text: `面积: ${this.formatArea(area)}`,
            font: "14px sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -20),
            heightReference: this.offsetHeight > 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
        // 保存原始地面位置
        (rectAreaLabelEntity as any)._groundPosition = rectCenterPosition;
        this.finishedLabelEntities.push(rectAreaLabelEntity);
      }
    }

    // 将完成的实体存入列表
    if (finalEntity) {
      this.finishedEntities.push(finalEntity);
    }

    // 将临时标签实体转移到已完成标签实体数组中
    this.tempLabelEntities.forEach((entity) => {
      this.finishedLabelEntities.push(entity);
    });
    this.tempLabelEntities = [];

    // 将临时点实体转移到已完成点实体数组中
    this.tempEntities.forEach((entity) => {
      if (entity && entity.point) {
        this.finishedPointEntities.push(entity);
      } else {
        // 非点实体直接移除
        this.entities.remove(entity);
      }
    });
    this.tempEntities = [];
    this.tempPositions = [];
    
    // 重置复用变量
    this.currentLineEntity = null;
    this.currentPolygonEntity = null;
    this.currentRectangleEntity = null;
    this.currentSegmentLabels = [];
    this.currentTotalLabel = null;

    if (true) { // resetMode
      this.drawMode = null;
      this.isDrawing = false;
      this.deactivateDrawingHandlers();
    }

    // 触发结束绘制回调
    if (this.onDrawEndCallback) {
      this.onDrawEndCallback(finalEntity);
    }
  }

  /**
   * 内部方法：重置绘图状态和清理临时数据
   * @param resetMode 是否重置绘图模式和状态标志
   */
  private endDrawingInternal(resetMode: boolean): void {
    // 清理临时实体
    this.tempEntities.forEach((entity) => {
      this.entities.remove(entity);
    });
    this.tempEntities = [];
    this.tempPositions = [];
    // 清理临时标签实体
    this.tempLabelEntities.forEach((entity) => {
      this.entities.remove(entity);
    });
    this.tempLabelEntities = [];
    
    // 重置复用变量
    this.currentLineEntity = null;
    this.currentSegmentLabels = [];
    this.currentTotalLabel = null;

    if (resetMode) {
      this.drawMode = null;
      this.isDrawing = false;
      this.deactivateDrawingHandlers();
    }
  }

  /**
   * 公共方法：结束当前绘制（如果正在进行）
   */
  endDrawing(): void {
    if (this.isDrawing) {
      this.finishDrawing();
    } else {
      // 如果没有在绘制，也执行一次清理
      this.endDrawingInternal(true);
    }
  }

  /**
   * 销毁事件处理器
   */
  private deactivateDrawingHandlers(): void {
    if (this.screenSpaceEventHandler) {
      this.screenSpaceEventHandler.destroy();
      this.screenSpaceEventHandler = null;
    }
  }

  /**
   * 清除所有已绘制的实体
   */
  clearAll(): void {
    // 先结束可能的绘制
    this.endDrawing();
    
    // 强制清除所有点实体
    this.clearAllPoints();
    
    // 清除所有已完成的实体
    this.finishedEntities.forEach((entity) => {
      this.entities.remove(entity);
    });
    this.finishedEntities = [];
    
    // 清除所有已完成的标签实体
    this.finishedLabelEntities.forEach((entity) => {
      if (entity) {
        this.entities.remove(entity);
      }
    });
    this.finishedLabelEntities = [];
    
    // 清除所有通过公共方法创建的实体
    this.publicEntities.forEach((entity) => {
      if (entity) {
        this.entities.remove(entity);
      }
    });
    this.publicEntities = [];
    
    // 清理临时实体（包括绘制过程中的点实体）
    this.tempEntities.forEach((entity) => {
      if (entity) {
        this.entities.remove(entity);
      }
    });
    this.tempEntities = [];
    
    // 清理临时标签实体
    this.tempLabelEntities.forEach((entity) => {
      if (entity && entity.label) {
        this.entities.remove(entity);
      }
    });
    this.tempLabelEntities = [];
    
    // 确保清理所有可能残留的实体
    this.tempPositions = [];
  }

  /**
   * 清除所有实体（包括未跟踪的实体）
   * 这是一个更彻底的清理方法，会清除场景中的所有实体
   */
  clearAllEntities(): void {
    // 先结束可能的绘制
    this.endDrawing();
    // 清除场景中的所有实体
    this.entities.removeAll();
    // 重置所有跟踪数组
    this.finishedEntities = [];
    this.finishedLabelEntities = [];
    this.finishedPointEntities = [];
    this.publicEntities = [];
    this.tempEntities = [];
    this.tempLabelEntities = [];
    this.tempPositions = [];
  }

  /**
   * 强制清除所有点实体
   * 用于解决点实体无法删除的问题
   */
  clearAllPoints(): void {
    // 清除所有已完成的点实体
    this.finishedPointEntities.forEach((entity) => {
      if (entity) {
        this.entities.remove(entity);
      }
    });
    this.finishedPointEntities = [];
    
    // 清除临时点实体
    this.tempEntities.forEach((entity) => {
      if (entity && entity.point) {
        this.entities.remove(entity);
      }
    });
    
    // 清除所有可能的点实体（通过实体名称查找）
    const allEntities = this.entities.values;
    for (let i = allEntities.length - 1; i >= 0; i--) {
      const entity = allEntities[i];
      if (entity && entity.point) {
        this.entities.remove(entity);
      }
    }
  }

  /**
   * 删除一个指定的已完成实体
   * @param entity 要删除的实体
   */
  removeEntity(entity: Cesium.Entity): void {
    const index = this.finishedEntities.indexOf(entity);
    if (index > -1) {
      this.entities.remove(entity);
      this.finishedEntities.splice(index, 1);
      if (this.onEntityRemovedCallback) {
        this.onEntityRemovedCallback(entity);
      }
    }
  }

  /**
   * 获取所有已完成的实体
   * @returns 实体数组
   */
  getFinishedEntities(): Cesium.Entity[] {
    return [...this.finishedEntities];
  }

  // --- 辅助计算函数 ---
  private calculateRectangle(
    p1: Cesium.Cartesian3,
    p2: Cesium.Cartesian3
  ): Cesium.Rectangle {
    const cartographic1 = Cesium.Cartographic.fromCartesian(p1);
    const cartographic2 = Cesium.Cartographic.fromCartesian(p2);
    const west = Math.min(cartographic1.longitude, cartographic2.longitude);
    const east = Math.max(cartographic1.longitude, cartographic2.longitude);
    const south = Math.min(cartographic1.latitude, cartographic2.latitude);
    const north = Math.max(cartographic1.latitude, cartographic2.latitude);
    return new Cesium.Rectangle(west, south, east, north);
  }

  private calculateRectangleArea(rect: Cesium.Rectangle): number {
    const west = rect.west;
    const south = rect.south;
    const east = rect.east;
    const north = rect.north;

    const width = Cesium.Cartesian3.distance(
      Cesium.Cartesian3.fromRadians(west, south),
      Cesium.Cartesian3.fromRadians(east, south)
    );
    const height = Cesium.Cartesian3.distance(
      Cesium.Cartesian3.fromRadians(west, south),
      Cesium.Cartesian3.fromRadians(west, north)
    );

    return (width * height) / 1e6; // 转换为平方公里
  }

  private calculatePolygonArea(positions: Cesium.Cartesian3[]): number {
    if (positions.length < 3) return 0;
    const ellipsoid = this.scene.globe.ellipsoid;
    let area = 0;
    const len = positions.length;
    for (let i = 0; i < len; i++) {
      const p1 = ellipsoid.cartesianToCartographic(positions[i]);
      const p2 = ellipsoid.cartesianToCartographic(positions[(i + 1) % len]);
      area +=
        (p2.longitude - p1.longitude) *
        (2 + Math.sin(p1.latitude) + Math.sin(p2.latitude));
    }
    area = Math.abs((area * 6378137.0 * 6378137.0) / 2.0); // WGS84半径
    return area / 1e6; // 转换为平方公里
  }

  private calculatePolygonCenter(
    positions: Cesium.Cartesian3[]
  ): Cesium.Cartesian3 {
    if (positions.length === 0) return Cesium.Cartesian3.ZERO;
    let x = 0,
      y = 0,
      z = 0;
    for (let i = 0; i < positions.length; i++) {
      x += positions[i].x;
      y += positions[i].y;
      z += positions[i].z;
    }
    return new Cesium.Cartesian3(
      x / positions.length,
      y / positions.length,
      z / positions.length
    );
  }

  /**
   * 格式化距离显示
   * 超过1000m时转换为km，保留两位小数
   * @param distance 距离（米）
   * @returns 格式化后的距离字符串
   */
  private formatDistance(distance: number): string {
    // 确保距离是有效数字
    if (!isFinite(distance) || isNaN(distance)) {
      return '0.00 m';
    }
    if (distance >= 1000) {
      const km = distance / 1000;
      return `${km.toFixed(2)} km`;
    } else {
      return `${distance.toFixed(2)} m`;
    }
  }

  /**
   * 格式化面积显示
   * @param areaKm2 面积（平方公里）
   */
  private formatArea(areaKm2: number): string {
    if (!isFinite(areaKm2) || isNaN(areaKm2)) {
      return "0.00 m²";
    }
    if (areaKm2 >= 1) {
      return `${areaKm2.toFixed(2)} km²`;
    }
    const areaM2 = areaKm2 * 1e6;
    return `${areaM2.toFixed(2)} m²`;
  }

  // --- 回调注册 ---

  /**
   * 设置开始绘制时的回调函数
   * @param callback 回调函数
   */
  onDrawStart(callback: () => void): void {
    this.onDrawStartCallback = callback;
  }

  /**
   * 设置结束绘制时的回调函数
   * @param callback 回调函数，参数为完成的实体或null
   */
  onDrawEnd(callback: (entity: Cesium.Entity | null) => void): void {
    this.onDrawEndCallback = callback;
  }

  /**
   * 设置实体被移除时的回调函数
   * @param callback 回调函数，参数为被移除的实体
   */
  onEntityRemoved(callback: (entity: Cesium.Entity) => void): void {
    this.onEntityRemovedCallback = callback;
  }

  /**
   * 绘制监控圆形区域
   * @param longitude 经度
   * @param latitude 纬度
   * @param height 高度
   * @param radius 监控范围半径（米）
   * @param options 可选配置
   */
  public drawMonitoringCircle(
    longitude: number,
    latitude: number,
    height: number,
    radius: number,
    options?: {
      borderColor?: string;
      fillColor?: string;
      borderWidth?: number;
      name?: string;
    }
  ): Cesium.Entity {
    const borderColor = options?.borderColor || "#0062FF";
    const fillColor = options?.fillColor || "#0062FF";
    const borderWidth = options?.borderWidth || 2;
    const name = options?.name || "监控区域";

    // 创建圆形区域
    const entity = this.entities.add({
      name: name,
      position: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
      ellipse: {
        semiMajorAxis: radius,
        semiMinorAxis: radius,
        material: Cesium.Color.fromCssColorString(fillColor).withAlpha(0.27),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString(borderColor),
        outlineWidth: borderWidth,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });

    // 将实体添加到跟踪数组中
    this.publicEntities.push(entity);

    return entity;
  }

  /**
   * 绘制垂直线条
   * @param longitude 经度
   * @param latitude 纬度
   * @param height 高度
   * @param options 可选配置
   */
  public drawVerticalLine(
    longitude: number,
    latitude: number,
    height: number,
    options?: {
      color?: string;
      width?: number;
      dashPattern?: number;
      name?: string;
      groundHeight?: number;
    }
  ): Cesium.Entity {
    const color = options?.color || "#0062FF";
    const width = options?.width || 2;
    const dashPattern = options?.dashPattern || 0x00ff00ff;
    const name = options?.name || "垂直线条";
    const groundHeight = options?.groundHeight || 0;

    // 计算地面位置
    const groundPosition = Cesium.Cartesian3.fromDegrees(
      longitude,
      latitude,
      groundHeight
    );
    const topPosition = Cesium.Cartesian3.fromDegrees(
      longitude,
      latitude,
      height
    );

    // 创建垂直线条
    const entity = this.entities.add({
      name: name,
      polyline: {
        positions: [groundPosition, topPosition],
        width: width,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString(color),
        }),
        clampToGround: false,
      },
    });

    // 将实体添加到跟踪数组中
    this.publicEntities.push(entity);

    return entity;
  }

  /**
   * 更新所有已完成实体以适应场景模式变化
   * 当从2D切换到3D或从3D切换到2D时，需要更新实体的高度参考和位置
   */
  private updateFinishedEntitiesForModeChange(): void {
    const is3DMode = this.offsetHeight > 0;
    
    // 更新已完成的主要实体（线、多边形、矩形）
    this.finishedEntities.forEach((entity) => {
      if (!entity) return;
      
      if (entity.polyline) {
        // 更新线条：使用保存的原始地面位置
        const groundPositions = (entity as any)._groundPositions as Cesium.Cartesian3[] | undefined;
        if (groundPositions && groundPositions.length > 0) {
          if (is3DMode) {
            // 切换到3D模式：抬高位置，取消贴地
            const elevatedPositions = groundPositions.map(pos => {
              const carto = Cesium.Cartographic.fromCartesian(pos);
              return Cesium.Cartesian3.fromRadians(
                carto.longitude,
                carto.latitude,
                (carto.height || 0) + this.offsetHeight
              );
            });
            entity.polyline.positions = new Cesium.ConstantProperty(elevatedPositions);
            entity.polyline.clampToGround = new Cesium.ConstantProperty(false);
          } else {
            // 切换到2D模式：使用原始地面位置，贴地
            entity.polyline.positions = new Cesium.ConstantProperty(groundPositions);
            entity.polyline.clampToGround = new Cesium.ConstantProperty(true);
          }
        }
      } else if (entity.polygon) {
        // 更新多边形：使用保存的原始地面位置
        const groundPositions = (entity as any)._groundPositions as Cesium.Cartesian3[] | undefined;
        if (groundPositions && groundPositions.length > 0) {
          if (is3DMode) {
            // 切换到3D模式：抬高位置
            const elevatedPositions = groundPositions.map(pos => {
              const carto = Cesium.Cartographic.fromCartesian(pos);
              return Cesium.Cartesian3.fromRadians(
                carto.longitude,
                carto.latitude,
                (carto.height || 0) + this.offsetHeight
              );
            });
            entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(elevatedPositions));
            entity.polygon.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
          } else {
            // 切换到2D模式：使用原始地面位置，贴地
            entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(groundPositions));
            entity.polygon.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.CLAMP_TO_GROUND);
          }
        }
      } else if (entity.rectangle) {
        // 更新矩形：使用保存的原始矩形坐标
        const groundRectangle = (entity as any)._groundRectangle as Cesium.Rectangle | undefined;
        if (groundRectangle) {
          if (is3DMode) {
            entity.rectangle.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
            entity.rectangle.extrudedHeight = new Cesium.ConstantProperty(this.offsetHeight);
          } else {
            entity.rectangle.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.CLAMP_TO_GROUND);
            entity.rectangle.extrudedHeight = undefined;
          }
        }
      }
    });
    
    // 更新标签实体
    this.finishedLabelEntities.forEach((entity) => {
      if (!entity || !entity.label) return;
      
      // 使用保存的原始地面位置
      const groundPosition = (entity as any)._groundPosition as Cesium.Cartesian3 | undefined;
      if (groundPosition) {
        if (is3DMode) {
          // 切换到3D模式：抬高标签位置
          const carto = Cesium.Cartographic.fromCartesian(groundPosition);
          const elevatedPosition = Cesium.Cartesian3.fromRadians(
            carto.longitude,
            carto.latitude,
            (carto.height || 0) + this.offsetHeight
          );
          entity.position = new Cesium.ConstantPositionProperty(elevatedPosition);
          entity.label.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.RELATIVE_TO_GROUND);
        } else {
          // 切换到2D模式：使用原始地面位置，贴地
          entity.position = new Cesium.ConstantPositionProperty(groundPosition);
          entity.label.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.CLAMP_TO_GROUND);
        }
      }
    });
    
    // 更新点实体（点实体在绘制过程中创建，需要从当前位置推断原始位置）
    this.finishedPointEntities.forEach((entity) => {
      if (!entity || !entity.point) return;
      
      const position = entity.position?.getValue(Cesium.JulianDate.now()) as Cesium.Cartesian3;
      if (position) {
        const carto = Cesium.Cartographic.fromCartesian(position);
        // 尝试从保存的原始位置获取，如果没有则从当前位置推断
        const groundPosition = (entity as any)._groundPosition;
        if (groundPosition) {
          if (is3DMode) {
            const carto = Cesium.Cartographic.fromCartesian(groundPosition);
            const elevatedPosition = Cesium.Cartesian3.fromRadians(
              carto.longitude,
              carto.latitude,
              (carto.height || 0) + this.offsetHeight
            );
            entity.position = new Cesium.ConstantPositionProperty(elevatedPosition);
            entity.point.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.RELATIVE_TO_GROUND);
          } else {
            entity.position = new Cesium.ConstantPositionProperty(groundPosition);
            entity.point.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.CLAMP_TO_GROUND);
          }
        } else {
          // 如果没有保存的原始位置，从当前位置推断（兼容旧数据）
          if (is3DMode) {
            const elevatedPosition = Cesium.Cartesian3.fromRadians(
              carto.longitude,
              carto.latitude,
              Math.max(0, (carto.height || 0) - this.offsetHeight) + this.offsetHeight
            );
            entity.position = new Cesium.ConstantPositionProperty(elevatedPosition);
            entity.point.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.RELATIVE_TO_GROUND);
          } else {
            const groundPos = Cesium.Cartesian3.fromRadians(
              carto.longitude,
              carto.latitude,
              Math.max(0, (carto.height || 0) - this.offsetHeight)
            );
            entity.position = new Cesium.ConstantPositionProperty(groundPos);
            entity.point.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.CLAMP_TO_GROUND);
          }
        }
      }
    });
  }

  /**
   * 销毁工具，清理所有事件监听器
   */
  destroy(): void {
    this.deactivateDrawingHandlers();
    // 可以选择不清除实体，由用户决定
    // this.clearAll();
  }
}

// 为了在 HTML 中通过 <script type="module"> 或打包工具使用
// @ts-ignore
window.DrawHelper = DrawHelper;

export default DrawHelper;
