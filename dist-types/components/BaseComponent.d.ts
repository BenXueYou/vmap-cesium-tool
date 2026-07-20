import type { StyleConfig } from '../core/types';
/**
 * 组件基础类
 * 提供样式管理、事件处理等通用功能
 */
export declare abstract class BaseComponent {
    protected element: HTMLElement;
    protected styleConfig: StyleConfig;
    protected isMounted: boolean;
    /**
     * 构造函数
     * @param tagName 元素标签名
     * @param styleConfig 样式配置
     */
    constructor(tagName?: string, styleConfig?: StyleConfig);
    /**
     * 应用样式配置
     */
    protected applyStyle(): void;
    /**
     * 更新样式配置
     * @param styleConfig 新的样式配置
     */
    updateStyle(styleConfig: Partial<StyleConfig>): void;
    /**
     * 获取元素
     */
    getElement(): HTMLElement;
    /**
     * 挂载到父元素
     * @param parent 父元素或选择器
     */
    mount(parent: HTMLElement | string): void;
    /**
     * 从父元素卸载
     */
    unmount(): void;
    /**
     * 显示组件
     */
    show(): void;
    /**
     * 隐藏组件
     */
    hide(): void;
    /**
     * 切换显示状态
     */
    toggle(): void;
    /**
     * 添加事件监听器
     * @param event 事件类型
     * @param handler 事件处理函数
     * @param options 事件选项
     */
    addEventListener(event: string, handler: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    /**
     * 移除事件监听器
     * @param event 事件类型
     * @param handler 事件处理函数
     * @param options 事件选项
     */
    removeEventListener(event: string, handler: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
    /**
     * 设置属性
     * @param name 属性名
     * @param value 属性值
     */
    setAttribute(name: string, value: string): void;
    /**
     * 获取属性
     * @param name 属性名
     */
    getAttribute(name: string): string | null;
    /**
     * 移除属性
     * @param name 属性名
     */
    removeAttribute(name: string): void;
    /**
     * 添加CSS类
     * @param className CSS类名
     */
    addClass(className: string): void;
    /**
     * 移除CSS类
     * @param className CSS类名
     */
    removeClass(className: string): void;
    /**
     * 切换CSS类
     * @param className CSS类名
     */
    toggleClass(className: string): void;
    /**
     * 检查是否包含CSS类
     * @param className CSS类名
     */
    hasClass(className: string): boolean;
    /**
     * 挂载后的回调（子类可重写）
     */
    protected onMount(): void;
    /**
     * 卸载后的回调（子类可重写）
     */
    protected onUnmount(): void;
    /**
     * 销毁组件
     */
    destroy(): void;
}
/**
 * 创建组件实例的工厂函数
 */
export declare function createComponent<T extends BaseComponent>(ComponentClass: new (...args: any[]) => T, ...args: any[]): T;
