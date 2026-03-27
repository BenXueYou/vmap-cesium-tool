/**
 * 搜索按钮处理器
 * 处理搜索功能的按钮点击、搜索框显示等逻辑
 */

import { BaseButtonHandler } from './BaseButtonHandler';
import type { ToolbarButton } from '../../../../components/ToolbarButton';
import searchIcon from '../assets/toolbar/search@3x.png';

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
export class SearchButtonHandler extends BaseButtonHandler {
  readonly id = 'search';
  private static readonly SCROLLBAR_STYLE_ID = 'toolbar-search-scrollbar-style';

  private options: SearchButtonHandlerOptions;
  private styleConfig: SearchContainerStyleConfig = {};

  private searchContainer: HTMLElement | null = null;

  private normalizeStyleConfig(styleConfig?: SearchContainerStyleConfig): SearchContainerStyleConfig {
    return styleConfig ?? {};
  }

  private ensureScrollbarStyles(): void {
    if (document.getElementById(SearchButtonHandler.SCROLLBAR_STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = SearchButtonHandler.SCROLLBAR_STYLE_ID;
    style.textContent = `
      .search-results {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }

      .search-results::-webkit-scrollbar {
        width: 0;
        height: 0;
        display: none;
      }
    `;

    document.head.appendChild(style);
  }

  private clearSearchResults(): void {
    if (!this.searchContainer) {
      return;
    }

    const existingResults = this.searchContainer.querySelector('.search-results');
    if (existingResults) {
      existingResults.remove();
    }
  }

  private getEmptyResultText(): string {
    return this.useI18n && this.i18n
      ? this.i18n.t('toolbar.search_empty')
      : '搜索结果为空';
  }

  /**
   * 构造函数
   * @param viewer Cesium Viewer 实例
   * @param options 配置选项
   * @param i18n 国际化实例
   * @param useI18n 是否使用国际化
   */
  constructor(
    viewer: any,
    options: SearchButtonHandlerOptions = {},
    i18n?: any,
    useI18n: boolean = true
  ) {
    super('search', viewer, i18n, useI18n);
    this.options = options;
    this.styleConfig = this.normalizeStyleConfig(options.searchContainerStyle);
  }

  updateOptions(options: Partial<SearchButtonHandlerOptions>): void {
    this.options.searchService = options.searchService ?? this.options.searchService;
    this.options.searchContainerStyle = options.searchContainerStyle ?? this.options.searchContainerStyle;
    this.options.onSearch = options.onSearch ?? this.options.onSearch;
    this.options.onSelect = options.onSelect ?? this.options.onSelect;

    if (options.searchContainerStyle) {
      const nextStyleConfig = this.normalizeStyleConfig(options.searchContainerStyle);
      this.styleConfig = {
        ...this.styleConfig,
        ...nextStyleConfig,
        actionButtonStyle: nextStyleConfig.actionButtonStyle
          ?? nextStyleConfig.buttonStyle
          ?? this.styleConfig.actionButtonStyle,
      };
    }

    this.options.idleActionIcon = options.idleActionIcon ?? this.options.idleActionIcon;
    this.options.clearActionIcon = options.clearActionIcon ?? this.options.clearActionIcon;
  }

  /**
   * 获取默认样式
   */
  private getDefaultStyles() {
    const styleConfig = this.normalizeStyleConfig(this.styleConfig);
    const inputStyle = styleConfig.inputStyle ?? {};
    const actionButtonStyle = styleConfig.actionButtonStyle ?? styleConfig.buttonStyle ?? {};
    const actionIconStyle = styleConfig.actionIconStyle ?? styleConfig.resultItemIconStyle ?? {};
    const containerStyle = styleConfig.containerStyle ?? {};
    const resultStyle = styleConfig.resultStyle ?? {};
    const resultItemStyle = styleConfig.resultItemStyle ?? {};
    const resultItemHoverStyle = styleConfig.resultItemHoverStyle ?? {};
    const resultItemActiveStyle = styleConfig.resultItemActiveStyle ?? {};

    void resultItemHoverStyle;
    void resultItemActiveStyle;

    return {
      container: {
        position: 'absolute',
        right: '100%',
        marginRight: '10px',
        background: 'rgba(6, 29, 62, 0.92)',
        border: '1px solid rgba(29, 114, 225, 0.9)',
        borderRadius: '0',
        boxShadow: '0 8px 18px rgba(0, 0, 0, 0.28)',
        padding: '4px',
        zIndex: '1001',
        display: 'flex',
        alignItems: 'center',
        gap: '0',
        minWidth: '210px',
        ...containerStyle,
      } as Partial<CSSStyleDeclaration>,
      input: {
        width: '210px',
        height: '34px',
        padding: '0 40px 0 12px',
        border: '1px solid rgba(29, 114, 225, 0.9)',
        borderRadius: '0',
        fontSize: '13px',
        color: '#f4f9ff',
        background: 'rgba(7, 33, 74, 0.92)',
        outline: 'none',
        ...inputStyle,
      } as Partial<CSSStyleDeclaration>,
      actionButton: {
        position: 'absolute',
        top: '50%',
        right: '12px',
        transform: 'translateY(-50%)',
        padding: '0',
        border: 'none',
        background: 'transparent',
        color: '#9eb7d8',
        cursor: 'pointer',
        fontSize: '14px',
        width: '18px',
        height: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '1',
        ...actionButtonStyle,
      } as Partial<CSSStyleDeclaration>,
      actionIcon: {
        width: '18px',
        height: '18px',
        objectFit: 'contain',
        lineHeight: '1',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...actionIconStyle,
      } as Partial<CSSStyleDeclaration>,
      result: {
        position: 'absolute',
        top: '100%',
        left: '0',
        right: '0',
        marginTop: '4px',
        background: 'rgba(6, 29, 62, 0.96)',
        border: '1px solid rgba(29, 114, 225, 0.9)',
        borderRadius: '0',
        boxShadow: '0 8px 18px rgba(0, 0, 0, 0.28)',
        maxHeight: '300px',
        overflowY: 'auto',
        overflowX: 'hidden',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
        zIndex: '1002',
        ...resultStyle,
      } as Partial<CSSStyleDeclaration>,
      resultItem: {
        padding: '10px 12px',
        cursor: 'pointer',
        borderBottom: '1px solid rgba(72, 110, 158, 0.38)',
        color: '#ffffff',
        background: 'transparent',
        transition: 'background-color 0.2s',
        ...resultItemStyle,
      } as Partial<CSSStyleDeclaration>,
    };
  }

  /**
   * 初始化按钮
   * @param button 按钮实例
   */
  initialize(button: ToolbarButton): void {
    this.button = button;

    if (this.useI18n && this.i18n) {
      this.i18n.bindElement(button.getElement(), 'toolbar.search', 'title');
    } else {
      button.setAttribute('title', '搜索');
    }
  }

  /**
   * 处理点击事件
   */
  handleClick(): void {
    if (!this.toolbarElement || !this.button) return;
    const buttonElement = this.button.getElement();
    this.toggleSearch(buttonElement);
  }

  /**
   * 处理鼠标离开事件
   */
  handleMouseLeave(): void {
    if (this.searchContainer) {
      setTimeout(() => {
        const activeElement = document.activeElement;
        if (
          this.searchContainer &&
          !this.searchContainer.matches(':hover') &&
          (!(activeElement instanceof HTMLElement) || activeElement.tagName !== 'INPUT')
        ) {
          this.closeSearch();
        }
      }, 100);
    }
  }

  /**
   * 销毁处理器
   */
  destroy(): void {
    this.closeSearch();
    this.button = null;
  }

  /**
   * 切换搜索框显示
   * @param anchor 锚点元素
   */
  toggleSearch(anchor: HTMLElement): void {
    if (this.searchContainer) {
      this.closeSearch();
    } else {
      this.showSearch(anchor);
    }
  }

  /**
   * 显示搜索框
   * @param anchor 锚点元素
   */
  private showSearch(anchor: HTMLElement): void {
    if (!this.toolbarElement) return;

    this.closeOtherMenus('search');
    this.ensureScrollbarStyles();

    const defaultStyles = this.getDefaultStyles();
    const userStyles = this.normalizeStyleConfig(this.styleConfig);

    const placeholder = this.useI18n && this.i18n
      ? this.i18n.t('toolbar.search_placeholder')
      : '请输入搜索内容...';

    // 合并样式
    const containerStyle = { ...defaultStyles.container, ...userStyles.containerStyle };
    const inputStyle = { ...defaultStyles.input, ...userStyles.inputStyle };
    const actionButtonStyle = { ...defaultStyles.actionButton, ...userStyles.actionButtonStyle };
    const actionIconStyle = { ...defaultStyles.actionIcon, ...userStyles.actionIconStyle };

    // 创建容器
    this.searchContainer = document.createElement('div');
    this.searchContainer.className = 'search-container';
    Object.assign(this.searchContainer.style, containerStyle);

    // 定位
    this.searchContainer.style.top = `${anchor.offsetTop}px`;

    // 输入框
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    Object.assign(input.style, inputStyle);
    input.addEventListener('input', () => {
      if (!input.value.trim()) {
        this.clearSearchResults();
      }
      syncActionButton();
    });

    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    Object.assign(actionBtn.style, actionButtonStyle);

    const syncActionButton = () => {
      if (!actionBtn) {
        return;
      }
      const hasValue = input.value.trim().length > 0;
      const icon = hasValue
        ? (this.options.clearActionIcon ?? '✕')
        : (this.options.idleActionIcon ?? searchIcon);

      actionBtn.innerHTML = '';
      const iconElement = this.createActionIconElement(icon, actionIconStyle, hasValue ? 'clear' : 'search');
      actionBtn.appendChild(iconElement);
      actionBtn.setAttribute('aria-label', hasValue ? 'clear search' : 'search');
    };

    actionBtn.addEventListener('click', () => {
      const query = input.value.trim();
      if (!query) {
        input.focus();
        return;
      }

      input.value = '';
      this.clearSearchResults();
      syncActionButton();
      input.focus();
    });

    // 回车搜索
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = input.value.trim();
        if (query) {
          this.doSearch(query);
        }
      }
    });

