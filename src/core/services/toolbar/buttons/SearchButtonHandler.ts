/**
 * 搜索按钮处理器
 * 处理搜索功能的按钮点击、搜索框显示等逻辑
 */

import { BaseButtonHandler } from './BaseButtonHandler';
import type { ToolbarButton } from '../../../../components/ToolbarButton';

interface SearchContainerStyleConfig {
  inputStyle?: Partial<CSSStyleDeclaration>;
  buttonStyle?: Partial<CSSStyleDeclaration>;
  containerStyle?: Partial<CSSStyleDeclaration>;
  resultStyle?: Partial<CSSStyleDeclaration>;
  resultItemStyle?: Partial<CSSStyleDeclaration>;
  resultItemHoverStyle?: Partial<CSSStyleDeclaration>;
  resultItemActiveStyle?: Partial<CSSStyleDeclaration>;
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

  private options: SearchButtonHandlerOptions;
  private styleConfig: SearchContainerStyleConfig = {};

  private searchContainer: HTMLElement | null = null;

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
    this.styleConfig = (options.searchContainerStyle || {}) as SearchContainerStyleConfig;
  }

  updateOptions(options: Partial<SearchButtonHandlerOptions>): void {
    this.options.searchService = options.searchService ?? this.options.searchService;
    this.options.searchContainerStyle = options.searchContainerStyle ?? this.options.searchContainerStyle;
    this.options.onSearch = options.onSearch ?? this.options.onSearch;
    this.options.onSelect = options.onSelect ?? this.options.onSelect;

    if (options.searchContainerStyle) {
      const nextStyleConfig = options.searchContainerStyle as SearchContainerStyleConfig;
      this.styleConfig.inputStyle = nextStyleConfig.inputStyle ?? this.styleConfig.inputStyle;
      this.styleConfig.buttonStyle = nextStyleConfig.buttonStyle ?? this.styleConfig.buttonStyle;
      this.styleConfig.containerStyle = nextStyleConfig.containerStyle ?? this.styleConfig.containerStyle;
      this.styleConfig.resultStyle = nextStyleConfig.resultStyle ?? this.styleConfig.resultStyle;
      this.styleConfig.resultItemStyle = nextStyleConfig.resultItemStyle ?? this.styleConfig.resultItemStyle;
      this.styleConfig.resultItemHoverStyle = nextStyleConfig.resultItemHoverStyle ?? this.styleConfig.resultItemHoverStyle;
      this.styleConfig.resultItemActiveStyle = nextStyleConfig.resultItemActiveStyle ?? this.styleConfig.resultItemActiveStyle;
      this.styleConfig.resultItemIconStyle = nextStyleConfig.resultItemIconStyle ?? this.styleConfig.resultItemIconStyle;
    }
  }

  /**
   * 获取默认样式
   */
  private getDefaultStyles() {
    const styleConfig: SearchContainerStyleConfig = this.styleConfig;
    const {
      inputStyle = {},
      buttonStyle = {},
      containerStyle = {},
      resultStyle = {},
      resultItemStyle = {},
      resultItemHoverStyle = {},
      resultItemActiveStyle = {},
      resultItemIconStyle = {},
    } = styleConfig;

    void resultItemHoverStyle;
    void resultItemActiveStyle;
    void resultItemIconStyle;

    return {
      container: {
        position: 'absolute',
        right: '100%',
        marginRight: '8px',
        background: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        padding: '8px',
        zIndex: '1001',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minWidth: '200px',
        ...containerStyle,
      } as Partial<CSSStyleDeclaration>,
      input: {
        flex: '1',
        padding: '6px 10px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '13px',
        outline: 'none',
        ...inputStyle,
      } as Partial<CSSStyleDeclaration>,
      button: {
        padding: '0',
        border: 'none',
        background: 'transparent',
        color: '#999',
        cursor: 'pointer',
        fontSize: '14px',
        width: '20px',
        height: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...buttonStyle,
      } as Partial<CSSStyleDeclaration>,
      result: {
        position: 'absolute',
        top: '100%',
        left: '0',
        right: '0',
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        maxHeight: '300px',
        overflowY: 'auto',
        zIndex: '1002',
        ...resultStyle,
      } as Partial<CSSStyleDeclaration>,
      resultItem: {
        padding: '8px 12px',
        cursor: 'pointer',
        borderBottom: '1px solid #eee',
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
        if (
          this.searchContainer &&
          !this.searchContainer.matches(':hover') &&
          document.activeElement?.tagName !== 'INPUT'
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

    const defaultStyles = this.getDefaultStyles();
    const userStyles: SearchContainerStyleConfig = this.styleConfig;

    // 合并样式
    const containerStyle = { ...defaultStyles.container, ...userStyles.containerStyle };
    const inputStyle = { ...defaultStyles.input, ...userStyles.inputStyle };
    const buttonStyle = { ...defaultStyles.button, ...userStyles.buttonStyle };

    // 创建容器
    this.searchContainer = document.createElement('div');
    this.searchContainer.className = 'search-container';
    Object.assign(this.searchContainer.style, containerStyle);

    // 定位
    this.searchContainer.style.top = `${anchor.offsetTop}px`;

    // 输入框
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = this.useI18n && this.i18n
      ? (this.i18n as any).t('toolbar.search_placeholder')
      : '请输入搜索内容...';
    Object.assign(input.style, inputStyle);

    // 清除按钮（仅清空）
    const clearBtn = document.createElement('button');
    clearBtn.textContent = '✕';
    Object.assign(clearBtn.style, buttonStyle);
    clearBtn.addEventListener('click', () => {
      input.value = '';
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
    this.searchContainer.appendChild(clearBtn);
    this.toolbarElement.appendChild(this.searchContainer);

    this.adjustSearchPosition();
    setTimeout(() => input.focus(), 100);
  }

  /**
   * 执行搜索
   * @param query 搜索关键词
   */
  private async doSearch(query: string): Promise<void> {
    const { onSearch, onSelect, searchService } = this.options;

    try {
      let results: any[] = [];

      if (searchService && typeof searchService.search === 'function') {
        results = await searchService.search(query);
      } else if (onSearch) {
        results = await onSearch(query);
      }

      if (results && results.length > 0) {
        this.showSearchResults(results);
      }
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

    const existingResults = this.searchContainer.querySelector('.search-results');
    if (existingResults) {
      existingResults.remove();
    }

    const defaultStyles = this.getDefaultStyles();
    const userStyles = this.styleConfig || {};

    const resultStyle = { ...defaultStyles.result, ...userStyles.resultStyle };
    const resultItemStyle = { ...defaultStyles.resultItem, ...userStyles.resultItemStyle };
    const hoverStyle = userStyles.resultItemHoverStyle || { backgroundColor: '#f0f0f0' };
    const activeStyle = userStyles.resultItemActiveStyle || { backgroundColor: '#e0e0e0' };

    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'search-results';
    Object.assign(resultsContainer.style, resultStyle);

    results.forEach((result) => {
      const item = document.createElement('div');
      Object.assign(item.style, resultItemStyle);
      item.textContent = result.name || result.address || JSON.stringify(result);

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


