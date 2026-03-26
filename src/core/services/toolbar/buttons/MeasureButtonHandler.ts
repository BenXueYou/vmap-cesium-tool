/**
 * 测量按钮处理器
 * 处理测量功能的按钮点击、菜单显示等逻辑
 */

import { BaseButtonHandler } from './BaseButtonHandler';
import type { ToolbarButton } from '../../../../components/ToolbarButton';
import { MeasureMenu } from '../menus/MeasureMenu';

/**
 * 测量按钮处理器配置
 */
export interface MeasureButtonHandlerOptions {
  /** 测量服务实例 */
  measurementService?: any;
  
  /** 绘图助手实例 */
  drawHelper?: any;
  
  /** 测距开始回调 */
  onDistanceStart?: () => void;
  
  /** 测面积开始回调 */
  onAreaStart?: () => void;
  
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
  }

  updateOptions(options: Partial<MeasureButtonHandlerOptions>): void {
    this.options = {
      ...this.options,
      ...options,
    };
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
    this.button = null;
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
    const { measurementService, drawHelper, onDistanceStart } = this.options;
    
    if (measurementService) {
      measurementService.startDistanceMeasurement();
    } else if (drawHelper) {
      drawHelper.startDrawing('line');
    }
    
    onDistanceStart?.();
    this.menu?.hide();
    this.deactivateButton();
  }

  /**
   * 开始测面积
   */
  private startAreaMeasurement(): void {
    const { measurementService, drawHelper, onAreaStart } = this.options;
    
    if (measurementService) {
      measurementService.startAreaMeasurement();
    } else if (drawHelper) {
      drawHelper.startDrawing('polygon');
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
    
    if (measurementService) {
      measurementService.clearMeasurements();
    } else if (drawHelper) {
      drawHelper.clear();
    }
    
    onClear?.();
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