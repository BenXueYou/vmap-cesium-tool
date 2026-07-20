import { BaseComponent } from './BaseComponent';
import type { CustomButtonConfig, StyleConfig } from '../core/types';
/**
 * 工具栏按钮组件
 */
export declare class ToolbarButton extends BaseComponent {
    private config;
    private onClickHandler?;
    private isActive;
    private static readonly DEFAULT_TITLES;
    /**
     * 构造函数
     * @param config 按钮配置
     * @param styleConfig 样式配置
     */
    constructor(config: CustomButtonConfig, styleConfig?: StyleConfig);
    /**
     * 设置按钮
     */
    private setupButton;
    /**
     * 设置图标
     * @param icon 图标配置
     */
    private setIcon;
    /**
     * 判断是否为图片路径
     */
    private isImagePath;
    private getResolvedTitle;
    /**
     * 处理点击事件
     */
    private handleClick;
    /**
     * 处理鼠标进入事件
     */
    private handleMouseEnter;
    /**
     * 处理鼠标离开事件
     */
    private handleMouseLeave;
    /**
     * 激活按钮
     */
    activate(): void;
    /**
     * 取消激活按钮
     */
    deactivate(): void;
    /**
     * 切换激活状态
     */
    toggleActive(): void;
    /**
     * 启用按钮
     */
    enable(): void;
    /**
     * 禁用按钮
     */
    disable(): void;
    /**
     * 显示按钮
     */
    show(): void;
    /**
     * 隐藏按钮
     */
    hide(): void;
    /**
     * 更新按钮配置
     * @param config 新的按钮配置
     */
    updateConfig(config: Partial<CustomButtonConfig>): void;
    /**
     * 获取按钮配置
     */
    getConfig(): CustomButtonConfig;
    /**
     * 获取按钮ID
     */
    getId(): string;
    /**
     * 检查是否激活
     */
    isButtonActive(): boolean;
    /**
     * 检查是否启用
     */
    isButtonEnabled(): boolean;
    /**
     * 检查是否可见
     */
    isButtonVisible(): boolean;
}
/**
 * 创建工具栏按钮的工厂函数
 */
export declare function createToolbarButton(config: CustomButtonConfig, styleConfig?: StyleConfig): ToolbarButton;
