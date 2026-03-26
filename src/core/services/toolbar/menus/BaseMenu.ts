/**
 * 菜单基类
 * 提供通用的菜单创建、定位、显示/隐藏功能
 */

import type { IMenu } from '../types';

/**
 * 菜单位置配置
 */
export interface MenuPositionConfig {
  /** 相对于锚点的位置 */
  position?: 'left' | 'right' | 'top' | 'bottom';
  /** 偏移量（像素） */
  offset?: number;
  /** 顶部偏移（像素） */
  topOffset?: number;
}

/**
 * 菜单基类
 */
export abstract class BaseMenu implements IMenu {
  /** 菜单元素 */
  protected menuElement: HTMLElement | null = null;
  
  /** 工具栏容器元素 */
  protected toolbarElement: HTMLElement | null = null;
  
  /** 当前锚点元素 */
  protected anchorElement: HTMLElement | null = null;
  
  /** 是否已销毁 */
  protected isDestroyed = false;
  
  /** 国际化实例 */
  protected i18n?: any;
  
  /** 是否使用国际化 */
  protected useI18n: boolean;

  /**
   * 构造函数
   * @param toolbarElement 工具栏容器元素
   * @param i18n 国际化实例
   * @param useI18n 是否使用国际化
   */
  constructor(
    toolbarElement: HTMLElement,
    i18n?: any,
    useI18n: boolean = true
  ) {
    this.toolbarElement = toolbarElement;
    this.i18n = i18n;
    this.useI18n = useI18n;
  }

  /**
   * 显示菜单（由子类实现具体渲染逻辑）
   * @param anchor 锚点元素
   */
  abstract show(anchor: HTMLElement): void;

  /**
   * 隐藏菜单
   */
  hide(): void {
    if (this.menuElement && this.menuElement.parentNode) {
      this.menuElement.parentNode.removeChild(this.menuElement);
      this.menuElement = null;
    }
    this.anchorElement = null;
  }

  /**
   * 切换菜单显示状态
   * @param anchor 锚点元素
   */
  toggle(anchor: HTMLElement): void {
    // 如果菜单已存在且锚点相同，则隐藏
    if (this.menuElement && this.anchorElement === anchor) {
      this.hide();
    } else {
      // 否则显示
      this.show(anchor);
    }
  }

  /**
   * 销毁菜单
   */
  destroy(): void {
    this.hide();
    this.isDestroyed = true;
    this.toolbarElement = null;
  }

  /**
   * 创建菜单容器元素
   * @param className 类名
   * @param customStyles 自定义样式
   */
  protected createMenuContainer(className: string, customStyles: Partial<CSSStyleDeclaration> = {}): HTMLElement {
    const menu = document.createElement('div');
    menu.className = className;
    menu.style.cssText = `
      position: absolute;
      background: rgba(0, 40, 80, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      padding: 4px 0;
      min-width: 120px;
      z-index: 1001;
    `;

    Object.assign(menu.style, customStyles);
    return menu;
  }

  /**
   * 定位菜单到锚点元素
   * @param anchor 锚点元素
   * @param config 位置配置
   */
  protected positionMenu(anchor: HTMLElement, config: MenuPositionConfig = {}): void {
    if (!this.menuElement || !this.toolbarElement) return;

    const {
      position = 'left',
      offset = 8,
      topOffset = 0,
    } = config;

    const anchorRect = anchor.getBoundingClientRect();
    const toolbarRect = this.toolbarElement.getBoundingClientRect();

    // 计算相对于工具栏的位置
    let left: number;
    let top: number;

    switch (position) {
      case 'left':
        left = anchorRect.left - toolbarRect.left - offset - this.menuElement.offsetWidth;
        top = anchorRect.top - toolbarRect.top + topOffset;
        break;
      case 'right':
        left = anchorRect.right - toolbarRect.left + offset;
        top = anchorRect.top - toolbarRect.top + topOffset;
        break;
      case 'top':
        left = anchorRect.left - toolbarRect.left;
        top = anchorRect.top - toolbarRect.top - offset - this.menuElement.offsetHeight;
        break;
      case 'bottom':
        left = anchorRect.left - toolbarRect.left;
        top = anchorRect.top - toolbarRect.top + anchorRect.height + offset;
        break;
      default:
        left = anchorRect.left - toolbarRect.left - offset - this.menuElement.offsetWidth;
        top = anchorRect.top - toolbarRect.top + topOffset;
    }

    this.menuElement.style.left = `${left}px`;
    this.menuElement.style.top = `${top}px`;
    this.menuElement.style.right = '';
  }

