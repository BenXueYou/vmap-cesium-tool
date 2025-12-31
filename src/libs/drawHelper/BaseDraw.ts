import * as Cesium from "cesium";
import type { Viewer, Entity, Cartesian3 } from "cesium";
import { isValidCartesian3, formatDistance, formatArea } from '../../utils/calc';

/**
 * 绘制结果接口
 */
export interface DrawResult {
  entity: Entity | null;
  type: "line" | "polygon" | "rectangle" | "circle";
  positions: Cartesian3[];
  distance?: number;
  areaKm2?: number;
}

/**
 * 绘制回调接口
 */
export interface DrawCallbacks {
  onDrawStart?: () => void;
  onDrawEnd?: (entity: Entity | null, result: DrawResult) => void;
  onEntityRemoved?: (entity: Entity) => void;
  onMeasureComplete?: (result: DrawResult) => void;
}

/**
 * 扩展后的绘制实体类型
 * 用于在 Entity 上挂载绘图相关的元数据
 */
export type DrawEntity = Entity & {
  _drawType?: "line" | "polygon" | "rectangle" | "circle";
  _drawOptions?: DrawOptions;
  _groundPositions?: Cartesian3[];
  _groundPosition?: Cartesian3;
  _groundRectangle?: Cesium.Rectangle;
  _radius?: number;
  _borderEntity?: Entity;
  _onClick?: (entity: Entity, ...args: any[]) => void;
  _isSelected?: boolean;
  _originalStyle?: {
    material?: any;
    width?: any;
    outlineColor?: any;
    outlineWidth?: any;
  };
};

/**
 * 绘制时可选的样式和事件回调
 */
export interface DrawOptions {
  strokeColor?: Cesium.Color | string; // 线条颜色
  strokeWidth?: number; // 线条宽度
  fillColor?: Cesium.Color | string; // 填充颜色（用于多边形/矩形/圆）
  outlineColor?: Cesium.Color | string; // 边框颜色
  outlineWidth?: number; // 边框宽度
  selected?: {
    color?: Cesium.Color | string;
    width?: number;
    outlineColor?: Cesium.Color | string;
    outlineWidth?: number;
  };
  onClick?: (entity: Entity, type?: "line" | "polygon" | "rectangle" | "circle", positions?: Cartesian3[]) => void;
}

/**
 * 基础绘制类
 * 包含所有绘制类型的通用逻辑
 */
export abstract class BaseDraw {
  protected viewer: Viewer;
  protected scene: Cesium.Scene;
  protected entities: Cesium.EntityCollection;
  protected offsetHeight: number = 0;
  protected originalDepthTestAgainstTerrain: boolean | null = null;
  /**
   * 当场景启用了 requestRenderMode（手动渲染）时，绘制过程中需要关闭该模式以保证动画和交互正常。
   * 在绘制结束或取消时应恢复为原始值。
   */
  protected originalRequestRenderMode: boolean | null = null;

  protected callbacks: DrawCallbacks;

  // 临时数据
  protected tempPositions: Cesium.Cartesian3[] = [];
  protected tempEntities: Cesium.Entity[] = [];
  protected tempLabelEntities: Cesium.Entity[] = [];
  protected finishedPointEntities: Cesium.Entity[] = [];

  /** 当前绘制的选项（如果有） */
  protected drawOptions?: DrawOptions;

  /**
   * 公开只读访问当前临时数据，供调度器使用
   */
  public getTempPositions(): Cartesian3[] {
    return this.tempPositions;
  }

  public getTempEntities(): Entity[] {
    return this.tempEntities;
  }

  public getTempLabelEntities(): Entity[] {
    return this.tempLabelEntities;
  }

  public getFinishedPointEntities(): Entity[] {
    return this.finishedPointEntities;
  }

  /**
   * 允许调度器安全地重建临时数据
   */
  public setTempPositions(positions: Cartesian3[]): void {
    this.tempPositions = positions;
  }

  public setTempEntities(entities: Entity[]): void {
    this.tempEntities = entities;
  }

  public setTempLabelEntities(entities: Entity[]): void {
    this.tempLabelEntities = entities;
  }

