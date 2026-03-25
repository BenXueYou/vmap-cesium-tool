import type { StyleConfig } from '../core/types';

/**
 * 组件基础类
 * 提供样式管理、事件处理等通用功能
 */
export abstract class BaseComponent {
  protected element: HTMLElement;
  protected styleConfig: StyleConfig;
  protected isMounted = false;

  /**
   * 构造函数
   * @param tagName 元素标签名
   * @param styleConfig 样式配置
   */
  constructor(tagName: string = 'div', styleConfig: StyleConfig = {}) {
    this.element = document.createElement(tagName);
    this.styleConfig = styleConfig;
    this.applyStyle();
  }

  /**
   * 应用样式配置
   */
  protected applyStyle(): void {
    const { className, style, cssText } = this.styleConfig;

    if (className) {
      this.element.className = className;
    }

    if (style) {
      Object.assign(this.element.style, style);
    }

    if (cssText) {
      this.element.style.cssText = cssText;
    }
  }

  /**
   * 更新样式配置
   * @param styleConfig 新的样式配置
   */
  updateStyle(styleConfig: Partial<StyleConfig>): void {
    this.styleConfig = { ...this.styleConfig, ...styleConfig };
    this.applyStyle();
  }

  /**
   * 获取元素
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * 挂载到父元素
   * @param parent 父元素或选择器
   */
  mount(parent: HTMLElement | string): void {
    let parentElement: HTMLElement | null;

    if (typeof parent === 'string') {
      parentElement = document.querySelector(parent);
    } else {
      parentElement = parent;
    }

    if (!parentElement) {
      throw new Error(`无法找到父元素: ${parent}`);
    }

    parentElement.appendChild(this.element);
    this.isMounted = true;
    this.onMount();
  }

  /**
   * 从父元素卸载
   */
  unmount(): void {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.isMounted = false;
    this.onUnmount();
  }

  /**
   * 显示组件
   */
  show(): void {
    this.element.style.display = '';
  }

  /**
   * 隐藏组件
   */
  hide(): void {
    this.element.style.display = 'none';
  }

  /**
   * 切换显示状态
   */
  toggle(): void {
    if (this.element.style.display === 'none') {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * 添加事件监听器
   * @param event 事件类型
   * @param handler 事件处理函数
   * @param options 事件选项
   */
  addEventListener(
    event: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.element.addEventListener(event, handler, options);
  }

  /**
   * 移除事件监听器
   * @param event 事件类型
   * @param handler 事件处理函数
   * @param options 事件选项
   */
  removeEventListener(
    event: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void {
    this.element.removeEventListener(event, handler, options);
  }

  /**
   * 设置属性
   * @param name 属性名
   * @param value 属性值
   */
  setAttribute(name: string, value: string): void {
    this.element.setAttribute(name, value);
  }

  /**
   * 获取属性
   * @param name 属性名
   */
  getAttribute(name: string): string | null {
    return this.element.getAttribute(name);
  }

  /**
   * 移除属性
   * @param name 属性名
   */
  removeAttribute(name: string): void {
    this.element.removeAttribute(name);
  }

  /**
   * 添加CSS类
   * @param className CSS类名
   */
  addClass(className: string): void {
    this.element.classList.add(className);
  }

  /**
   * 移除CSS类
   * @param className CSS类名
   */
  removeClass(className: string): void {
    this.element.classList.remove(className);
  }

  /**
   * 切换CSS类
   * @param className CSS类名
   */
  toggleClass(className: string): void {
    this.element.classList.toggle(className);
  }

  /**
   * 检查是否包含CSS类
   * @param className CSS类名
   */
  hasClass(className: string): boolean {
    return this.element.classList.contains(className);
  }

  /**
   * 挂载后的回调（子类可重写）
   */
  protected onMount(): void {
    // 子类实现
  }

  /**
   * 卸载后的回调（子类可重写）
   */
  protected onUnmount(): void {
    // 子类实现
  }

  /**
   * 销毁组件
   */
  destroy(): void {
    this.unmount();
    // 清理事件监听器等资源
  }
}

/**
 * 创建组件实例的工厂函数
 */
export function createComponent<T extends BaseComponent>(
  ComponentClass: new (...args: any[]) => T,
  ...args: any[]
): T {
  return new ComponentClass(...args);
}