  /**
   * 调整菜单位置以避免超出可视区域
   */
  protected adjustPosition(): void {
    if (!this.menuElement) return;

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    let menuRect = this.menuElement.getBoundingClientRect();

    // 底部溢出调整
    if (menuRect.bottom > viewportHeight) {
      const overflow = menuRect.bottom - viewportHeight;
      const currentTop = parseFloat(this.menuElement.style.top || '0');
      this.menuElement.style.top = `${Math.max(0, currentTop - overflow)}px`;
      menuRect = this.menuElement.getBoundingClientRect();
    }

    // 顶部溢出调整
    if (menuRect.top < 0) {
      const delta = -menuRect.top;
      const currentTop = parseFloat(this.menuElement.style.top || '0');
      this.menuElement.style.top = `${currentTop + delta}px`;
      menuRect = this.menuElement.getBoundingClientRect();
    }

    // 右侧溢出调整
    if (menuRect.right > viewportWidth) {
      const overflow = menuRect.right - viewportWidth;
      const currentLeft = parseFloat(this.menuElement.style.left || '0');
      const currentRight = parseFloat(this.menuElement.style.right || '0');
      
      if (currentLeft > 0) {
        this.menuElement.style.left = `${currentLeft - overflow}px`;
      } else {
        this.menuElement.style.right = `${currentRight + overflow}px`;
        this.menuElement.style.left = '';
      }
      menuRect = this.menuElement.getBoundingClientRect();
    }

    // 左侧溢出调整
    if (menuRect.left < 0) {
      const overflow = -menuRect.left;
      const currentLeft = parseFloat(this.menuElement.style.left || '0');
      this.menuElement.style.left = `${Math.max(0, currentLeft + overflow)}px`;
    }
  }

  /**
   * 翻译文本
   * @param key 翻译键
   * @param params 翻译参数
   */
  protected t(key: string, params?: Record<string, any>): string {
    if (this.useI18n && this.i18n) {
      return this.i18n.t(key, params);
    }
    return key;
  }

  /**
   * 绑定元素翻译
   * @param element DOM 元素
   * @param key 翻译键
   * @param attribute 属性名
   */
  protected bindElement(element: HTMLElement, key: string, attribute: string = 'textContent'): void {
    if (this.useI18n && this.i18n) {
      this.i18n.bindElement(element, key, attribute);
    } else {
      element.textContent = key;
    }
  }

  /**
   * 创建菜单项
   * @param id 菜单项 ID
   * @param text 显示文本
   * @param textKey 翻译键
   * @param icon 图标
   * @param onClick 点击回调
   */
  protected createMenuItem(
    id: string,
    text: string,
    textKey: string | undefined,
    icon: string,
    onClick: () => void
  ): HTMLElement {
    const menuItem = document.createElement('div');
    menuItem.setAttribute('data-menu-item', id);
    menuItem.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      color: #fff;
      gap: 8px;
      transition: background-color 0.2s;
      white-space: nowrap;
    `;

    // 图标
  const iconEl = this.createIconElement(icon, text);
    menuItem.appendChild(iconEl);

    // 文本
    const label = document.createElement('span');
    if (textKey && this.useI18n && this.i18n) {
      this.i18n.bindElement(label, textKey, 'textContent');
    } else {
      label.textContent = text;
    }
    menuItem.appendChild(label);

    // 悬停效果
    menuItem.addEventListener('mouseenter', () => {
      menuItem.style.backgroundColor = '#055AB0';
      menuItem.style.color = '#007BFF';
      menuItem.style.transform = 'scale(1.02)';
    });

    menuItem.addEventListener('mouseleave', () => {
      menuItem.style.backgroundColor = 'transparent';
      menuItem.style.color = '#fff';
      menuItem.style.transform = 'scale(1)';
    });

    // 点击事件
    menuItem.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      onClick();
    });

    return menuItem;
  }

  private createIconElement(icon: string, altText: string): HTMLElement {
    if (this.isImagePath(icon)) {
      const image = document.createElement('img');
      image.src = icon;
      image.alt = altText;
      image.style.width = '14px';
      image.style.height = '14px';
      image.style.objectFit = 'contain';
      image.style.flexShrink = '0';
      return image;
    }

    const textIcon = document.createElement('span');
    textIcon.textContent = icon;
    textIcon.style.fontSize = '14px';
    textIcon.style.flexShrink = '0';
    return textIcon;
  }

  private isImagePath(icon: string): boolean {
    return /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(icon) || icon.startsWith('data:image');
  }

  /**
   * 设置菜单鼠标离开自动关闭
   * @param delay 延迟时间（毫秒）
   */
  protected setupAutoClose(delay: number = 100): void {
    if (!this.menuElement) return;

    this.menuElement.addEventListener('mouseleave', () => {
      setTimeout(() => {
        if (this.menuElement && !this.menuElement.matches(':hover')) {
          this.hide();
        }
      }, delay);
    });
  }
}