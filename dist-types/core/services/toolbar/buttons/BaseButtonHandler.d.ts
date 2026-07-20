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
export declare abstract class BaseButtonHandler implements IButtonHandler {
    /** 按钮 ID */
    readonly id: string;
    /** 按钮实例引用 */
    protected button: ToolbarButton | null;
    /** 国际化实例 */
    protected i18n?: I18nLike;
    /** 是否使用国际化 */
    protected useI18n: boolean;
    /** Cesium Viewer 实例 */
    protected viewer: any;
    /** 工具栏容器元素 */
    protected toolbarElement: HTMLElement | null;
    /**
     * 构造函数
     * @param id 按钮 ID
     * @param viewer Cesium Viewer 实例
     * @param i18n 国际化实例
     * @param useI18n 是否使用国际化
     */
    constructor(id: string, viewer: any, i18n?: I18nLike, useI18n?: boolean);
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
    setToolbarElement(element: HTMLElement): void;
    /**
     * 获取按钮实例
     */
    getButton(): ToolbarButton | null;
    /**
     * 激活按钮
     */
    protected activateButton(): void;
    /**
     * 取消激活按钮
     */
    protected deactivateButton(): void;
    /**
     * 切换按钮激活状态
     */
    protected toggleButtonActive(): void;
    /**
     * 检查按钮是否激活
     */
    protected isButtonActive(): boolean;
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
     * @param attribute 属性名（默认为 textContent）
     */
    protected bindElement(element: HTMLElement, key: string, attribute?: string): void;
    /**
     * 创建菜单项元素
     * @param id 菜单项 ID
     * @param text 显示文本
     * @param icon 图标
     * @param onClick 点击回调
     */
    protected createMenuItem(id: string, text: string, icon: string, onClick: () => void): HTMLElement;
    /**
     * 关闭其他打开的菜单
     * @param excludeId 排除的按钮 ID
     */
    protected closeOtherMenus(excludeId?: string): void;
    /**
     * 延迟关闭菜单
     * @param menu 菜单元素
     * @param delay 延迟时间（毫秒）
     */
    protected scheduleMenuClose(menu: HTMLElement, delay?: number): void;
    /**
     * 调整菜单位置以避免超出可视区域
     * @param menu 菜单元素
     */
    protected adjustMenuPosition(menu: HTMLElement): void;
}
