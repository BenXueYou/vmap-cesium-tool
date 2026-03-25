import * as Cesium from 'cesium';
import type { Viewer, Entity, Cartesian3 } from 'cesium';
import { DrawService, type DrawMode, type DrawOptions as NewDrawOptions, type DrawResult } from '../core/services/draw/DrawService';

/**
 * 旧版绘制回调接口（保持向后兼容）
 */
export interface LegacyDrawCallbacks {
  onDrawStart?: () => void;
  onDrawEnd?: (entity: Entity | null) => void;
  onEntityRemoved?: (entity: Entity) => void;
  onMeasureComplete?: (result: {
    type: 'line' | 'polygon' | 'rectangle' | 'circle';
    positions: Cartesian3[];
    distance?: number;
    areaKm2?: number;
  }) => void;
}

/**
 * 旧版绘制选项接口（保持向后兼容）
 */
export interface LegacyDrawOptions {
  lineColor?: Cesium.Color | string;
  lineWidth?: number;
  fillColor?: Cesium.Color | string;
  clampToGround?: boolean;
  onClick?: (entity: Entity, positions?: Cartesian3[]) => void;
}

/**
 * 旧版绘制实体类型（保持向后兼容）
 */
export interface LegacyDrawEntity extends Entity {
  _drawType?: string;
  _drawOptions?: LegacyDrawOptions;
  _groundPositions?: Cartesian3[];
  _groundPosition?: Cartesian3;
  _labelEntities?: Entity[];
}

/**
 * 新旧模式映射
 */
const MODE_MAP: Record<string, DrawMode> = {
  'line': 'line',
  'polygon': 'polygon',
  'rectangle': 'rectangle',
  'circle': 'circle',
  'point': 'point',
};

/**
 * DrawHelper 适配器
 * 
 * 基于新的 DrawService 架构，提供与旧版 DrawHelper 兼容的 API。
 * 用于平滑迁移，让现有代码无需修改即可使用新架构。
 * 
 * @example
 * ```typescript
 * // 旧代码可以继续使用，无需修改
 * const drawHelper = new DrawHelperAdapter(viewer);
 * drawHelper.startDrawingLine({ lineColor: '#FF0000' });
 * ```
 */
export class DrawHelperAdapter {
  private viewer: Viewer;
  private drawService: DrawService;
  private callbacks: LegacyDrawCallbacks | null = null;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.drawService = new DrawService(viewer);
    
    // 设置回调转发
    this.drawService.onDrawStart(() => {
      this.callbacks?.onDrawStart?.();
    });
    
    this.drawService.onDrawEnd((result) => {
      this.callbacks?.onDrawEnd?.(result?.entity ?? null);
      
      if (result && this.callbacks?.onMeasureComplete) {
        const type = this.mapDrawModeToType(this.drawService.getCurrentDrawMode());
        this.callbacks.onMeasureComplete({
          type,
          positions: result.positions,
        });
      }
    });
    
    this.drawService.onEntityRemoved((entity) => {
      this.callbacks?.onEntityRemoved?.(entity);
    });
  }

  /**
   * 映射绘制模式到类型字符串
   */
  private mapDrawModeToType(mode: DrawMode): 'line' | 'polygon' | 'rectangle' | 'circle' {
    switch (mode) {
      case 'line': return 'line';
      case 'polygon': return 'polygon';
      case 'rectangle': return 'rectangle';
      case 'circle': return 'circle';
      default: return 'polygon';
    }
  }

  /**
   * 转换选项格式
   */
  private convertOptions(options: LegacyDrawOptions = {}): NewDrawOptions {
    return {
      lineColor: options.lineColor,
      lineWidth: options.lineWidth,
      fillColor: options.fillColor,
      clampToGround: options.clampToGround,
      onClick: options.onClick,
    };
  }

  // ==================== 公共 API（保持与旧版兼容） ====================

  /**
   * 开始绘制线
   */
  startDrawingLine(options: LegacyDrawOptions = {}): void {
    this.drawService.startDrawing('line', this.convertOptions(options));
  }

  /**
   * 开始绘制多边形
   */
  startDrawingPolygon(options: LegacyDrawOptions = {}): void {
    this.drawService.startDrawing('polygon', this.convertOptions(options));
  }

  /**
   * 开始绘制矩形
   */
  startDrawingRectangle(options: LegacyDrawOptions = {}): void {
    this.drawService.startDrawing('rectangle', this.convertOptions(options));
  }

  /**
   * 开始绘制圆形
   */
  startDrawingCircle(options: LegacyDrawOptions = {}): void {
    this.drawService.startDrawing('circle', this.convertOptions(options));
  }

  /**
   * 结束绘制
   */
  endDrawing(): void {
    this.drawService.endDrawing();
  }

  /**
   * 取消绘制
   */
  cancelDrawing(): void {
    this.drawService.cancelDrawing();
  }

  /**
   * 清除所有绘制
   */
  clearAll(): void {
    this.drawService.clearAll();
  }

  /**
   * 删除指定实体
   */
  removeEntity(entity: Entity): void {
    this.drawService.removeEntity(entity);
  }

  /**
   * 获取已完成的实体
   */
  getFinishedEntities(): Entity[] {
    return this.drawService.getFinishedEntities();
  }

  /**
   * 检查是否正在绘制
   */
  isDrawing(): boolean {
    return this.drawService.isDrawingMode();
  }

  /**
   * 获取当前绘制模式
   */
  getCurrentDrawMode(): DrawMode {
    return this.drawService.getCurrentDrawMode();
  }

  /**
   * 设置绘制开始回调
   */
  onDrawStart(callback: () => void): void {
    this.callbacks = { ...this.callbacks, onDrawStart: callback };
  }

  /**
   * 设置绘制结束回调
   */
  onDrawEnd(callback: (entity: Entity | null) => void): void {
    this.callbacks = { ...this.callbacks, onDrawEnd: callback };
  }

  /**
   * 设置实体移除回调
   */
  onEntityRemoved(callback: (entity: Entity) => void): void {
    this.callbacks = { ...this.callbacks, onEntityRemoved: callback };
  }

  /**
   * 设置测量完成回调
   */
  onMeasureComplete(callback: (result: {
    type: 'line' | 'polygon' | 'rectangle' | 'circle';
    positions: Cartesian3[];
    distance?: number;
    areaKm2?: number;
  }) => void): void {
    this.callbacks = { ...this.callbacks, onMeasureComplete: callback };
  }

  /**
   * 销毁助手
   */
  destroy(): void {
    this.drawService.destroy();
  }
}

/**
 * 创建 DrawHelperAdapter 的工厂函数
 */
export function createDrawHelperAdapter(viewer: Viewer): DrawHelperAdapter {
  return new DrawHelperAdapter(viewer);
}