/**
 * 测量按钮处理器
 * 处理测量功能的按钮点击、菜单显示等逻辑
 */

import { BaseButtonHandler } from './BaseButtonHandler';
import type { ToolbarButton } from '../../../../components/ToolbarButton';
import { MeasureMenu } from '../menus/MeasureMenu';
import { calculatePolygonArea, calculateTotalDistance } from '../../draw/geometry/drawGeometry';
import type { MeasurementCompleteEvent, MeasurementServiceLike } from '../types';

type MeasurementMode = 'distance' | 'area' | null;

interface DrawCompletionResult {
  positions?: any[];
}

interface LegacyMeasureCompleteResult {
  type?: 'line' | 'polygon' | 'rectangle' | 'circle';
  positions?: any[];
}

/**
 * 测量按钮处理器配置
 */
export interface MeasureButtonHandlerOptions {
  /** 测量服务实例 */
  measurementService?: MeasurementServiceLike;
  
  /** 绘图助手实例 */
  drawHelper?: any;
  
  /** 测距开始回调 */
  onDistanceStart?: () => void;

  /** 测距绘制选项 */
  getDistanceDrawOptions?: () => any;
  
  /** 测面积开始回调 */
  onAreaStart?: () => void;

  /** 测面积绘制选项 */
  getAreaDrawOptions?: () => any;

  /** 测距完成回调 */
  onDistanceComplete?: (positions: any[], distance: number) => void;

  /** 测面积完成回调 */
  onAreaComplete?: (positions: any[], area: number) => void;
  
  /** 清除测量回调 */
  onClear?: () => void;
}

/**
 * 测量按钮处理器类
 */
export class MeasureButtonHandler extends BaseButtonHandler {
  readonly id = 'measure';
  
  private menu: MeasureMenu | null = null;
  private options: MeasureButtonHandlerOptions;
  private activeMeasurementMode: MeasurementMode = null;
  private boundMeasurementService: MeasurementServiceLike | null = null;
  private boundDrawHelper: any = null;

  /**
   * 构造函数
   * @param viewer Cesium Viewer 实例
   * @param options 配置选项
   * @param i18n 国际化实例
   * @param useI18n 是否使用国际化
   */
  constructor(
    viewer: any,
    options: MeasureButtonHandlerOptions = {},
    i18n?: any,
    useI18n: boolean = true
  ) {
    super('measure', viewer, i18n, useI18n);
    this.options = options;
    this.bindMeasurementServiceCallbacks();
    this.bindDrawCallbacks();
  }

  updateOptions(options: Partial<MeasureButtonHandlerOptions>): void {
    this.options = {
      ...this.options,
      ...options,
    };
    this.bindMeasurementServiceCallbacks();
    this.bindDrawCallbacks();
  }

  /**
   * 初始化按钮
   * @param button 按钮实例
   */
  initialize(button: ToolbarButton): void {
    this.button = button;
    
    // 设置按钮标题
    if (this.useI18n && this.i18n) {
      this.i18n.bindElement(button.getElement(), 'toolbar.measure', 'title');
    } else {
      button.setAttribute('title', '测量');
    }
  }

  /**
   * 处理点击事件
   */
  handleClick(): void {
    if (!this.toolbarElement || !this.button) return;

    const buttonElement = this.button.getElement();

    // 切换菜单显示
    if (this.menu && this.menu['menuElement']) {
      this.menu.hide();
      this.deactivateButton();
    } else {
      this.showMenu(buttonElement);
      this.activateButton();
    }
  }

  /**
   * 处理鼠标进入事件
   */
  handleMouseEnter(): void {
    // 可以在这里添加悬停提示
  }

  /**
   * 处理鼠标离开事件
   */
  handleMouseLeave(): void {
    // 延迟关闭菜单，给用户时间移动到菜单上
    if (this.menu && this.menu['menuElement']) {
      setTimeout(() => {
        const menuEl = this.menu!['menuElement'];
        if (menuEl && !menuEl.matches(':hover')) {
          this.menu?.hide();
          this.deactivateButton();
        }
      }, 100);
    }
  }

  /**
   * 销毁处理器
   */
  destroy(): void {
    if (this.menu) {
      this.menu.destroy();
      this.menu = null;
    }
    this.activeMeasurementMode = null;
    this.boundMeasurementService = null;
    this.boundDrawHelper = null;
    this.button = null;
  }

  private bindMeasurementServiceCallbacks(): void {
    const { measurementService } = this.options;
    if (!measurementService || this.boundMeasurementService === measurementService) {
      return;
    }

    measurementService.onMeasurementComplete?.((event: MeasurementCompleteEvent) => {
      this.handleMeasurementComplete(event);
    });
    measurementService.onClearComplete?.(() => {
      this.handleClearComplete();
    });
    this.boundMeasurementService = measurementService;
  }

