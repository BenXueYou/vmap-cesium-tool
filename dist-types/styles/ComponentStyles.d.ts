import type { StyleConfig } from '../core/types';
/**
 * 组件样式工具
 * 提供组件样式的创建、管理和应用功能
 */
export interface ComponentStyleOptions {
    baseClass?: string;
    variants?: Record<string, Record<string, string>>;
    defaultVariant?: string;
}
/**
 * 组件样式类
 */
export declare class ComponentStyles {
    private componentName;
    private options;
    private styleId;
    /**
     * 构造函数
     * @param componentName 组件名称
     * @param options 样式选项
     */
    constructor(componentName: string, options?: ComponentStyleOptions);
    /**
     * 生成基础样式
     */
    private generateBaseStyles;
    /**
     * 生成变体样式
     */
    private generateVariantStyles;
    /**
     * 生成状态样式
     */
    private generateStateStyles;
    /**
     * 注入样式
     */
    inject(): string;
    /**
     * 移除样式
     */
    remove(): void;
    /**
     * 获取样式配置
     * @param variant 变体名称
     */
    getStyleConfig(variant?: string): StyleConfig;
    /**
     * 应用样式到元素
     * @param element 目标元素
     * @param variant 变体名称
     */
    applyToElement(element: HTMLElement, variant?: string): void;
    /**
     * 添加变体
     * @param variantName 变体名称
     * @param styles 样式对象
     */
    addVariant(variantName: string, styles: Record<string, string>): void;
    /**
     * 移除变体
     * @param variantName 变体名称
     */
    removeVariant(variantName: string): void;
}
/**
 * 预定义组件样式
 */
export declare const predefinedComponentStyles: {
    toolbar: ComponentStyles;
    button: ComponentStyles;
    searchBox: ComponentStyles;
};
/**
 * 创建组件样式的工厂函数
 */
export declare function createComponentStyles(componentName: string, options?: ComponentStyleOptions): ComponentStyles;
/**
 * 获取预定义组件样式
 */
export declare function getPredefinedComponentStyles(componentName: keyof typeof predefinedComponentStyles): ComponentStyles;
