import { BaseComponent } from './BaseComponent';
import type { SearchResult, StyleConfig } from '../core/types';
/**
 * 搜索框组件配置
 */
export interface SearchBoxConfig {
    placeholder?: string;
    debounceTime?: number;
    minQueryLength?: number;
    maxResults?: number;
    showClearButton?: boolean;
    autoFocus?: boolean;
}
/**
 * 搜索框组件
 */
export declare class SearchBox extends BaseComponent {
    private config;
    private inputElement;
    private clearButton;
    private resultsContainer;
    private debounceTimer;
    private onSearchCallback?;
    private onSelectCallback?;
    private currentResults;
    /**
     * 构造函数
     * @param config 搜索框配置
     * @param styleConfig 样式配置
     */
    constructor(config?: SearchBoxConfig, styleConfig?: StyleConfig);
    /**
     * 设置输入框
     */
    private setupInput;
    /**
     * 设置清除按钮
     */
    private setupClearButton;
    /**
     * 设置结果容器
     */
    private setupResultsContainer;
    /**
     * 处理输入事件
     */
    private handleInput;
    /**
     * 处理键盘事件
     */
    private handleKeyDown;
    /**
     * 处理聚焦事件
     */
    private handleFocus;
    /**
     * 处理失焦事件
     */
    private handleBlur;
    /**
     * 执行搜索
     */
    private performSearch;
    /**
     * 显示搜索结果
     */
    private displayResults;
    /**
     * 显示错误信息
     */
    private displayError;
    /**
     * 创建结果元素
     */
    private createResultElement;
    /**
     * 导航结果
     */
    private navigateResults;
    /**
     * 选择结果
     */
    private selectResult;
    /**
     * 显示结果容器
     */
    private showResults;
    /**
     * 隐藏结果容器
     */
    private hideResults;
    /**
     * 设置搜索回调
     */
    setOnSearch(callback: (query: string) => Promise<SearchResult[]>): void;
    /**
     * 设置选择回调
     */
    setOnSelect(callback: (result: SearchResult) => void): void;
    /**
     * 获取当前查询
     */
    getQuery(): string;
    /**
     * 设置查询
     */
    setQuery(query: string): void;
    /**
     * 清空搜索框
     */
    clear(): void;
    /**
     * 聚焦输入框
     */
    focus(): void;
    /**
     * 失焦输入框
     */
    blur(): void;
    /**
     * 更新配置
     */
    updateConfig(config: Partial<SearchBoxConfig>): void;
    /**
     * 获取配置
     */
    getConfig(): SearchBoxConfig;
    /**
     * 销毁组件
     */
    destroy(): void;
}
/**
 * 创建搜索框的工厂函数
 */
export declare function createSearchBox(config?: SearchBoxConfig, styleConfig?: StyleConfig): SearchBox;
