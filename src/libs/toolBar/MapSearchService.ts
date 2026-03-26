import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';
import type { SearchResult, SearchCallback } from '../CesiumMapModel';
import type { I18nLike } from '../../i18n';

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
  private searchContainer: HTMLElement | null = null;

  private static readonly fallbackI18n: I18nLike = {
    t: (key: string) => key,
    getLocale: () => 'zh-CN',
    setLocale: () => {},
    onLocaleChange: () => () => {},
    addMessages: () => {},
    configure: () => {},
    bindElement: (element: HTMLElement, key: string, attribute: string) => {
      if (attribute === 'textContent') {
        element.textContent = key;
      } else {
        element.setAttribute(attribute, key);
      }
    },
    updateTree: () => {}
  };

  constructor(
    viewer: Viewer,
    toolbarElement: HTMLElement,
    searchCallback?: SearchCallback,
    options?: { i18n?: I18nLike; useI18n?: boolean }
  ) {
    this.viewer = viewer;
    this.toolbarElement = toolbarElement;
    this.searchCallback = searchCallback;
    this.i18n = options?.i18n || SearchService.fallbackI18n;
    this.useI18n = options?.useI18n ?? true;
  }

  setSearchCallback(callback: SearchCallback): void {
    this.searchCallback = callback;
  }

  toggleSearch(buttonElement: HTMLElement): void {
    if (this.searchContainer) {
      this.closeSearchContainer();
      return;
    }

    const container = document.createElement('div');
    container.className = 'cesium-map-toolbar-search';
    container.style.cssText = [
      'position:absolute',
      `top:${buttonElement.offsetTop}px`,
      'right:calc(100% + 8px)',
      'display:flex',
      'align-items:center',
      'gap:8px',
      'min-width:220px',
      'padding:8px',
      'background:rgba(7, 26, 48, 0.94)',
      'border:1px solid rgba(87, 164, 255, 0.35)',
      'border-radius:8px',
      'box-shadow:0 8px 20px rgba(0, 0, 0, 0.24)',
      'z-index:1001'
    ].join(';');

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = this.useI18n ? this.i18n.t('toolbar.search_placeholder') : '请输入搜索内容...';
    input.style.cssText = [
      'flex:1',
      'min-width:0',
      'padding:6px 10px',
      'color:#fff',
      'background:rgba(255, 255, 255, 0.08)',
      'border:1px solid rgba(255, 255, 255, 0.16)',
      'border-radius:6px',
      'outline:none'
    ].join(';');

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = '✕';
    closeButton.style.cssText = [
      'padding:4px 8px',
      'color:#fff',
      'background:transparent',
      'border:1px solid rgba(255, 255, 255, 0.16)',
      'border-radius:6px',
      'cursor:pointer'
    ].join(';');

    closeButton.addEventListener('click', () => this.closeSearchContainer());
    input.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') {
        this.searchCallback?.onSearchInput?.(input.value, container);
        return;
      }

      const query = input.value.trim();
      if (!query) return;

      const results = await this.searchCallback?.onSearch?.(query) ?? [];
      this.searchCallback?.onSearchResults?.(results, container);
      const firstResult = results[0];
      if (firstResult) {
        this.flyToResult(firstResult);
        this.searchCallback?.onSelect?.(firstResult);
      }
    });

    container.appendChild(input);
    container.appendChild(closeButton);
    this.toolbarElement.appendChild(container);
    this.searchContainer = container;

    setTimeout(() => input.focus(), 0);
  }

  hideSearch(): void {
    this.closeSearchContainer();
  }

  closeSearchContainer(): void {
    if (!this.searchContainer) {
      return;
    }

    this.searchContainer.remove();
    this.searchContainer = null;
  }

  destroy(): void {
    this.closeSearchContainer();
    this.searchCallback = undefined;
  }

  private flyToResult(result: SearchResult): void {
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        result.longitude,
        result.latitude,
        result.height ?? 2000
      ),
      duration: 1.2
    });
  }
}