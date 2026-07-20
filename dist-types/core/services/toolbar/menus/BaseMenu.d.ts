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
export declare abstract class BaseMenu implements IMenu {
    /** 菜单元素 */
    protected menuElement: HTMLElement | null;
    /** 工具栏容器元素 */
    protected toolbarElement: HTMLElement | null;
    /** 当前锚点元素 */
    protected anchorElement: HTMLElement | null;
    /** 是否已销毁 */
    protected isDestroyed: boolean;
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
    constructor(toolbarElement: HTMLElement, i18n?: any, useI18n?: boolean);
    /**
     * 显示菜单（由子类实现具体渲染逻辑）
     * @param anchor 锚点元素
     */
    abstract show(anchor: HTMLElement): void;
    /**
     * 隐藏菜单
     */
    hide(): void;
    /**
     * 切换菜单显示状态
     * @param anchor 锚点元素
     */
    toggle(anchor: HTMLElement): void;
    /**
     * 销毁菜单
     */
    destroy(): void;
    /**
     * 创建菜单容器元素
     * @param className 类名
     * @param customStyles 自定义样式
     */
    protected createMenuContainer(className: string, customStyles?: Partial<CSSStyleDeclaration>): HTMLElement;
    /**
     * 定位菜单到锚点元素
     * @param anchor 锚点元素
     * @param config 位置配置
     */
    protected positionMenu(anchor: HTMLElement, config?: MenuPositionConfig): void;
    /**
     * 调整菜单位置以避免超出可视区域
     */
    protected adjustPosition(): void;
    /**
     * 翻译文本
     * @param key 翻译键
     * @param params 翻译参数
     */
    protected t(key: string, params?: Record<string, any>): string;
    /**
     * 绑定元素翻译
     * @param element DOM 元素
     * @param key 翻译键
     * @param attribute 属性名
     */
    protected bindElement(element: HTMLElement, key: string, attribute?: string): void;
    /**
     * 创建菜单项
     * @param id 菜单项 ID
     * @param text 显示文本
     * @param textKey 翻译键
     * @param icon 图标
     * @param onClick 点击回调
     */
    protected createMenuItem(id: string, text: string, textKey: string | undefined, icon: string, onClick: () => void): HTMLElement;
    private createIconElement;
    private isImagePath;
    /**
     * 设置菜单鼠标离开自动关闭
     * @param delay 延迟时间（毫秒）
     */
    protected setupAutoClose(delay?: number): void;
}
