/**
 * 样式管理器
 * 负责管理组件样式，支持样式隔离、主题切换和动态样式注入
 */
export interface StyleRule {
    selector: string;
    properties: Record<string, string>;
}
export interface Theme {
    name: string;
    variables: Record<string, string>;
    rules: StyleRule[];
}
export interface StyleManagerConfig {
    prefix?: string;
    isolateStyles?: boolean;
    defaultTheme?: string;
}
/**
 * 样式管理器类
 */
export declare class StyleManager {
    private static instance;
    private styleElement;
    private styles;
    private themes;
    private config;
    private currentTheme;
    /**
     * 私有构造函数（单例模式）
     */
    private constructor();
    /**
     * 获取单例实例
     */
    static getInstance(config?: StyleManagerConfig): StyleManager;
    /**
     * 初始化样式管理器
     */
    private init;
    /**
     * 添加默认主题
     */
    private addDefaultTheme;
    /**
     * 转换颜色变量（将十六进制转换为RGB）
     */
    private convertColorVariables;
    /**
     * 十六进制颜色转换为RGB
     */
    private hexToRgb;
    /**
     * 添加样式规则
     * @param id 样式ID
     * @param cssText CSS文本
     */
    addStyle(id: string, cssText: string): void;
    /**
     * 移除样式规则
     * @param id 样式ID
     */
    removeStyle(id: string): boolean;
    /**
     * 添加主题
     * @param theme 主题配置
     */
    addTheme(theme: Theme): void;
    /**
     * 移除主题
     * @param name 主题名称
     */
    removeTheme(name: string): boolean;
    /**
     * 应用主题
     * @param name 主题名称
     */
    applyTheme(name: string): boolean;
    /**
     * 获取当前主题
     */
    getCurrentTheme(): string;
    /**
     * 获取主题配置
     * @param name 主题名称
     */
    getTheme(name: string): Theme | undefined;
    /**
     * 获取所有主题名称
     */
    getThemeNames(): string[];
    /**
     * 更新样式变量
     * @param variables 变量映射
     */
    updateVariables(variables: Record<string, string>): void;
    /**
     * 获取CSS变量值
     * @param name 变量名
     */
    getVariable(name: string): string | undefined;
    /**
     * 设置CSS变量值
     * @param name 变量名
     * @param value 变量值
     */
    setVariable(name: string, value: string): void;
    /**
     * 生成作用域选择器
     * @param selector 原始选择器
     */
    scopedSelector(selector: string): string;
    /**
     * 更新样式元素内容
     */
    private updateStyleElement;
    /**
     * 生成组件样式
     * @param componentName 组件名称
     * @param styles 样式对象
     */
    generateComponentStyles(componentName: string, styles: Record<string, string>): string;
    /**
     * 注入组件样式
     * @param componentName 组件名称
     * @param styles 样式对象
     * @returns 样式ID
     */
    injectComponentStyles(componentName: string, styles: Record<string, string>): string;
    /**
     * 销毁样式管理器
     */
    destroy(): void;
}
/**
 * 创建样式管理器的工厂函数
 */
export declare function createStyleManager(config?: StyleManagerConfig): StyleManager;
/**
 * 默认导出样式管理器实例
 */
export declare const styleManager: StyleManager;
