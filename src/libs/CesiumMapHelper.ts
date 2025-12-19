import * as Cesium from "cesium";
import type { Primitive } from "cesium";
import {
  isValidCartesian3,
  formatDistance,
  formatArea,
  calculateRectangle,
  calculateRectangleArea,
  calculatePolygonArea,
  calculatePolygonCenter
} from '../utils/calc';
import { DrawLine, DrawPolygon, DrawRectangle, DrawCircle, type DrawCallbacks } from './drawHelper';
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
  private drawMode: "line" | "polygon" | "rectangle" | "circle" | null = null;
  private isDrawing: boolean = false;
  private tempPositions: Cesium.Cartesian3[] = [];
  private tempEntities: Cesium.Entity[] = []; // 临时实体，用于绘制过程中
  private tempLabelEntities: Cesium.Entity[] = []; // 临时标签实体
  private finishedEntities: Cesium.Entity[] = []; // 已完成的实体
  private finishedLabelEntities: Cesium.Entity[] = []; // 已完成的标签实体
  private finishedPointEntities: Cesium.Entity[] = []; // 已完成的点实体
  private publicEntities: Cesium.Entity[] = []; // 通过公共方法创建的实体
  private _doubleClickPending: boolean = false; // 双击判断
  
  // 绘制类实例
  private drawLine: DrawLine;
  private drawPolygon: DrawPolygon;
  private drawRectangle: DrawRectangle;
  private drawCircle: DrawCircle;
  private currentDrawer: DrawLine | DrawPolygon | DrawRectangle | DrawCircle | null = null;
  // 事件处理器
  private screenSpaceEventHandler: Cesium.ScreenSpaceEventHandler | null = null;
  // 回调函数
  private onDrawStartCallback: (() => void) | null = null;
  private onDrawEndCallback: ((entity: Cesium.Entity | null) => void) | null = null;
  private onEntityRemovedCallback: ((entity: Cesium.Entity) => void) | null = null;
  private onMeasureCompleteCallback: ((result: {
    type: "line" | "polygon" | "rectangle" | "circle";
    positions: Cesium.Cartesian3[];
    distance?: number;
    areaKm2?: number;
  }) => void) | null = null;
  private offsetHeight: number = 2;
  // 记录绘制前地形深度测试开关，用于绘制结束或取消时恢复
  private originalDepthTestAgainstTerrain: boolean | null = null;

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
    
    // 确保启用地形深度测试以获得正确的高度
    this.scene.globe.depthTestAgainstTerrain = true;

    // 初始化绘制类实例
    const callbacks: DrawCallbacks = {
      onDrawStart: () => {
        if (this.onDrawStartCallback) {
          this.onDrawStartCallback();
        }
      },
      onDrawEnd: (entity) => {
        if (this.onDrawEndCallback) {
          this.onDrawEndCallback(entity);
        }
      },
      onEntityRemoved: (entity) => {
        if (this.onEntityRemovedCallback) {
          this.onEntityRemovedCallback(entity);
        }
      },
      onMeasureComplete: (result) => {
        if (this.onMeasureCompleteCallback) {
          this.onMeasureCompleteCallback(result);
        }
      }
    };

    this.drawLine = new DrawLine(viewer, callbacks);
    this.drawPolygon = new DrawPolygon(viewer, callbacks);
    this.drawRectangle = new DrawRectangle(viewer, callbacks);
    this.drawCircle = new DrawCircle(viewer, callbacks);
  }

  // isValidCartesian3 已移至 calc.ts，直接使用导入的函数

  /**
   * 外部调用：在场景模式（2D/3D）切换后，更新偏移高度并重算已完成实体
   */
  public handleSceneModeChanged(): void {
    const oldOffsetHeight = this.offsetHeight;
    this.updateOffsetHeight();
    if (oldOffsetHeight !== this.offsetHeight) {
      this.updateFinishedEntitiesForModeChange();
    }
  }

  /**
   * 根据场景模式更新偏移高度
   */
  private updateOffsetHeight(): void {
    if (this.scene.mode === Cesium.SceneMode.SCENE3D) {
      this.offsetHeight = 1; // 3D模式使用100米偏移，所有元素都浮动
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
   * 开始绘制圆形
   */
  startDrawingCircle(): void {
    this.startDrawing("circle");
  }

  /**
   * 内部统一的开始绘制方法
   * @param mode 绘制模式
   */
  private startDrawing(mode: "line" | "polygon" | "rectangle" | "circle"): void {
    this.endDrawingInternal(false); // 结束任何正在进行的绘制，但不清空已完成的实体

    this.drawMode = mode;
    this.isDrawing = true;
    this.tempPositions = [];
    this.tempEntities = [];
    this._doubleClickPending = false;

    // 选择对应的绘制类
    switch (mode) {
      case "line":
        this.currentDrawer = this.drawLine;
        break;
      case "polygon":
        this.currentDrawer = this.drawPolygon;
        break;
      case "rectangle":
        this.currentDrawer = this.drawRectangle;
        break;
      case "circle":
        this.currentDrawer = this.drawCircle;
        break;
    }

    if (this.currentDrawer) {
      this.currentDrawer.startDrawing();
    }

    this.activateDrawingHandlers();
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
    // 仅在地形瓦片已加载完成时才尝试 globe.pick，避免早期不稳定状态
    if (ray && this.scene.mode === Cesium.SceneMode.SCENE3D && this.scene.globe.tilesLoaded) {
      const position = this.scene.globe.pick(ray, this.scene) as Cesium.Cartesian3 | undefined;
      if (Cesium.defined(position)) {
        // 防御性检查：确保拾取到的位置不包含 NaN/Infinity
        if (
          Number.isFinite(position.x) &&
          Number.isFinite(position.y) &&
          Number.isFinite(position.z)
        ) {
          return position;
        }
      }
    }
    // 如果地形拾取失败，回退到椭球体拾取
    const ellipsoidPosition = this.viewer.camera.pickEllipsoid(
      windowPosition,
      this.scene.globe.ellipsoid
    ) as Cesium.Cartesian3 | undefined;
    if (ellipsoidPosition) {
      if (
        Number.isFinite(ellipsoidPosition.x) &&
        Number.isFinite(ellipsoidPosition.y) &&
        Number.isFinite(ellipsoidPosition.z)
      ) {
        return ellipsoidPosition;
      }
    }
    return null;
  }

  /**
   * 添加一个点到临时位置数组并创建点实体
   * @param position 世界坐标
   */
  private addPoint(position: Cesium.Cartesian3): void {
    // 在 3D 模式下，若地形尚未加载完成且当前为测面模式，则忽略点击，避免早期不稳定坐标
    if (
      this.drawMode === "polygon" &&
      this.scene.mode === Cesium.SceneMode.SCENE3D &&
      !this.scene.globe.tilesLoaded
    ) {
      return;
    }
    
    if (this.currentDrawer) {
      // addPoint 是受保护的方法，需要通过类型断言访问
      (this.currentDrawer as any).addPoint(position);
      this.tempPositions = (this.currentDrawer as any).tempPositions;
      this.tempEntities = (this.currentDrawer as any).tempEntities;
      this.updateDrawingEntity();
    }
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

      // 同步绘制类的临时数据
      if (this.currentDrawer) {
        (this.currentDrawer as any).tempPositions = [...this.tempPositions];
        (this.currentDrawer as any).tempEntities = [];
        (this.currentDrawer as any).tempLabelEntities = [];
      }

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
      if (this.currentDrawer) {
        // addPoint 是受保护的方法，需要通过类型断言访问
        (this.currentDrawer as any).addPoint(position);
      } else {
        // 使用原有逻辑
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
            heightReference: Cesium.HeightReference.NONE,
            scaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.0, 1.5e7, 0.5),
          },
        });
        this.tempEntities.push(pointEntity);
      }
    });

    // 同步临时数据
    if (this.currentDrawer) {
      this.tempPositions = (this.currentDrawer as any).tempPositions;
      this.tempEntities = (this.currentDrawer as any).tempEntities;
    }

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
    if (!this.currentDrawer) {
      console.warn('updateDrawingEntity called but currentDrawer is null. This should not happen.');
      return;
    }

    this.currentDrawer.updateDrawingEntity(previewPoint);
    // 同步临时数据
    this.tempPositions = (this.currentDrawer as any).tempPositions;
    this.tempEntities = (this.currentDrawer as any).tempEntities;
    this.tempLabelEntities = (this.currentDrawer as any).tempLabelEntities;
  }

  /**
   * 完成当前绘制操作
   */
  private finishDrawing(): void {
    if (!this.currentDrawer) {
      console.warn('finishDrawing called but currentDrawer is null. This should not happen.');
      this.endDrawingInternal(true);
      return;
    }

    const result = this.currentDrawer.finishDrawing();
    
    if (result && result.entity) {
      this.finishedEntities.push(result.entity);
    }

    // 同步临时数据
    this.tempPositions = (this.currentDrawer as any).tempPositions;
    this.tempEntities = (this.currentDrawer as any).tempEntities;
    this.tempLabelEntities = (this.currentDrawer as any).tempLabelEntities;
    this.finishedPointEntities = (this.currentDrawer as any).finishedPointEntities;

    // 将临时标签实体转移到已完成标签实体数组
    this.tempLabelEntities.forEach((entity) => {
      this.finishedLabelEntities.push(entity);
    });
    this.tempLabelEntities = [];

    // 完成绘制后，恢复绘图状态和事件
    this.drawMode = null;
    this.isDrawing = false;
    this.currentDrawer = null;
    this.deactivateDrawingHandlers();
  }

  /**
   * 内部方法：重置绘图状态和清理临时数据
   * @param resetMode 是否重置绘图模式和状态标志
   */
  private endDrawingInternal(resetMode: boolean): void {
    // 如果使用绘制类，清理绘制类的临时数据
    if (this.currentDrawer) {
      (this.currentDrawer as any).clearTempEntities();
      this.tempPositions = (this.currentDrawer as any).tempPositions;
      this.tempEntities = (this.currentDrawer as any).tempEntities;
      this.tempLabelEntities = (this.currentDrawer as any).tempLabelEntities;
    }

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

    if (resetMode) {
      this.drawMode = null;
      this.isDrawing = false;
      this.currentDrawer = null;
      this.deactivateDrawingHandlers();
      // 取消绘制时同样恢复地形深度测试开关
      if (this.originalDepthTestAgainstTerrain !== null) {
        this.scene.globe.depthTestAgainstTerrain = this.originalDepthTestAgainstTerrain;
        this.originalDepthTestAgainstTerrain = null;
      }
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

  /**
   * 使用 Canvas 绘制总长文本，生成用于 billboard 的图片
   */
  private createTotalLengthBillboardImage(text: string): HTMLCanvasElement {
    const paddingX = 12;
    const paddingY = 6;
    const font = "bold 16px 'Microsoft YaHei', 'PingFang SC', sans-serif";

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      // 兜底：返回一个小画布避免报错
      canvas.width = 1;
      canvas.height = 1;
      return canvas;
    }

    // 先测量文本宽度
    ctx.font = font;
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = 20; // 近似行高

    canvas.width = Math.ceil(textWidth + paddingX * 2);
    canvas.height = Math.ceil(textHeight + paddingY * 2);

    // 再次设置字体（重新设置会重置部分状态）
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    // 绘制半透明黑色背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制白色文本
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    return canvas;
  }

  /**
   * 使用 Canvas 绘制分段长度文本，生成用于 billboard 的图片
   * 样式与总长保持一致，便于统一视觉
   */
  private createSegmentLengthBillboardImage(text: string): HTMLCanvasElement {
    // 目前与总长样式一致，后续如需区分可单独调整
    return this.createTotalLengthBillboardImage(text);
  }

  // --- 回调注册 ---
  onMeasureComplete(callback: (result: {
    type: "line" | "polygon" | "rectangle" | "circle";
    positions: Cesium.Cartesian3[];
    distance?: number;
    areaKm2?: number;
  }) => void): void {
    this.onMeasureCompleteCallback = callback;
  }

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
        const rawGroundPositions = (entity as any)._groundPositions as Cesium.Cartesian3[] | undefined;
        if (rawGroundPositions && rawGroundPositions.length > 0) {
          // 过滤掉包含 NaN/Infinity 的无效点
          const groundPositions = rawGroundPositions.filter((pos) =>
            pos &&
            Number.isFinite(pos.x) &&
            Number.isFinite(pos.y) &&
            Number.isFinite(pos.z)
          );
          if (groundPositions.length === 0) {
            return;
          }
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
        const rawGroundPositions = (entity as any)._groundPositions as Cesium.Cartesian3[] | undefined;
        if (rawGroundPositions && rawGroundPositions.length > 0) {
          const groundPositions = rawGroundPositions.filter((pos) =>
            pos &&
            Number.isFinite(pos.x) &&
            Number.isFinite(pos.y) &&
            Number.isFinite(pos.z)
          );
          if (groundPositions.length === 0) {
            return;
          }
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
    
    // 更新标签实体（面积 label + 距离 billboard）
    this.finishedLabelEntities.forEach((entity) => {
      if (!entity) return;

      // 使用保存的原始地面位置
      const groundPosition = (entity as any)._groundPosition as Cesium.Cartesian3 | undefined;
      if (!groundPosition) return;

      if (entity.label) {
        // 处理面积等使用 Cesium.Label 的标签
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
      } else if (entity.billboard) {
        // 处理测距总长 / 分段的 billboard 标签
        if (is3DMode) {
          const carto = Cesium.Cartographic.fromCartesian(groundPosition);
          const elevatedPosition = Cesium.Cartesian3.fromRadians(
            carto.longitude,
            carto.latitude,
            (carto.height || 0) + this.offsetHeight
          );
          entity.position = new Cesium.ConstantPositionProperty(elevatedPosition);
          entity.billboard.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.RELATIVE_TO_GROUND);
        } else {
          // 2D 模式下对 billboard 贴地支持有限，这里直接使用地面 Cartesian3，关闭贴地
          entity.position = new Cesium.ConstantPositionProperty(groundPosition);
          entity.billboard.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
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