  /**
   * 供调度器调用的公开包装方法
   */
  public addPointForHelper(position: Cartesian3): void {
    this.addPoint(position);
  }

  public clearTempEntitiesForHelper(): void {
    this.clearTempEntities();
  }

  /**
   * 清除当前绘制过程中的临时点实体
   * 仅删除带有 point 组件的临时实体，保留其它临时线/面实体
   */
  public clearTempPointEntitiesForHelper(): void {
    const remaining: Entity[] = [];
    this.tempEntities.forEach((entity) => {
      if (entity && (entity as Entity).point) {
        this.entities.remove(entity);
      } else if (entity) {
        remaining.push(entity);
      }
    });
    this.tempEntities = remaining;
  }

  /**
   * 删除最后一个点并根据剩余点重建预览实体
   * 供调度器在右键删除点时调用，具体重建逻辑仍由各子类的 updateDrawingEntity 实现
   */
  public removeLastPointAndRedraw(): void {
    if (this.tempPositions.length === 0) {
      return;
    }

    // 复制当前点位并移除最后一个
    const remainingPositions = this.tempPositions.slice(0, this.tempPositions.length - 1);

    // 清理当前所有临时实体（点实体、线/面实体、临时标签）
    this.clearTempEntities();

    // 重建内部状态：从剩余点重新创建点实体
    this.tempPositions = [];
    remainingPositions.forEach((pos) => {
      this.addPoint(pos);
    });

    // 根据剩余点重建线/面等预览实体
    this.updateDrawingEntity();
  }

  /**
   * 将任意颜色输入解析为 Cesium.Color
   */
  protected resolveColor(input?: Cesium.Color | string): Cesium.Color {
    try {
      if (!input) return Cesium.Color.YELLOW;
      if (input instanceof Cesium.Color) return input;
      // 尝试处理颜色字符串（#RRGGBB / rgba / css 名称）
      return Cesium.Color.fromCssColorString(String(input));
    } catch {
      return Cesium.Color.YELLOW;
    }
  }

  /**
   * 应用/切换选中样式（统一逻辑，供调度器和子类共用）
   */
  protected applySelectedStyleToEntity(entity: Entity): void {
    toggleSelectedStyle(entity as DrawEntity);
  }

  /**
   * 恢复原始样式（兼容旧接口，内部仍走统一逻辑）
   */
  protected restoreOriginalStyleForEntity(entity: Entity): void {
    const drawEntity = entity as DrawEntity;
    if (drawEntity._isSelected) {
      toggleSelectedStyle(drawEntity);
    }
  }

  // 抽象方法：更新绘制实体（预览）
  abstract updateDrawingEntity(previewPoint?: Cesium.Cartesian3): void;

  // 新增抽象方法：开始绘制（接受可选参数）
  abstract startDrawing(options?: DrawOptions): void;

  /**
   * 抽象方法：完成绘制
   */
  abstract finishDrawing(): DrawResult | null;

  /**
   * 抽象方法：获取绘制类型
   */
  abstract getDrawType(): "line" | "polygon" | "rectangle" | "circle";
  constructor(viewer: Viewer, callbacks: DrawCallbacks = {}) {
    this.viewer = viewer;
    this.scene = viewer.scene;
    this.entities = viewer.entities;
    this.callbacks = callbacks;
    this.updateOffsetHeight();
  }

  /**
   * 根据场景模式更新偏移高度
   */
  protected updateOffsetHeight(): void {
    if (this.scene.mode === Cesium.SceneMode.SCENE3D) {
      this.offsetHeight = 1;
    } else {
      this.offsetHeight = 0;
    }
  }

