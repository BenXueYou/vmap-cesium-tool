import * as Cesium from 'cesium';
import type { Viewer, Entity, Cartesian3 } from 'cesium';

/**
 * 绘制模式
 */
export type DrawMode = 'point' | 'line' | 'polygon' | 'rectangle' | 'circle' | null;

/**
 * 绘制选项
 */
export interface DrawOptions {
  /** 绘制模式 */
  mode?: DrawMode;
  /** 线条颜色 */
  lineColor?: Cesium.Color | string;
  /** 线条宽度 */
  lineWidth?: number;
  /** 填充颜色 */
  fillColor?: Cesium.Color | string;
  /** 是否贴地 */
  clampToGround?: boolean;
  /** 点击回调 */
  onClick?: (entity: Entity, positions?: Cartesian3[]) => void;
}

/**
 * 绘制结果
 */
export interface DrawResult {
  /** 绘制的实体 */
  entity: Entity;
  /** 位置数组 */
  positions: Cartesian3[];
}

/**
 * 绘制服务类
 * 
 * 提供地图绘制功能，支持点、线、多边形、矩形、圆形的绘制。
 * 
 * @example
 * ```typescript
 * const drawService = new DrawService(viewer);
 * 
 * // 开始绘制多边形
 * drawService.startDrawing('polygon', {
 *   fillColor: 'rgba(255, 0, 0, 0.3)',
 *   lineColor: '#FF0000'
 * });
 * 
 * // 监听绘制完成
 * drawService.onDrawEnd((result) => {
 *   console.log('绘制完成', result);
 * });
 * 
 * // 结束绘制
 * drawService.endDrawing();
 * ```
 */
export class DrawService {
  private viewer: Viewer;
  private isDrawing = false;
  private drawMode: DrawMode = null;
  private options: DrawOptions | null = null;
  
  private tempPositions: Cartesian3[] = [];
  private tempEntities: Entity[] = [];
  private finishedEntities: Entity[] = [];
  
