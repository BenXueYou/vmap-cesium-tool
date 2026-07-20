import { BaseComponent } from './BaseComponent';
import { ToolbarButton } from './ToolbarButton';
import type { ToolbarConfig, CustomButtonConfig, StyleConfig } from '../core/types';
/**
 * 工具栏组件
 */
export declare class Toolbar extends BaseComponent {
    private config;
    private buttons;
    private buttonContainer;
    /**
     * 构造函数
     * @param config 工具栏配置
     * @param styleConfig 样式配置
     */
    constructor(config?: Partial<ToolbarConfig>, styleConfig?: StyleConfig);
    /**
     * 获取位置样式（静态方法）
     */
    private static getPositionStyle;
    /**
     * 获取位置样式（实例方法）
     */
    private getPositionStyle;
    /**
     * 应用配置
     */
    private applyConfig;
    /**
     * 添加按钮
     * @param buttonConfig 按钮配置
     * @returns 创建的按钮实例
     */
    addButton(buttonConfig: CustomButtonConfig): ToolbarButton;
    /**
     * 移除按钮
     * @param buttonId 按钮ID
     */
    removeButton(buttonId: string): boolean;
    /**
     * 获取按钮
     * @param buttonId 按钮ID
     */
    getButton(buttonId: string): ToolbarButton | undefined;
    /**
     * 获取所有按钮
     */
    getButtons(): ToolbarButton[];
    /**
     * 更新按钮配置
     * @param buttonId 按钮ID
     * @param config 新的按钮配置
     */
    updateButton(buttonId: string, config: Partial<CustomButtonConfig>): boolean;
    /**
     * 排序按钮
     */
    private sortButtons;
    /**
     * 启用按钮
     * @param buttonId 按钮ID
     */
    enableButton(buttonId: string): boolean;
    /**
     * 禁用按钮
     * @param buttonId 按钮ID
     */
    disableButton(buttonId: string): boolean;
    /**
     * 显示按钮
     * @param buttonId 按钮ID
     */
    showButton(buttonId: string): boolean;
    /**
     * 隐藏按钮
     * @param buttonId 按钮ID
     */
    hideButton(buttonId: string): boolean;
    /**
     * 激活按钮
     * @param buttonId 按钮ID
     */
    activateButton(buttonId: string): boolean;
    /**
     * 取消激活按钮
     * @param buttonId 按钮ID
     */
    deactivateButton(buttonId: string): boolean;
    /**
     * 更新工具栏配置
     * @param config 新的工具栏配置
     */
    updateConfig(config: Partial<ToolbarConfig>): void;
    /**
     * 获取工具栏配置
     */
    getConfig(): ToolbarConfig;
    /**
     * 清空所有按钮
     */
    clearButtons(): void;
    /**
     * 添加多个按钮
     * @param buttonConfigs 按钮配置数组
     */
    addButtons(buttonConfigs: CustomButtonConfig[]): ToolbarButton[];
    /**
     * 销毁工具栏
     */
    destroy(): void;
}
/**
 * 创建工具栏的工厂函数
 */
export declare function createToolbar(config?: Partial<ToolbarConfig>, styleConfig?: StyleConfig): Toolbar;