  /**
   * 拾取地形或椭球体上的位置
   */
  protected pickGlobePosition(windowPosition: Cesium.Cartesian2): Cesium.Cartesian3 | null {
    const ray = this.viewer.camera.getPickRay(windowPosition);
    if (ray && this.scene.mode === Cesium.SceneMode.SCENE3D && this.scene.globe.tilesLoaded) {
      const position = this.scene.globe.pick(ray, this.scene) as Cesium.Cartesian3 | undefined;
      if (Cesium.defined(position)) {
        if (
          Number.isFinite(position.x) &&
          Number.isFinite(position.y) &&
          Number.isFinite(position.z)
        ) {
          return position;
        }
      }
    }
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
   * 如果场景启用了 requestRenderMode（手动渲染），在开始绘制时临时关闭以保证动画/交互正常。
   */
  protected enableContinuousRenderingIfNeeded(): void {
    try {
      // 只有在属性存在时才尝试修改（兼容不同 Cesium 版本）
      if ((this.scene as any).requestRenderMode !== undefined) {
        if (this.originalRequestRenderMode === null) {
          this.originalRequestRenderMode = !!this.scene.requestRenderMode;
        }
        if (this.scene.requestRenderMode) {
          this.scene.requestRenderMode = false;
          if (typeof (this.scene as any).requestRender === 'function') {
            (this.scene as any).requestRender();
          }
        }
      }
    } catch (e) {
      console.warn('enableContinuousRenderingIfNeeded failed', e);
    }
  }

  /**
   * 在绘制完成或取消时恢复 requestRenderMode 到原始状态（如果曾被修改过）。
   */
  protected restoreRequestRenderModeIfNeeded(): void {
    try {
      if (this.originalRequestRenderMode !== null) {
        if (this.originalRequestRenderMode === true) {
          this.scene.requestRenderMode = true;
          if (typeof (this.scene as any).requestRender === 'function') {
            (this.scene as any).requestRender();
          }
        }
      }
    } catch (e) {
      console.warn('restoreRequestRenderModeIfNeeded failed', e);
    } finally {
      this.originalRequestRenderMode = null;
    }
  }

  /**
   * 添加一个点到临时位置数组并创建点实体
   */
  protected addPoint(position: Cesium.Cartesian3): void {
    this.tempPositions.push(position.clone());

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
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    this.tempEntities.push(pointEntity);
  }

  /**
   * 创建总长/面积标签图片
   */
  protected createTotalLengthBillboardImage(text: string): HTMLCanvasElement {
    const paddingX = 12;
    const paddingY = 6;
    const font = "bold 16px 'Microsoft YaHei', 'PingFang SC', sans-serif";

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.width = 1;
      canvas.height = 1;
      return canvas;
    }

    ctx.font = font;
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = 20;

    canvas.width = Math.ceil(textWidth + paddingX * 2);
    canvas.height = Math.ceil(textHeight + paddingY * 2);

    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    return canvas;
  }

  /**
   * 创建分段长度标签图片
   */
  protected createSegmentLengthBillboardImage(text: string): HTMLCanvasElement {
    return this.createTotalLengthBillboardImage(text);
  }

  /**
   * 清理临时实体
   */
  protected clearTempEntities(): void {
    this.tempEntities.forEach((entity) => {
      if (entity) {
        this.entities.remove(entity);
      }
    });
    this.tempEntities = [];

    this.tempLabelEntities.forEach((entity) => {
      if (entity) {
        this.entities.remove(entity);
      }
    });
    this.tempLabelEntities = [];
  }

  // 其余公共方法（如有需要可在子类中覆盖）
}

/**
 * 静态工具方法：切换实体的选中样式
 * 用于避免在多个模块中重复实现相同逻辑
 */
