import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';
import type { SearchResult, SearchCallback } from '../CesiumMapModel';
import type { I18nLike } from '../../libs/i18n';

/**
 * 搜索服务 - 存根实现
 * 为了保持向后兼容性
 */
export class SearchService {
  private viewer: Viewer;
  private toolbarElement: HTMLElement;
  private searchCallback?: SearchCallback;
  private i18n: I18nLike;
  private useI18n: boolean;

  constructor(
    viewer: Viewer,
    toolbarElement: HTMLElement,
    searchCallback?: SearchCallback,
    options?: { i18n?: I18nLike; useI18n?: boolean }
  ) {
    this.viewer = viewer;
    this.toolbarElement = toolbarElement;
    this.searchCallback = searchCallback;
    this.i18n = options?.i18n || { t: (key: string) => key };
    this.useI18n = options?.useI18n ?? true;
  }

  setSearchCallback(callback: SearchCallback): void {
    this.searchCallback = callback;
  }

  toggleSearch(buttonElement: HTMLElement): void {
    // 存根实现
  }

  hideSearch(): void {
    // 存根实现
  }

  closeSearchContainer(): void {
    // 存根实现 - 保持向后兼容
  }
}