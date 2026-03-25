/**
 * 搜索按钮处理器
 * 处理搜索功能的按钮点击、搜索框显示等逻辑
 */

import { BaseButtonHandler } from './BaseButtonHandler';
import type { ToolbarButton } from '../../../../components/ToolbarButton';

/**
 * 搜索按钮处理器配置
 */
export interface SearchButtonHandlerOptions {
  /** 搜索服务实例 */
  searchService?: any;
  
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
  }

  /**
   * 初始化按钮
   * @param button 按钮实例
   */
  initialize(button: ToolbarButton): void {
    this.button = button;
    
    // 设置按钮标题
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
   * 处理鼠标进入事件
   */
  handleMouseEnter(): void {
    // 可以在这里添加悬停提示
  }

  /**
   * 处理鼠标离开事件
   */
  handleMouseLeave(): void {
    // 延迟关闭搜索框，给用户时间移动到搜索框上
    if (this.searchContainer) {
      setTimeout(() => {
        if (this.searchContainer && !this.searchContainer.matches(':hover')) {
          const input = this.searchContainer.querySelector('input') as HTMLInputElement;
          const isInputFocused = input && document.activeElement === input;
          if (!isInputFocused) {
            this.closeSearch();
          }
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

    // 关闭其他菜单
    this.closeOtherMenus('search');

    // 创建搜索容器
    this.searchContainer = document.createElement('div');
    this.searchContainer.className = 'search-container';
    this.searchContainer.style.cssText = `
      position: absolute;
      right: 100%;
      margin-right: 8px;
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      padding: 8px;
      z-index: 1001;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 200px;
    `;

    // 定位
    const offsetTop = anchor.offsetTop;
    this.searchContainer.style.top = `${offsetTop}px`;

    // 创建搜索输入框
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = this.useI18n ? this.t('toolbar.search_placeholder', '请输入搜索内容...') : '请输入搜索内容...';
    input.style.cssText = `
      flex: 1;
      padding: 6px 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
      outline: none;
    `;

    // 搜索按钮
    const searchBtn = document.createElement('button');
    searchBtn.textContent = '🔍';
    searchBtn.style.cssText = `
      padding: 6px 10px;
      border: none;
      background: #007acc;
      color: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;
    searchBtn.addEventListener('click', () => {
      const query = input.value.trim();
      if (query) {
        this.doSearch(query);
      }
    });

    // 输入框回车搜索
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = input.value.trim();
        if (query) {
          this.doSearch(query);
        }
      }
    });

    // 输入框获得焦点时保持打开
    input.addEventListener('focus', () => {
      // 保持搜索框打开
    });

    // 输入框失去焦点时关闭
    input.addEventListener('blur', () => {
      setTimeout(() => {
        this.closeSearch();
      }, 200);
    });

    this.searchContainer.appendChild(input);
    this.searchContainer.appendChild(searchBtn);
    this.toolbarElement.appendChild(this.searchContainer);

    // 调整位置避免溢出
    this.adjustSearchPosition();

    // 自动聚焦输入框
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
        // 显示搜索结果
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

    // 移除现有结果列表
    const existingResults = this.searchContainer.querySelector('.search-results');
    if (existingResults) {
      existingResults.remove();
    }

    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'search-results';
    resultsContainer.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      max-height: 300px;
      overflow-y: auto;
      z-index: 1002;
    `;

    results.forEach(result => {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
        transition: background-color 0.2s;
      `;
      item.textContent = result.name || result.address || JSON.stringify(result);
      
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = '#f0f0f0';
      });
      
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'white';
      });
      
      item.addEventListener('click', () => {
        this.options.onSelect?.(result);
        this.closeSearch();
      });
      
      resultsContainer.appendChild(item);
    });

    this.searchContainer.appendChild(resultsContainer);
  }

  /**
   * 调整搜索框位置
   */
  private adjustSearchPosition(): void {
    if (!this.searchContainer) return;

    const rect = this.searchContainer.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    // 如果右侧空间不足，调整到左侧
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