export function toggleSelectedStyle(entity: DrawEntity): void {
  try {
    const opts = entity._drawOptions as DrawOptions | undefined;
    const sel = opts?.selected;
    if (!sel) return;

    // 已选中则恢复
    if (entity._isSelected) {
      const orig = entity._originalStyle;
      if (!orig) {
        entity._isSelected = false;
        return;
      }
      if (entity.polyline && orig.material) {
        entity.polyline.material = orig.material;
        entity.polyline.width = orig.width ?? entity.polyline.width;
      }
      if (entity.polygon && orig.material) {
        entity.polygon.material = orig.material;
        entity.polygon.outlineColor = orig.outlineColor ?? entity.polygon.outlineColor;
        entity.polygon.outlineWidth = orig.outlineWidth ?? entity.polygon.outlineWidth;
      }
      if (entity.rectangle && orig.material) {
        entity.rectangle.material = orig.material;
        entity.rectangle.outlineColor = orig.outlineColor ?? entity.rectangle.outlineColor;
        entity.rectangle.outlineWidth = orig.outlineWidth ?? entity.rectangle.outlineWidth;
      }
      if (entity.ellipse && orig.material) {
        entity.ellipse.material = orig.material;
        entity.ellipse.outlineColor = orig.outlineColor ?? entity.ellipse.outlineColor;
        entity.ellipse.outlineWidth = orig.outlineWidth ?? entity.ellipse.outlineWidth;
      }
      entity._isSelected = false;
      return;
    }

    // 首次选中：保存原始样式
    if (!entity._originalStyle) {
      entity._originalStyle = {};
      if (entity.polyline) {
        entity._originalStyle.material = entity.polyline.material;
        entity._originalStyle.width = entity.polyline.width;
      }
      if (entity.polygon) {
        entity._originalStyle.material = entity.polygon.material;
        entity._originalStyle.outlineColor = entity.polygon.outlineColor;
        entity._originalStyle.outlineWidth = entity.polygon.outlineWidth;
      }
      if (entity.rectangle) {
        entity._originalStyle.material = entity.rectangle.material;
        entity._originalStyle.outlineColor = entity.rectangle.outlineColor;
        entity._originalStyle.outlineWidth = entity.rectangle.outlineWidth;
      }
      if (entity.ellipse) {
        entity._originalStyle.material = entity.ellipse.material;
        entity._originalStyle.outlineColor = entity.ellipse.outlineColor;
        entity._originalStyle.outlineWidth = entity.ellipse.outlineWidth;
      }
    }

    const resolveColor = (input?: Cesium.Color | string): Cesium.Color => {
      try {
        if (!input) return Cesium.Color.YELLOW;
        if (input instanceof Cesium.Color) return input;
        return Cesium.Color.fromCssColorString(String(input));
      } catch {
        return Cesium.Color.YELLOW;
      }
    };

    // 应用高亮样式
    if (entity.polyline) {
      const color = sel.color ? resolveColor(sel.color) : Cesium.Color.YELLOW;
      const width = sel.width ?? ((entity.polyline.width as any) || 5) + 2;
      entity.polyline.material = new Cesium.ColorMaterialProperty(color);
      entity.polyline.width = new Cesium.ConstantProperty(width);
    }

    if (entity.polygon) {
      const color = sel.color ? resolveColor(sel.color) : Cesium.Color.YELLOW;
      entity.polygon.material = new Cesium.ColorMaterialProperty(color.withAlpha(0.5));
      entity.polygon.outlineColor = new Cesium.ConstantProperty(
        sel.outlineColor ? resolveColor(sel.outlineColor) : resolveColor('#ffffff')
      );
      entity.polygon.outlineWidth = new Cesium.ConstantProperty(
        sel.outlineWidth ?? ((entity.polygon.outlineWidth as any) || 2)
      );
    }

    if (entity.rectangle) {
      const color = sel.color ? resolveColor(sel.color) : Cesium.Color.YELLOW;
      entity.rectangle.material = new Cesium.ColorMaterialProperty(color.withAlpha(0.5));
      entity.rectangle.outlineColor = new Cesium.ConstantProperty(
        sel.outlineColor ? resolveColor(sel.outlineColor) : resolveColor('#ffffff')
      );
      entity.rectangle.outlineWidth = new Cesium.ConstantProperty(
        sel.outlineWidth ?? ((entity.rectangle.outlineWidth as any) || 2)
      );
    }

    if (entity.ellipse) {
      const color = sel.color ? resolveColor(sel.color) : Cesium.Color.YELLOW;
      entity.ellipse.material = new Cesium.ColorMaterialProperty(color.withAlpha(0.5));
      entity.ellipse.outlineColor = new Cesium.ConstantProperty(
        sel.outlineColor ? resolveColor(sel.outlineColor) : resolveColor('#ffffff')
      );
      entity.ellipse.outlineWidth = new Cesium.ConstantProperty(
        sel.outlineWidth ?? ((entity.ellipse.outlineWidth as any) || 2)
      );
    }

    entity._isSelected = true;
  } catch (e) {
    console.warn('toggleSelectedStyle failed', e);
  }
}


