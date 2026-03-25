/**
 * 按钮处理器基类
 * 提供通用的按钮处理逻辑和工具方法
 */

import type { ToolbarButton } from '../../../../components/ToolbarButton';
import type { IButtonHandler } from '../types';
import type { I18nLike } from '../../../../i18n';

/**
 * 按钮处理器基类
 */
export abstract class BaseButtonHandler implements IButtonHandler {
  /** 按钮 ID */
  readonly id: string;
  
  /** 按钮实例引用 */
  protected button: ToolbarButton | null = null;
  
  /** 国际化实例 */
  protected i18n?: I18nLike;
  
  /** 是否使用国际化 */
  protected useI18n: boolean;
  
  /** Cesium Viewer 实例 */
  protected viewer: any;
  
  /** 工具栏容器元素 */
  protected toolbarElement: HTMLElement | null = null;

  /**
   * 构造函数
   * @param id 按钮 ID
   * @param viewer Cesium Viewer 实例
   * @param i18n 国际化实例
   * @param useI18n 是否使用国际化
   */
  constructor(
    id: string,
    viewer: any,
    i18n?: I18nLike,
    useI18n: boolean = true
  ) {
    this.id = id;
    this.viewer = viewer;
    this.i18n = i18n;
    this.useI18n = useI18n;
  }

  /**
   * 初始化按钮（由子类实现）
   * @param button 按钮实例
   */
  abstract initialize(button: ToolbarButton): void;

  /**
   * 处理点击事件（由子类实现）
   */
  abstract handleClick(): void;

  /**
   * 处理鼠标进入事件（可选，由子类实现）
   */
  handleMouseEnter?(): void;

  /**
   * 处理鼠标离开事件（可选，由子类实现）
   */
  handleMouseLeave?(): void;

  /**
   * 销毁处理器（由子类实现）
   */
  abstract destroy(): void;

  /**
   * 设置工具栏容器元素
   * @param element 工具栏容器元素
   */
  setToolbarElement(element: HTMLElement): void {
    this.toolbarElement = element;
  }

  /**
   * 获取按钮实例
   */
  getButton(): ToolbarButton | null {
    return this.button;
  }

  /**
   * 激活按钮
   */
  protected activateButton(): void {
    if (this.button && !this.button.isButtonActive()) {
      this.button.activate();
    }
  }

  /**
   * 取消激活按钮
   */
  protected deactivateButton(): void {
    if (this.button && this.button.isButtonActive()) {
      this.button.deactivate();
    }
  }

  /**
   * 切换按钮激活状态
   */
  protected toggleButtonActive(): void {
    if (this.button) {
      this.button.toggleActive();
    }
  }

  /**
   * 检查按钮是否激活
   */
  protected isButtonActive(): boolean {
    return this.button?.isButtonActive() ?? false;
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
   * @param attribute 属性名（默认为 textContent）
   */
  protected bindElement(element: HTMLElement, key: string, attribute?: string): void {
    if (this.useI18n && this.i18n) {
      this.i18n.bindElement(element, key, attribute || 'textContent');
    } else {
      element.textContent = key;
    }
  }

  /**
   * 创建菜单项元素
   * @param id 菜单项 ID
   * @param text 显示文本
   * @param icon 图标
   * @param onClick 点击回调
   */
  protected createMenuItem(
    id: string,
    text: string,
    icon: string,
    onClick: () => void
  ): HTMLElement {
    const menuItem = document.createElement('div');
    menuItem.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      color: #fff;
      gap: 8px;
      transition: background-color 0.2s;
      border-radius: 4px;
    `;

    // 图标
    const iconEl = document.createElement('span');
    iconEl.textContent = icon;
    iconEl.style.fontSize = '14px';
    menuItem.appendChild(iconEl);

    // 文本
    const label = document.createElement('span');
    label.textContent = text;
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

  /**
   * 关闭其他打开的菜单
   * @param excludeId 排除的按钮 ID
   */
  protected closeOtherMenus(excludeId?: string): void {
    if (!this.toolbarElement) return;

    const menuIds = ['search', 'measure', 'layers'];
    menuIds.forEach(id => {
      if (id !== excludeId) {
        const menu = this.toolbarElement!.querySelector(`.${id}-menu, .${id}-container`);
        if (menu) {
          menu.remove();
        }
      }
    });
  }

  /**
   * 延迟关闭菜单
   * @param menu 菜单元素
   * @param delay 延迟时间（毫秒）
   */
  protected scheduleMenuClose(menu: HTMLElement, delay: number = 100): void {
    setTimeout(() => {
      if (menu && !menu.matches(':hover')) {
        menu.remove();
      }
    }, delay);
  }

  /**
   * 调整菜单位置以避免超出可视区域
   * @param menu 菜单元素
   */
  protected adjustMenuPosition(menu: HTMLElement): void {
    const menuRect = menu.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // 底部溢出调整
    if (menuRect.bottom > viewportHeight) {
      const overflow = menuRect.bottom - viewportHeight;
      const currentTop = parseFloat(menu.style.top || '0');
      menu.style.top = `${Math.max(0, currentTop - overflow)}px`;
    }

    // 顶部溢出调整
    const updatedRect = menu.getBoundingClientRect();
    if (updatedRect.top < 0) {
      const delta = -updatedRect.top;
      const currentTop = parseFloat(menu.style.top || '0');
      menu.style.top = `${currentTop + delta}px`;
    }

    // 右侧溢出调整
    if (menuRect.right > viewportWidth) {
      const overflow = menuRect.right - viewportWidth;
      const currentRight = parseFloat(menu.style.right || '0');
      menu.style.right = `${currentRight + overflow}px`;
      menu.style.left = '';
    }
  }
}