    // 失焦关闭
    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (!this.searchContainer?.matches(':hover')) {
          this.closeSearch();
        }
      }, 150);
    });

    this.searchContainer.appendChild(input);
    this.searchContainer.appendChild(actionBtn);
    this.toolbarElement.appendChild(this.searchContainer);

    syncActionButton();

    this.adjustSearchPosition();
    setTimeout(() => input.focus(), 100);
  }

  /**
   * 执行搜索
   * @param query 搜索关键词
   */
  private async doSearch(query: string): Promise<void> {
    const { onSearch, searchService } = this.options;

    try {
      let results: any[] = [];
      if (searchService && typeof searchService.search === 'function') {
        results = await searchService.search(query);
      } else if (onSearch) {
        results = await onSearch(query);
      }

      this.showSearchResults(Array.isArray(results) ? results : []);
    } catch (error) {
      console.error('搜索失败:', error);
    }
  }

  /**
   * 显示搜索结果
   * @param results 搜索结果数组
   */
  private showSearchResults(results: any[]): void {
    if (!this.searchContainer) return;

    this.clearSearchResults();

    const defaultStyles = this.getDefaultStyles();
    const userStyles = this.normalizeStyleConfig(this.styleConfig);

    const resultStyle = { ...defaultStyles.result, ...userStyles.resultStyle };
    const resultItemStyle = { ...defaultStyles.resultItem, ...userStyles.resultItemStyle };
    const hoverStyle = userStyles.resultItemHoverStyle || { backgroundColor: 'rgba(16, 56, 109, 0.96)' };
    const activeStyle = userStyles.resultItemActiveStyle || { backgroundColor: 'rgba(20, 74, 145, 0.96)' };

    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'search-results';
    Object.assign(resultsContainer.style, resultStyle);

    if (results.length === 0) {
      const emptyState = document.createElement('div');
      Object.assign(emptyState.style, resultItemStyle, {
        cursor: 'default',
        color: 'rgba(210, 225, 244, 0.72)',
        fontSize: '13px',
        lineHeight: '1.5',
        textAlign: 'center',
      } as Partial<CSSStyleDeclaration>);
      emptyState.textContent = this.getEmptyResultText();
      resultsContainer.appendChild(emptyState);
      this.searchContainer.appendChild(resultsContainer);
      return;
    }

    results.forEach((result) => {
      const item = document.createElement('div');
      Object.assign(item.style, resultItemStyle);
      item.style.display = 'flex';
      item.style.flexDirection = 'column';
      item.style.alignItems = 'flex-start';
      item.style.gap = '6px';

      const nameElement = document.createElement('div');
      const fallbackLabel = typeof result === 'string'
        ? result
        : (typeof result?.name === 'string' && result.name.trim())
          ? result.name.trim()
          : (typeof result?.address === 'string' && result.address.trim())
            ? result.address.trim()
            : '';
      nameElement.textContent = fallbackLabel;
      Object.assign(nameElement.style, {
        width: '100%',
        fontSize: '15px',
        fontWeight: '600',
        lineHeight: '1.2',
        color: '#f4f9ff',
        wordBreak: 'break-word',
      } as Partial<CSSStyleDeclaration>);

      const addressText = typeof result.address === 'string' ? result.address.trim() : '';
      if (addressText) {
        const addressElement = document.createElement('div');
        addressElement.textContent = addressText;
        Object.assign(addressElement.style, {
          width: '100%',
          fontSize: '12px',
          fontWeight: '400',
          lineHeight: '1.45',
          color: 'rgba(210, 225, 244, 0.88)',
          wordBreak: 'break-word',
        } as Partial<CSSStyleDeclaration>);
        item.appendChild(addressElement);
      }

      item.prepend(nameElement);

      item.addEventListener('mouseenter', () => {
        Object.assign(item.style, hoverStyle);
      });

      item.addEventListener('mouseleave', () => {
        Object.assign(item.style, resultItemStyle); // 恢复默认
      });

      item.addEventListener('click', () => {
        Object.assign(item.style, activeStyle);
        this.options.onSelect?.(result);
        this.closeSearch();
      });

      resultsContainer.appendChild(item);
    });

    this.searchContainer.appendChild(resultsContainer);
  }

  /**
   * 调整搜索框位置避免溢出视口
   */
  private adjustSearchPosition(): void {
    if (!this.searchContainer) return;

    const rect = this.searchContainer.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    if (rect.right > viewportWidth) {
      this.searchContainer.style.right = '';
      this.searchContainer.style.left = '100%';
      this.searchContainer.style.marginRight = '';
      this.searchContainer.style.marginLeft = '8px';
    }
  }

  private createActionIconElement(
    icon: string | HTMLElement,
    style: Partial<CSSStyleDeclaration>,
    fallbackText: string,
  ): HTMLElement {
    if (icon instanceof HTMLElement) {
      const wrapper = document.createElement('span');
      Object.assign(wrapper.style, style);
      wrapper.appendChild(icon.cloneNode(true));
      return wrapper;
    }

    if (this.isImagePath(icon)) {
      const image = document.createElement('img');
      image.src = icon;
      image.alt = fallbackText;
      Object.assign(image.style, style);
      return image;
    }

    const text = document.createElement('span');
    text.textContent = icon;
    Object.assign(text.style, style);
    return text;
  }

  private isImagePath(icon: string): boolean {
    return /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(icon) || icon.startsWith('data:image');
  }

  /**
   * 关闭搜索框
   */
  closeSearch(): void {
    if (this.searchContainer) {
      this.searchContainer.remove();
      this.searchContainer = null;
    }
  }
}