  private bindDrawCallbacks(): void {
    const { drawHelper, measurementService } = this.options;
    if (measurementService || !drawHelper || this.boundDrawHelper === drawHelper) {
      return;
    }

    if (typeof drawHelper.onMeasureComplete === 'function') {
      drawHelper.onMeasureComplete((result: LegacyMeasureCompleteResult | null) => {
        this.handleLegacyMeasureComplete(result);
      });
      this.boundDrawHelper = drawHelper;
      return;
    }

    if (typeof drawHelper.onDrawEnd !== 'function') {
      return;
    }

    drawHelper.onDrawEnd((result: DrawCompletionResult | null) => {
      this.handleDrawComplete(result);
    });
    this.boundDrawHelper = drawHelper;
  }

  private handleMeasurementComplete(event: MeasurementCompleteEvent): void {
    this.activeMeasurementMode = null;

    if (!Array.isArray(event.positions)) {
      return;
    }

    if (event.type === 'distance') {
      this.options.onDistanceComplete?.(event.positions, event.value);
      return;
    }

    this.options.onAreaComplete?.(event.positions, event.value);
  }

  private handleClearComplete(): void {
    this.activeMeasurementMode = null;
    this.options.onClear?.();
  }

  private handleLegacyMeasureComplete(result: LegacyMeasureCompleteResult | null): void {
    this.activeMeasurementMode = null;

    if (!result || !Array.isArray(result.positions)) {
      return;
    }

    if (result.type === 'line') {
      this.options.onDistanceComplete?.(result.positions, calculateTotalDistance(result.positions));
      return;
    }

    if (result.type === 'polygon' || result.type === 'rectangle' || result.type === 'circle') {
      this.options.onAreaComplete?.(result.positions, calculatePolygonArea(result.positions));
    }
  }

  private handleDrawComplete(result: DrawCompletionResult | null): void {
    const mode = this.activeMeasurementMode;
    this.activeMeasurementMode = null;

    if (!result || !mode || !Array.isArray(result.positions)) {
      return;
    }

    if (mode === 'distance') {
      this.options.onDistanceComplete?.(result.positions, calculateTotalDistance(result.positions));
      return;
    }

    this.options.onAreaComplete?.(result.positions, calculatePolygonArea(result.positions));
  }

  /**
   * 显示测量菜单
   * @param anchor 锚点元素
   */
  private showMenu(anchor: HTMLElement): void {
    if (!this.toolbarElement) return;

    // 关闭其他菜单
    this.closeOtherMenus('measure');

    // 创建菜单
    this.menu = new MeasureMenu(
      this.toolbarElement,
      {
        onDistanceStart: () => this.startDistanceMeasurement(),
        onAreaStart: () => this.startAreaMeasurement(),
        onClear: () => this.clearMeasurements(),
      },
      this.i18n,
      this.useI18n
    );

    this.menu.show(anchor);
  }

  /**
   * 开始测距
   */
  private startDistanceMeasurement(): void {
    const { measurementService, drawHelper, onDistanceStart, getDistanceDrawOptions } = this.options;
    const drawOptions = getDistanceDrawOptions?.();
    this.activeMeasurementMode = 'distance';
    
    if (measurementService) {
      measurementService.startDistanceMeasurement(drawOptions);
    } else if (drawHelper) {
      if (typeof drawHelper.startDrawingLine === 'function') {
        drawHelper.startDrawingLine(drawOptions);
      } else {
        drawHelper.startDrawing?.('line', drawOptions);
      }
    }
    
    onDistanceStart?.();
    this.menu?.hide();
    this.deactivateButton();
  }

  /**
   * 开始测面积
   */
  private startAreaMeasurement(): void {
    const { measurementService, drawHelper, onAreaStart, getAreaDrawOptions } = this.options;
    const drawOptions = getAreaDrawOptions?.();
    this.activeMeasurementMode = 'area';
    
    if (measurementService) {
      measurementService.startAreaMeasurement(drawOptions);
    } else if (drawHelper) {
      if (typeof drawHelper.startDrawingPolygon === 'function') {
        drawHelper.startDrawingPolygon(drawOptions);
      } else {
        drawHelper.startDrawing?.('polygon', drawOptions);
      }
    }
    
    onAreaStart?.();
    this.menu?.hide();
    this.deactivateButton();
  }

  /**
   * 清除测量
   */
  private clearMeasurements(): void {
    const { measurementService, drawHelper, onClear } = this.options;
    this.activeMeasurementMode = null;
    
    if (measurementService) {
      measurementService.clearMeasurements();
    } else if (drawHelper) {
      if (typeof drawHelper.clearAll === 'function') {
        drawHelper.clearAll();
      } else {
        drawHelper.clear?.();
      }
      onClear?.();
    }

    this.menu?.hide();
  }

  /**
   * 隐藏菜单
   */
  hideMenu(): void {
    if (this.menu) {
      this.menu.hide();
      this.deactivateButton();
    }
  }
}