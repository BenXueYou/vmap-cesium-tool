/**
 * 搜索按钮处理器
 * 处理搜索功能的按钮点击、搜索框显示等逻辑
 */
import { BaseButtonHandler } from './BaseButtonHandler';
import type { ToolbarButton } from '../../../../components/ToolbarButton';
interface SearchContainerStyleConfig {
    containerStyle?: Partial<CSSStyleDeclaration>;
    inputStyle?: Partial<CSSStyleDeclaration>;
    actionButtonStyle?: Partial<CSSStyleDeclaration>;
    actionIconStyle?: Partial<CSSStyleDeclaration>;
    resultStyle?: Partial<CSSStyleDeclaration>;
    resultItemStyle?: Partial<CSSStyleDeclaration>;
    resultItemHoverStyle?: Partial<CSSStyleDeclaration>;
    resultItemActiveStyle?: Partial<CSSStyleDeclaration>;
    buttonStyle?: Partial<CSSStyleDeclaration>;
    resultItemIconStyle?: Partial<CSSStyleDeclaration>;
}
/**
 * 搜索按钮处理器配置
 */
export interface SearchButtonHandlerOptions {
    /** 搜索服务实例 */
    searchService?: any;
    /** 搜索框样式 */
    searchContainerStyle?: SearchContainerStyleConfig;
    /** 默认动作图标 */
    idleActionIcon?: string | HTMLElement;
    /** 清空动作图标 */
    clearActionIcon?: string | HTMLElement;
    /** 搜索回调 */
    onSearch?: (query: string) => Promise<any[]>;
    /** 搜索选择回调 */
    onSelect?: (result: any) => void;
}
/**
 * 搜索按钮处理器类
 */
export declare class SearchButtonHandler extends BaseButtonHandler {
    readonly id = "search";
    private static readonly SCROLLBAR_STYLE_ID;
    private static readonly INPUT_SEARCH_DEBOUNCE_MS;
    private options;
    private styleConfig;
    private searchContainer;
    private searchTimer;
    private latestSearchToken;
    private normalizeStyleConfig;
    private ensureScrollbarStyles;
    private clearSearchResults;
    private getEmptyResultText;
    private resetSearchTimer;
    private scheduleInputSearch;
    /**
     * 构造函数
     * @param viewer Cesium Viewer 实例
     * @param options 配置选项
     * @param i18n 国际化实例
     * @param useI18n 是否使用国际化
     */
    constructor(viewer: any, options?: SearchButtonHandlerOptions, i18n?: any, useI18n?: boolean);
    updateOptions(options: Partial<SearchButtonHandlerOptions>): void;
    /**
     * 获取默认样式
     */
    private getDefaultStyles;
    /**
     * 初始化按钮
     * @param button 按钮实例
     */
    initialize(button: ToolbarButton): void;
    /**
     * 处理点击事件
     */
    handleClick(): void;
    /**
     * 处理鼠标离开事件
     */
    handleMouseLeave(): void;
    /**
     * 销毁处理器
     */
    destroy(): void;
    /**
     * 切换搜索框显示
     * @param anchor 锚点元素
     */
    toggleSearch(anchor: HTMLElement): void;
    /**
     * 显示搜索框
     * @param anchor 锚点元素
     */
    private showSearch;
    /**
     * 执行搜索
     * @param query 搜索关键词
     */
    private doSearch;
    /**
     * 显示搜索结果
     * @param results 搜索结果数组
     */
    private showSearchResults;
    /**
     * 飞到搜索结果位置
     */
    private flyToResult;
    /**
     * 调整搜索框位置避免溢出视口
     */
    private adjustSearchPosition;
    private createActionIconElement;
    private isImagePath;
    /**
     * 关闭搜索框
     */
    closeSearch(): void;
}
export {};