  private screenSpaceEventHandler: Cesium.ScreenSpaceEventHandler | null = null;
  private onDrawStartCallback: (() => void) | null = null;
  private onDrawEndCallback: ((result: DrawResult | null) => void) | null = null;
  private onEntityRemovedCallback: ((entity: Entity) => void) | null = null;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
  }

  /**
   * 开始绘制
   */
  startDrawing(mode: DrawMode, options: DrawOptions = {}): void {
    if (this.isDrawing) {
      this.endDrawing();
    }

    this.drawMode = mode;
    this.options = options;
    this.isDrawing = true;
    this.tempPositions = [];
    this.tempEntities = [];

    this.activateDrawingHandlers();
    
    if (this.onDrawStartCallback) {
      this.onDrawStartCallback();
    }
  }

  /**
   * 开始绘制线
   */
  startDrawingLine(options: DrawOptions = {}): void {
    this.startDrawing('line', options);
  }

  /**
   * 开始绘制多边形
   */
  startDrawingPolygon(options: DrawOptions = {}): void {
    this.startDrawing('polygon', options);
  }

  /**
   * 开始绘制矩形
   */
  startDrawingRectangle(options: DrawOptions = {}): void {
    this.startDrawing('rectangle', options);
  }

  /**
   * 开始绘制圆形
   */
  startDrawingCircle(options: DrawOptions = {}): void {
    this.startDrawing('circle', options);
  }

  /**
   * 激活绘制事件处理器
   */
  private activateDrawingHandlers(): void {
    this.deactivateDrawingHandlers();

    this.screenSpaceEventHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    // 左键添加点
    this.screenSpaceEventHandler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (!this.isDrawing) return;
      
      const cartesian = this.pickGlobePosition(click.position);
      if (cartesian) {
        this.addPoint(cartesian);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 右键删除最后一个点
    this.screenSpaceEventHandler.setInputAction(() => {
      if (!this.isDrawing || this.tempPositions.length === 0) return;
      this.removeLastPoint();
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    // 鼠标移动更新预览
    this.screenSpaceEventHandler.setInputAction((move: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      if (!this.isDrawing) return;
      const cartesian = this.pickGlobePosition(move.endPosition);
      if (cartesian && this.tempPositions.length > 0) {
        this.updatePreview(cartesian);
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // 双击结束绘制
    this.screenSpaceEventHandler.setInputAction((dblClick: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (!this.isDrawing) return;
      const cartesian = this.pickGlobePosition(dblClick.position);
      if (cartesian) {
        this.finishDrawing();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  }

  /**
   * 拾取地球表面位置
   */
  private pickGlobePosition(windowPosition: Cesium.Cartesian2): Cartesian3 | null {
    try {
      const ray = this.viewer.camera.getPickRay(windowPosition);
      if (ray) {
        const position = this.viewer.scene.globe.pick(ray, this.viewer.scene);
        if (position) {
          return position.clone();
        }
      }
      // 回退到椭球体拾取
      const ellipsoidPosition = this.viewer.camera.pickEllipsoid(
        windowPosition,
        this.viewer.scene.globe.ellipsoid
      );
      if (ellipsoidPosition) {
        return ellipsoidPosition.clone();
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * 添加点
   */
  private addPoint(position: Cartesian3): void {
    this.tempPositions.push(position.clone());
    this.updateDrawingEntity();
  }

  /**
   * 删除最后一个点
   */
  private removeLastPoint(): void {
    if (this.tempPositions.length === 0) return;
    
    this.tempPositions.pop();
    
    // 移除最后一个临时实体
    if (this.tempEntities.length > 0) {
      const lastEntity = this.tempEntities.pop();
      if (lastEntity) {
        this.viewer.entities.remove(lastEntity);
      }
    }
    
    // 重绘预览
    if (this.tempPositions.length > 0) {
      this.updateDrawingEntity();
    }
  }

  /**
   * 更新预览
   */
  private updatePreview(currentMousePosition: Cartesian3): void {
    this.updateDrawingEntity(currentMousePosition);
  }

  /**
   * 更新绘制实体
   */
  private updateDrawingEntity(previewPoint?: Cartesian3): void {
    // 清除现有临时实体
    this.tempEntities.forEach(entity => this.viewer.entities.remove(entity));
    this.tempEntities = [];

    if (this.tempPositions.length === 0) return;

    const lineColor = this.options?.lineColor ? this.resolveColor(this.options.lineColor, Cesium.Color.YELLOW) : Cesium.Color.YELLOW;
    const fillColor = this.options?.fillColor ? this.resolveColor(this.options.fillColor, Cesium.Color.RED.withAlpha(0.5)) : Cesium.Color.RED.withAlpha(0.5);
    const lineWidth = this.options?.lineWidth ?? 2;
    const clampToGround = this.options?.clampToGround ?? true;

    if (this.drawMode === 'line') {
      this.drawLine(this.tempPositions, previewPoint, lineColor, lineWidth, clampToGround);
    } else if (this.drawMode === 'polygon') {
      this.drawPolygon(this.tempPositions, previewPoint, fillColor, lineColor, lineWidth, clampToGround);
    } else if (this.drawMode === 'rectangle' && this.tempPositions.length >= 2) {
      this.drawRectangle(this.tempPositions[0], previewPoint || this.tempPositions[this.tempPositions.length - 1], fillColor, lineColor, lineWidth, clampToGround);
    } else if (this.drawMode === 'circle' && this.tempPositions.length >= 2) {
      const center = this.tempPositions[0];
      const current = previewPoint || this.tempPositions[this.tempPositions.length - 1];
      this.drawCircle(center, current, fillColor, lineColor, lineWidth, clampToGround);
    }
  }

  /**
   * 绘制线
   */
  private drawLine(positions: Cartesian3[], previewPoint: Cartesian3 | undefined, color: Cesium.Color, width: number, clampToGround: boolean): void {
    const allPositions = previewPoint ? [...positions, previewPoint] : positions;
    
    const entity = this.viewer.entities.add({
      polyline: {
        positions: allPositions,
        width,
        material: new Cesium.ColorMaterialProperty(color),
        clampToGround,
      },
    });
    
    this.tempEntities.push(entity);
  }

  /**
   * 绘制多边形
   */
  private drawPolygon(positions: Cartesian3[], previewPoint: Cartesian3 | undefined, fill: Cesium.Color, outline: Cesium.Color, width: number, clampToGround: boolean): void {
    const allPositions = previewPoint ? [...positions, previewPoint] : positions;
    const isComplete = !previewPoint;
    
    // 绘制填充区域
    if (isComplete || positions.length >= 3) {
      const hierarchy = isComplete 
        ? new Cesium.PolygonHierarchy(positions)
        : new Cesium.PolygonHierarchy(allPositions);
      
      const fillEntity = this.viewer.entities.add({
        polygon: {
          hierarchy,
          material: fill,
          outline: true,
          outlineColor: outline,
          outlineWidth: width,
          heightReference: clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE,
        },
      });
      
      this.tempEntities.push(fillEntity);
    }
  }

  /**
   * 绘制矩形
   */
  private drawRectangle(start: Cartesian3, end: Cartesian3, fill: Cesium.Color, outline: Cesium.Color, width: number, clampToGround: boolean): void {
    const startCarto = Cesium.Cartographic.fromCartesian(start);
    const endCarto = Cesium.Cartographic.fromCartesian(end);
    
    const rectangle = Cesium.Rectangle.fromRadians(
      Math.min(startCarto.longitude, endCarto.longitude),
      Math.min(startCarto.latitude, endCarto.latitude),
      Math.max(startCarto.longitude, endCarto.longitude),
      Math.max(startCarto.latitude, endCarto.latitude)
    );
    
    const entity = this.viewer.entities.add({
      rectangle: {
        coordinates: rectangle,
        material: fill,
        outline: true,
        outlineColor: outline,
        outlineWidth: width,
        heightReference: clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE,
      },
    });
    
    this.tempEntities.push(entity);
  }

  /**
   * 绘制圆形
   */
  private drawCircle(center: Cartesian3, edge: Cartesian3, fill: Cesium.Color, outline: Cesium.Color, width: number, clampToGround: boolean): void {
    const centerCarto = Cesium.Cartographic.fromCartesian(center);
    const edgeCarto = Cesium.Cartographic.fromCartesian(edge);
    
    // 计算半径（米）
    const radius = this.calculateDistance(centerCarto, edgeCarto);
    
    const entity = this.viewer.entities.add({
      position: center,
      ellipse: {
        semiMajorAxis: radius,
        semiMinorAxis: radius,
        material: fill,
        outline: true,
        outlineColor: outline,
        outlineWidth: width,
        heightReference: clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE,
      },
    });
    
    this.tempEntities.push(entity);
  }

  /**
   * 计算两点间距离
   */
  private calculateDistance(cart1: Cesium.Cartographic, cart2: Cesium.Cartographic): number {
    const R = 6378137.0; // 地球半径（米）
    const dLat = cart2.latitude - cart1.latitude;
    const dLon = cart2.longitude - cart1.longitude;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(cart1.latitude) * Math.cos(cart2.latitude) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 解析颜色
   */
  private resolveColor(color: Cesium.Color | string, fallback: Cesium.Color): Cesium.Color {
    if (color instanceof Cesium.Color) return color;
    try {
      return Cesium.Color.fromCssColorString(color);
    } catch {
      return fallback;
    }
  }

  /**
   * 完成绘制
   */
  private finishDrawing(): void {
    if (this.tempPositions.length < 2) {
      this.endDrawing();
      if (this.onDrawEndCallback) {
        this.onDrawEndCallback(null);
      }
      return;
    }

    // 创建最终实体
    const positions = this.tempPositions.slice();
    const entity = this.createFinalEntity(positions);
    
    if (entity) {
      this.finishedEntities.push(entity);
      
      if (this.onDrawEndCallback) {
        this.onDrawEndCallback({ entity, positions });
      }
    }

    this.endDrawing();
  }

  /**
   * 创建最终实体
   */
  private createFinalEntity(positions: Cartesian3[]): Entity | null {
    const lineColor = this.options?.lineColor ? this.resolveColor(this.options.lineColor, Cesium.Color.YELLOW) : Cesium.Color.YELLOW;
    const fillColor = this.options?.fillColor ? this.resolveColor(this.options.fillColor, Cesium.Color.RED.withAlpha(0.5)) : Cesium.Color.RED.withAlpha(0.5);
    const lineWidth = this.options?.lineWidth ?? 2;
    const clampToGround = this.options?.clampToGround ?? true;

    switch (this.drawMode) {
      case 'line':
        return this.viewer.entities.add({
          polyline: {
            positions,
            width: lineWidth,
            material: new Cesium.ColorMaterialProperty(lineColor),
            clampToGround,
          },
        });
      
      case 'polygon':
        return this.viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(positions),
            material: fillColor,
            outline: true,
            outlineColor: lineColor,
            outlineWidth: lineWidth,
            heightReference: clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE,
          },
        });
      
      case 'rectangle':
        if (positions.length < 2) return null;
        const startCarto = Cesium.Cartographic.fromCartesian(positions[0]);
        const endCarto = Cesium.Cartographic.fromCartesian(positions[1]);
        const rectangle = Cesium.Rectangle.fromRadians(
          Math.min(startCarto.longitude, endCarto.longitude),
          Math.min(startCarto.latitude, endCarto.latitude),
          Math.max(startCarto.longitude, endCarto.longitude),
          Math.max(startCarto.latitude, endCarto.latitude)
        );
        return this.viewer.entities.add({
          rectangle: {
            coordinates: rectangle,
            material: fillColor,
            outline: true,
            outlineColor: lineColor,
            outlineWidth: lineWidth,
            heightReference: clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE,
          },
        });
      
      case 'circle':
        if (positions.length < 2) return null;
        const centerCarto = Cesium.Cartographic.fromCartesian(positions[0]);
        const edgeCarto = Cesium.Cartographic.fromCartesian(positions[1]);
        const radius = this.calculateDistance(centerCarto, edgeCarto);
        return this.viewer.entities.add({
          position: positions[0],
          ellipse: {
            semiMajorAxis: radius,
            semiMinorAxis: radius,
            material: fillColor,
            outline: true,
            outlineColor: lineColor,
            outlineWidth: lineWidth,
            heightReference: clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE,
          },
        });
      
      default:
        return null;
    }
  }

  /**
   * 结束绘制
   */
  endDrawing(): void {
    this.deactivateDrawingHandlers();
    
    // 清除临时实体
    this.tempEntities.forEach(entity => this.viewer.entities.remove(entity));
    this.tempEntities = [];
    this.tempPositions = [];
    
    this.isDrawing = false;
    this.drawMode = null;
    this.options = null;
  }

  /**
   * 取消绘制
   */
  cancelDrawing(): void {
    this.deactivateDrawingHandlers();
    
    this.tempEntities.forEach(entity => this.viewer.entities.remove(entity));
    this.tempEntities = [];
    this.tempPositions = [];
    
    this.isDrawing = false;
    this.drawMode = null;
    this.options = null;
  }

  /**
   * 停用事件处理器
   */
  private deactivateDrawingHandlers(): void {
    if (this.screenSpaceEventHandler) {
      this.screenSpaceEventHandler.destroy();
      this.screenSpaceEventHandler = null;
    }
  }

  /**
   * 获取已完成的实体
   */
  getFinishedEntities(): Entity[] {
    return [...this.finishedEntities];
  }

  /**
   * 清除所有绘制的实体
   */
  clearAll(): void {
    this.finishedEntities.forEach(entity => this.viewer.entities.remove(entity));
    this.finishedEntities = [];
  }

  /**
   * 删除指定实体
   */
  removeEntity(entity: Entity): void {
    const index = this.finishedEntities.indexOf(entity);
    if (index > -1) {
      this.finishedEntities.splice(index, 1);
      this.viewer.entities.remove(entity);
      if (this.onEntityRemovedCallback) {
        this.onEntityRemovedCallback(entity);
      }
    }
  }

  /**
   * 设置绘制开始回调
   */
  onDrawStart(callback: () => void): void {
    this.onDrawStartCallback = callback;
  }

  /**
   * 设置绘制结束回调
   */
  onDrawEnd(callback: (result: DrawResult | null) => void): void {
    this.onDrawEndCallback = callback;
  }

  /**
   * 设置实体移除回调
   */
  onEntityRemoved(callback: (entity: Entity) => void): void {
    this.onEntityRemovedCallback = callback;
  }

  /**
   * 检查是否正在绘制
   */
  isDrawingMode(): boolean {
    return this.isDrawing;
  }

  /**
   * 获取当前绘制模式
   */
  getCurrentDrawMode(): DrawMode {
    return this.drawMode;
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.cancelDrawing();
  }
}