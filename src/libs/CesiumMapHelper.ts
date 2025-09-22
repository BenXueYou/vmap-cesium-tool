import * as Cesium from "cesium";
import type { Primitive } from "cesium";
import type { FrustumOptions } from "./CesiumMapModel";
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
  private finishedEntities: Cesium.Entity[] = []; // 已完成的实体

  // 事件处理器
  private screenSpaceEventHandler: Cesium.ScreenSpaceEventHandler | null = null;
  // 回调函数
  private onDrawStartCallback: (() => void) | null = null;
  private onDrawEndCallback: ((entity: Cesium.Entity | null) => void) | null =
    null;
  private onEntityRemovedCallback: ((entity: Cesium.Entity) => void) | null =
    null;

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

    // 确保启用地形深度测试以获得正确的高度
    this.scene.globe.depthTestAgainstTerrain = true;
  }

  clearFrustum(): void {
    // 清理视锥体图元
    this.frustumPrimitives.forEach((primitive) => {
      if (primitive && !primitive.isDestroyed()) {
        this.viewer.scene.primitives.remove(primitive);
      }
    });
    this.frustumPrimitives = [];
    
    // 清理视锥体专用的事件处理器
    if (this.screenSpaceEventHandler) {
      this.screenSpaceEventHandler.destroy();
      this.screenSpaceEventHandler = null;
    }
  }
  // 视锥体功能
  drawFrustum(options: FrustumOptions = {}): void {
    try {
      this.clearFrustum();
      
      // 参数验证
      const fov = Math.max(1, Math.min(179, options.fov || 60)); // 限制FOV范围
      const aspectRatio = Math.max(0.1, options.aspectRatio || 1.0);
      const near = Math.max(0.1, options.near || 1.0);
      const far = Math.max(near + 1, options.far || 1000.0);
      
      const position = options.position || this.viewer.camera.positionWC;
      const orientation =
        options.orientation ||
        Cesium.Quaternion.fromRotationMatrix(
          Cesium.Matrix4.getRotation(
            this.viewer.camera.transform,
            new Cesium.Matrix3()
          )
        );

      const frustum = new Cesium.PerspectiveFrustum({
        fov: Cesium.Math.toRadians(fov),
        aspectRatio: aspectRatio,
        near: near,
        far: far,
      });

    // 创建视锥体填充
    const fillGeometry = new Cesium.FrustumGeometry({
      frustum: frustum,
      origin: position,
      orientation: orientation,
      vertexFormat: Cesium.VertexFormat.POSITION_ONLY,
    });

    const fillInstance = new Cesium.GeometryInstance({
      geometry: fillGeometry,
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(
          options.fillColor || new Cesium.Color(1.0, 0.0, 0.0, 0.3)
        ),
      },
    });

    const fillPrimitive = new Cesium.Primitive({
      geometryInstances: fillInstance,
      appearance: new Cesium.PerInstanceColorAppearance({
        closed: true,
        flat: true,
      }),
    });

    // 创建视锥体轮廓
    const outlineGeometry = new Cesium.FrustumOutlineGeometry({
      frustum: frustum,
      origin: position,
      orientation: orientation,
    });

    const outlineInstance = new Cesium.GeometryInstance({
      geometry: outlineGeometry,
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(
          options.outlineColor || new Cesium.Color(1.0, 1.0, 1.0, 1.0)
        ),
      },
    });

    const outlinePrimitive = new Cesium.Primitive({
      geometryInstances: outlineInstance,
      appearance: new Cesium.PerInstanceColorAppearance({
        closed: true,
        flat: true,
      }),
    });

    this.viewer.scene.primitives.add(fillPrimitive);
    this.viewer.scene.primitives.add(outlinePrimitive);
    this.frustumPrimitives.push(fillPrimitive, outlinePrimitive);

      // 右键点击事件
      if (options.onRightClick && this.screenSpaceEventHandler) {
        this.screenSpaceEventHandler.setInputAction((movement: any) => {
          if (movement.position && options.onRightClick) {
            options.onRightClick(position);
          }
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
      }
    } catch (error) {
      console.error('绘制视锥体时发生错误:', error);
      // 确保在出错时也清理资源
      this.clearFrustum();
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
        // 阻止 Cesium 默认的双击行为（如追踪实体）
        // Cesium.ScreenSpaceEventHandler.preventDefault(dblClick);
        if (!this.isDrawing) return;
        this.finishDrawing();
        // 恢复 Cesium 默认的双击行为
        this.viewer.cesiumWidget.screenSpaceEventHandler.setInputAction(
          mapDoubleClickAct,
          Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
        );
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

    const pointEntity = this.entities.add({
      position: position.clone(),
      point: {
        pixelSize: 5,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
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
      this.tempPositions.pop();

      // 移除最后添加的点实体
      const lastPointEntity = this.tempEntities.pop();
      if (lastPointEntity) {
        this.entities.remove(lastPointEntity);
      }

      // 移除最后添加的线/面片段实体
      const lastLineEntity = this.tempEntities.pop();
      if (lastLineEntity) {
        this.entities.remove(lastLineEntity);
      }

      // 重新更新当前的绘制实体
      this.updateDrawingEntity();
    }
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
    // 移除旧的活动实体（包括线和标签）
    this.tempEntities.forEach(entity => {
      if (entity && (entity.polyline || entity.polygon || entity.label)) {
        this.entities.remove(entity);
      }
    });
    this.tempEntities = [];

    const positions = [...this.tempPositions];
    if (previewPoint) {
      positions.push(previewPoint);
    }

    if (positions.length < 2) return;

    let activeEntity: Cesium.Entity | undefined;

    if (this.drawMode === "line") {
      // 创建主线条
      activeEntity = this.entities.add({
        polyline: {
          positions: positions,
          width: 3,
          material: Cesium.Color.YELLOW,
          clampToGround: true,
        },
      });
      this.tempEntities.push(activeEntity);

      // 为每一段添加距离标签
      for (let i = 0; i < positions.length - 1; i++) {
        const startPos = positions[i];
        const endPos = positions[i + 1];
        const distance = Cesium.Cartesian3.distance(startPos, endPos);
        const midPoint = Cesium.Cartesian3.midpoint(startPos, endPos, new Cesium.Cartesian3());
        
        const labelEntity = this.entities.add({
          position: midPoint,
          label: {
            text: `${distance.toFixed(2)} m`,
            font: "12px sans-serif",
            fillColor: Cesium.Color.CYAN,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -10),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
        this.tempEntities.push(labelEntity);
      }

      // 添加总距离标签（在最后一个点）
      if (positions.length > 1) {
        let totalDistance = 0;
        for (let i = 1; i < positions.length; i++) {
          totalDistance += Cesium.Cartesian3.distance(positions[i-1], positions[i]);
        }
        
        const totalLabelEntity = this.entities.add({
          position: positions[positions.length - 1],
          label: {
            text: `总长: ${totalDistance.toFixed(2)} m`,
            font: "14px sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, 20),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
        this.tempEntities.push(totalLabelEntity);
      }
    } else if (this.drawMode === "polygon") {
      // 绘制填充的多边形区域
      activeEntity = this.entities.add({
        polygon: {
          hierarchy: new Cesium.CallbackProperty(() => {
            return new Cesium.PolygonHierarchy(positions);
          }, false),
          material: Cesium.Color.LIGHTGREEN.withAlpha(0.3), // 淡绿色填充
          outline: true,
          outlineColor: Cesium.Color.GREEN,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });
    } else if (this.drawMode === "rectangle" && positions.length >= 2) {
      const rect = this.calculateRectangle(positions[0], positions[1]);
      activeEntity = this.entities.add({
        rectangle: {
          coordinates: rect,
          material: Cesium.Color.GREEN.withAlpha(0.5),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });
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
    const positions = this.tempPositions.map((p) => p.clone());

    if (this.drawMode === "line") {
      finalEntity = this.entities.add({
        name: "绘制的线",
        polyline: {
          positions: positions,
          width: 3,
          material: Cesium.Color.YELLOW,
          clampToGround: true,
        },
      });

      // 为每一段添加距离标签
      for (let i = 0; i < positions.length - 1; i++) {
        const startPos = positions[i];
        const endPos = positions[i + 1];
        const distance = Cesium.Cartesian3.distance(startPos, endPos);
        const midPoint = Cesium.Cartesian3.midpoint(startPos, endPos, new Cesium.Cartesian3());
        
        this.entities.add({
          position: midPoint,
          label: {
            text: `${distance.toFixed(2)} m`,
            font: "12px sans-serif",
            fillColor: Cesium.Color.CYAN,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -10),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      }

      // 添加总距离标签
      if (positions.length > 1) {
        let totalDistance = 0;
        for (let i = 1; i < positions.length; i++) {
          totalDistance += Cesium.Cartesian3.distance(positions[i-1], positions[i]);
        }
        
        this.entities.add({
          position: positions[positions.length - 1],
          label: {
            text: `总长: ${totalDistance.toFixed(2)} m`,
            font: "14px sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, 20),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      }
    } else if (this.drawMode === "polygon") {
      // 绘制填充的多边形区域
      finalEntity = this.entities.add({
        name: "绘制的多边形区域",
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions),
          material: Cesium.Color.LIGHTGREEN.withAlpha(0.3), // 淡绿色填充
          outline: true,
          outlineColor: Cesium.Color.GREEN,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });
      // 添加面积标签
      const area = this.calculatePolygonArea(positions);
      if (area > 0) {
        const center = this.calculatePolygonCenter(positions);
        this.entities.add({
          position: center,
          label: {
            text: `面积: ${area.toFixed(2)} km²`,
            font: "14px sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -20),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      }
    } else if (this.drawMode === "rectangle" && positions.length >= 2) {
      const rect = this.calculateRectangle(positions[0], positions[1]);
      finalEntity = this.entities.add({
        name: "绘制的矩形",
        rectangle: {
          coordinates: rect,
          material: Cesium.Color.GREEN.withAlpha(0.5),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });
      // 添加面积标签
      const area = this.calculateRectangleArea(rect);
      if (area > 0) {
        const rectCenter = Cesium.Rectangle.center(rect);
        this.entities.add({
          position: Cesium.Cartesian3.fromRadians(
            rectCenter.longitude,
            rectCenter.latitude
          ),
          label: {
            text: `面积: ${area.toFixed(2)} km²`,
            font: "14px sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -20),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      }
    }

    // 将完成的实体存入列表
    if (finalEntity) {
      this.finishedEntities.push(finalEntity);
    }

    // 清理临时数据和状态
    this.endDrawingInternal(true);

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
    // 清除所有已完成的实体
    this.finishedEntities.forEach((entity) => {
      this.entities.remove(entity);
    });
    this.finishedEntities = [];
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
    const borderColor = options?.borderColor || '#0062FF';
    const fillColor = options?.fillColor || '#0062FF';
    const borderWidth = options?.borderWidth || 2;
    const name = options?.name || '监控区域';

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
    const color = options?.color || '#0062FF';
    const width = options?.width || 2;
    const dashPattern = options?.dashPattern || 0x00FF00FF;
    const name = options?.name || '垂直线条';
    const groundHeight = options?.groundHeight || 0;

    // 计算地面位置
    const groundPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude, groundHeight);
    const topPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);

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

    return entity;
  }

  /**
   * 销毁工具，清理所有事件监听器
   */
  destroy(): void {
    this.deactivateDrawingHandlers();
    this.clearFrustum(); // 清理视锥体相关资源
    // 可以选择不清除实体，由用户决定
    // this.clearAll();
  }
}

// 为了在 HTML 中通过 <script type="module"> 或打包工具使用
// @ts-ignore
window.DrawHelper = DrawHelper;

export default DrawHelper;
