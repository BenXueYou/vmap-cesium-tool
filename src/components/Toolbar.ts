import { BaseComponent } from './BaseComponent';
import { ToolbarButton, createToolbarButton } from './ToolbarButton';
import type { ToolbarConfig, CustomButtonConfig, StyleConfig } from '../core/types';
import { DEFAULT_TOOLBAR_STYLE } from '../core/services/toolbar/config';

/**
 * 工具栏组件
 */
export class Toolbar extends BaseComponent {
  private config: ToolbarConfig;
  private buttons: Map<string, ToolbarButton> = new Map();
  private buttonContainer: HTMLElement;

  /**
   * 构造函数
   * @param config 工具栏配置
   * @param styleConfig 样式配置
   */
  constructor(config: Partial<ToolbarConfig> = {}, styleConfig: StyleConfig = {}) {
    const mergedConfig = { ...DEFAULT_TOOLBAR_STYLE, ...config };
    const position = mergedConfig.position;
    const direction = mergedConfig.direction ?? 'column';
    
    super('div', {
      className: 'vmap-toolbar',
      style: {
        position: 'absolute',
        background: mergedConfig.backgroundColor,
        border: `${mergedConfig.borderWidth ?? 1}px solid ${mergedConfig.borderColor}`,
        borderRadius: `${mergedConfig.borderRadius}px`,
        boxShadow: mergedConfig.boxShadow,
        padding: mergedConfig.padding,
        zIndex: mergedConfig.zIndex.toString(),
        display: 'flex',
        flexDirection: direction,
        gap: `${mergedConfig.buttonSpacing}px`,
        ...Toolbar.getPositionStyle(mergedConfig),
        ...styleConfig.style,
      },
      ...styleConfig,
    });

    this.config = mergedConfig;
    this.buttonContainer = document.createElement('div');
    this.buttonContainer.style.display = 'flex';
    this.buttonContainer.style.flexDirection = direction;
    this.buttonContainer.style.gap = `${this.config.buttonSpacing}px`;
    this.element.appendChild(this.buttonContainer);

    // 应用配置
    this.applyConfig();
  }

  /**
   * 获取位置样式（静态方法）
   */
  private static getPositionStyle(config: ToolbarConfig): Partial<CSSStyleDeclaration> {
    const style: Partial<CSSStyleDeclaration> = {};
    const position = config.position;
    const offsetTop = `${config.offsetTop ?? 10}px`;
    const offsetRight = `${config.offsetRight ?? 10}px`;
    const offsetBottom = `${config.offsetBottom ?? 10}px`;
    const offsetLeft = `${config.offsetLeft ?? 10}px`;

    switch (position) {
      case 'top-right':
        style.top = offsetTop;
        style.right = offsetRight;
        break;
      case 'top-left':
        style.top = offsetTop;
        style.left = offsetLeft;
        break;
      case 'bottom-right':
        style.bottom = offsetBottom;
        style.right = offsetRight;
        break;
      case 'bottom-left':
        style.bottom = offsetBottom;
        style.left = offsetLeft;
        break;
      default:
        style.bottom = offsetBottom;
        style.right = offsetRight;
    }

    return style;
  }

  /**
   * 获取位置样式（实例方法）
   */
  private getPositionStyle(config: ToolbarConfig): Partial<CSSStyleDeclaration> {
    return Toolbar.getPositionStyle(config);
  }

  /**
   * 应用配置
   */
  private applyConfig(): void {
    // 更新工具栏样式
    Object.assign(this.element.style, {
      background: this.config.backgroundColor,
      border: `${this.config.borderWidth ?? 1}px solid ${this.config.borderColor}`,
      borderRadius: `${this.config.borderRadius}px`,
      boxShadow: this.config.boxShadow,
      padding: this.config.padding ?? DEFAULT_TOOLBAR_STYLE.padding,
      zIndex: this.config.zIndex?.toString() || '1000',
      flexDirection: this.config.direction ?? DEFAULT_TOOLBAR_STYLE.direction,
    });

    // 更新按钮容器间隙
    this.buttonContainer.style.gap = `${this.config.buttonSpacing}px`;
    this.buttonContainer.style.flexDirection = this.config.direction ?? DEFAULT_TOOLBAR_STYLE.direction;

    // 更新位置
    this.element.style.top = '';
    this.element.style.right = '';
    this.element.style.bottom = '';
    this.element.style.left = '';
    Object.assign(this.element.style, this.getPositionStyle(this.config));
  }

