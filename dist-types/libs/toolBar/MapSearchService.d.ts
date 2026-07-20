import type { Viewer } from 'cesium';
import type { SearchCallback } from '../CesiumMapModel';
import type { I18nLike } from '../../i18n';
/**
 * 搜索服务 - 存根实现
 * 为了保持向后兼容性
 */
export declare class SearchService {
    private viewer;
    private toolbarElement;
    private searchCallback?;
    private i18n;
    private useI18n;
    private searchContainer;
    private static readonly fallbackI18n;
    constructor(viewer: Viewer, toolbarElement: HTMLElement, searchCallback?: SearchCallback, options?: {
        i18n?: I18nLike;
        useI18n?: boolean;
    });
    setSearchCallback(callback: SearchCallback): void;
    toggleSearch(buttonElement: HTMLElement): void;
    hideSearch(): void;
    closeSearchContainer(): void;
    destroy(): void;
    private flyToResult;
}
