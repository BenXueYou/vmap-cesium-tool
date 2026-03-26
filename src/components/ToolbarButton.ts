import { BaseComponent } from './BaseComponent';
import type { CustomButtonConfig, StyleConfig } from '../core/types';

/**
 * 工具栏按钮组件
 */
export class ToolbarButton extends BaseComponent {
  private config: CustomButtonConfig;
  private onClickHandler?: (buttonId: string, buttonElement: HTMLElement) => void;
  private isActive = false;

  /**
   * 构造函数
   * @param config 按钮配置
   * @param styleConfig 样式配置
   */
  constructor(config: CustomButtonConfig, styleConfig: StyleConfig = {}) {
    super('button', {
      className: 'vmap-toolbar-button',
      style: {
        width: `${config.size || 40}px`,
        height: `${config.size || 40}px`,
        backgroundColor: config.backgroundColor || 'rgba(66, 133, 244, 0.4)',
        color: config.color || 'white',
        border: `${config.borderWidth || 1}px ${config.borderStyle || 'solid'} ${config.borderColor || 'transparent'}`,
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        fontWeight: 'bold',
        transition: 'all 0.2s ease',
        userSelect: 'none',
        padding: config.padding || '0',
        ...styleConfig.style,
      },
    });

    this.config = config;
    this.onClickHandler = config.onClick;
    this.setupButton();
  }

  /**
   * 设置按钮
   */
  private setupButton(): void {
    // 设置按钮ID
    this.setAttribute('data-button-id', this.config.id);

    // 设置标题
    this.setAttribute('title', this.config.title);

    // 设置图标
    this.setIcon(this.config.icon);

    // 添加点击事件
    this.addEventListener('click', this.handleClick.bind(this));

    // 添加鼠标事件
    this.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
    this.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
  }

  /**
   * 设置图标
   * @param icon 图标配置
   */
  private setIcon(icon: string | HTMLElement | false): void {
    // 清空现有内容
    this.element.innerHTML = '';

    if (icon === false) {
      // 无图标，只显示文字
      const text = document.createElement('span');
      text.textContent = this.config.title;
      text.style.fontSize = '12px';
      this.element.appendChild(text);
      return;
    }

    if (typeof icon === 'string') {
      if (this.isImagePath(icon)) {
        // 图片图标
        const img = document.createElement('img');
        img.src = icon;
        img.alt = this.config.title;
        img.style.width = '70%';
        img.style.height = '70%';
        img.style.objectFit = 'contain';
        this.element.appendChild(img);
      } else {
        // 文字图标
        this.element.textContent = icon;
      }
    } else if (icon instanceof HTMLElement) {
      // HTML元素图标
      this.element.appendChild(icon);
    }
  }

  /**
   * 判断是否为图片路径
   */
  private isImagePath(icon: string): boolean {
    return /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(icon) || icon.startsWith('data:image');
  }

  /**
   * 处理点击事件
   */
  private handleClick(event: Event): void {
    event.stopPropagation();

    if (this.config.callback) {
      this.config.callback();
    }

    if (this.onClickHandler) {
      this.onClickHandler(this.config.id, this.element);
    }

    // 触发自定义事件
    const customEvent = new CustomEvent('button-click', {
      detail: {
        buttonId: this.config.id,
        buttonElement: this.element,
        config: this.config,
      },
      bubbles: true,
    });
    this.element.dispatchEvent(customEvent);
  }

  /**
   * 处理鼠标进入事件
   */
  private handleMouseEnter(): void {
    const hoverColor = this.config.hoverColor || 'rgba(51, 103, 214, 0.9)';
    this.element.style.backgroundColor = hoverColor;
    this.element.style.transform = 'scale(1.05)';
  }

  /**
   * 处理鼠标离开事件
   */
  private handleMouseLeave(): void {
    this.element.style.backgroundColor = this.config.backgroundColor || 'rgba(66, 133, 244, 0.4)';
    this.element.style.transform = 'scale(1)';
  }

  /**
   * 激活按钮
   */
  activate(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.addClass('active');
    
    const activeColor = this.config.activeColor || 'rgba(26, 115, 232, 0.9)';
    this.element.style.backgroundColor = activeColor;

    // 切换为激活图标
    if (this.config.activeIcon) {
      this.setIcon(this.config.activeIcon);
    }
  }

  /**
   * 取消激活按钮
   */
  deactivate(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.removeClass('active');
    this.element.style.backgroundColor = this.config.backgroundColor || 'rgba(66, 133, 244, 0.4)';

    // 恢复为普通图标
    this.setIcon(this.config.icon);
  }

  /**
   * 切换激活状态
   */
  toggleActive(): void {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  /**
   * 启用按钮
   */
  enable(): void {
    this.config.enabled = true;
    this.element.style.opacity = '1';
    this.element.style.cursor = 'pointer';
    this.element.style.pointerEvents = 'auto';
  }

  /**
   * 禁用按钮
   */
  disable(): void {
    this.config.enabled = false;
    this.element.style.opacity = '0.5';
    this.element.style.cursor = 'not-allowed';
    this.element.style.pointerEvents = 'none';
  }

  /**
   * 显示按钮
   */
  show(): void {
    this.config.visible = true;
    super.show();
  }

  /**
   * 隐藏按钮
   */
  hide(): void {
    this.config.visible = false;
    super.hide();
  }

  /**
   * 更新按钮配置
   * @param config 新的按钮配置
   */
  updateConfig(config: Partial<CustomButtonConfig>): void {
    this.config = { ...this.config, ...config };

    // 更新样式
    if (config.size || config.backgroundColor || config.color || config.borderColor || config.borderWidth) {
      const newStyle: Partial<CSSStyleDeclaration> = {};
      
      if (config.size) {
        newStyle.width = `${config.size}px`;
        newStyle.height = `${config.size}px`;
      }
      
      if (config.backgroundColor) {
        newStyle.backgroundColor = config.backgroundColor;
      }
      
      if (config.color) {
        newStyle.color = config.color;
      }
      
      if (config.borderColor || config.borderWidth) {
        newStyle.border = `${config.borderWidth || this.config.borderWidth || 1}px ${config.borderStyle || this.config.borderStyle || 'solid'} ${config.borderColor || this.config.borderColor || 'transparent'}`;
      }
      
      this.updateStyle({ style: newStyle });
    }

    // 更新图标
    if (config.icon !== undefined) {
      this.setIcon(config.icon);
    }

    // 更新标题
    if (config.title) {
      this.setAttribute('title', config.title);
    }

    // 更新点击处理器
    if (config.onClick !== undefined) {
      this.onClickHandler = config.onClick;
    }
  }

  /**
   * 获取按钮配置
   */
  getConfig(): CustomButtonConfig {
    return { ...this.config };
  }

  /**
   * 获取按钮ID
   */
  getId(): string {
    return this.config.id;
  }

  /**
   * 检查是否激活
   */
  isButtonActive(): boolean {
    return this.isActive;
  }

  /**
   * 检查是否启用
   */
  isButtonEnabled(): boolean {
    return this.config.enabled !== false;
  }

  /**
   * 检查是否可见
   */
  isButtonVisible(): boolean {
    return this.config.visible !== false;
  }
}

/**
 * 创建工具栏按钮的工厂函数
 */
export function createToolbarButton(config: CustomButtonConfig, styleConfig?: StyleConfig): ToolbarButton {
  return new ToolbarButton(config, styleConfig);
}