  /**
   * 添加按钮
   * @param buttonConfig 按钮配置
   * @returns 创建的按钮实例
   */
  addButton(buttonConfig: CustomButtonConfig): ToolbarButton {
    const button = createToolbarButton(buttonConfig, {
      style: {
        width: `${this.config.buttonSize}px`,
        height: `${this.config.buttonSize}px`,
      },
    });

    this.buttons.set(buttonConfig.id, button);
    this.buttonContainer.appendChild(button.getElement());

    // 排序按钮
    this.sortButtons();

    return button;
  }

  /**
   * 移除按钮
   * @param buttonId 按钮ID
   */
  removeButton(buttonId: string): boolean {
    const button = this.buttons.get(buttonId);
    if (!button) return false;

    button.destroy();
    this.buttons.delete(buttonId);
    return true;
  }

  /**
   * 获取按钮
   * @param buttonId 按钮ID
   */
  getButton(buttonId: string): ToolbarButton | undefined {
    return this.buttons.get(buttonId);
  }

  /**
   * 获取所有按钮
   */
  getButtons(): ToolbarButton[] {
    return Array.from(this.buttons.values());
  }

  /**
   * 更新按钮配置
   * @param buttonId 按钮ID
   * @param config 新的按钮配置
   */
  updateButton(buttonId: string, config: Partial<CustomButtonConfig>): boolean {
    const button = this.buttons.get(buttonId);
    if (!button) return false;

    button.updateConfig(config);

    // 如果排序号改变，重新排序
    if (config.sort !== undefined) {
      this.sortButtons();
    }

    return true;
  }

  /**
   * 排序按钮
   */
  private sortButtons(): void {
    const buttons = Array.from(this.buttons.entries());
    
    // 按排序号排序
    buttons.sort(([, a], [, b]) => {
      const sortA = a.getConfig().sort ?? 999;
      const sortB = b.getConfig().sort ?? 999;
      return sortA - sortB;
    });

    // 清空容器并重新添加
    this.buttonContainer.innerHTML = '';
    buttons.forEach(([, button]) => {
      this.buttonContainer.appendChild(button.getElement());
    });
  }

  /**
   * 启用按钮
   * @param buttonId 按钮ID
   */
  enableButton(buttonId: string): boolean {
    const button = this.buttons.get(buttonId);
    if (!button) return false;

    button.enable();
    return true;
  }

  /**
   * 禁用按钮
   * @param buttonId 按钮ID
   */
  disableButton(buttonId: string): boolean {
    const button = this.buttons.get(buttonId);
    if (!button) return false;

    button.disable();
    return true;
  }

  /**
   * 显示按钮
   * @param buttonId 按钮ID
   */
  showButton(buttonId: string): boolean {
    const button = this.buttons.get(buttonId);
    if (!button) return false;

    button.show();
    return true;
  }

  /**
   * 隐藏按钮
   * @param buttonId 按钮ID
   */
  hideButton(buttonId: string): boolean {
    const button = this.buttons.get(buttonId);
    if (!button) return false;

    button.hide();
    return true;
  }

  /**
   * 激活按钮
   * @param buttonId 按钮ID
   */
  activateButton(buttonId: string): boolean {
    const button = this.buttons.get(buttonId);
    if (!button) return false;

    button.activate();
    return true;
  }

  /**
   * 取消激活按钮
   * @param buttonId 按钮ID
   */
  deactivateButton(buttonId: string): boolean {
    const button = this.buttons.get(buttonId);
    if (!button) return false;

    button.deactivate();
    return true;
  }

  /**
   * 更新工具栏配置
   * @param config 新的工具栏配置
   */
  updateConfig(config: Partial<ToolbarConfig>): void {
    this.config = { ...this.config, ...config };
    this.applyConfig();

    // 如果按钮大小改变，更新所有按钮
    if (config.buttonSize !== undefined) {
      this.buttons.forEach(button => {
        const buttonConfig = button.getConfig();
        button.updateConfig({
          ...buttonConfig,
          size: config.buttonSize,
        });
      });
    }
  }

  /**
   * 获取工具栏配置
   */
  getConfig(): ToolbarConfig {
    return { ...this.config };
  }

  /**
   * 清空所有按钮
   */
  clearButtons(): void {
    this.buttons.forEach(button => button.destroy());
    this.buttons.clear();
    this.buttonContainer.innerHTML = '';
  }

  /**
   * 添加多个按钮
   * @param buttonConfigs 按钮配置数组
   */
  addButtons(buttonConfigs: CustomButtonConfig[]): ToolbarButton[] {
    return buttonConfigs.map(config => this.addButton(config));
  }

  /**
   * 销毁工具栏
   */
  destroy(): void {
    this.clearButtons();
    super.destroy();
  }
}

/**
 * 创建工具栏的工厂函数
 */
export function createToolbar(config?: Partial<ToolbarConfig>, styleConfig?: StyleConfig): Toolbar {
  return new Toolbar(config, styleConfig);
}