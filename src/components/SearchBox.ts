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
export class SearchBox extends BaseComponent {
  private config: SearchBoxConfig;
  private inputElement: HTMLInputElement;
  private clearButton: HTMLElement | null = null;
  private resultsContainer: HTMLElement | null = null;
  private debounceTimer: number | null = null;
  private onSearchCallback?: (query: string) => Promise<SearchResult[]>;
  private onSelectCallback?: (result: SearchResult) => void;
  private currentResults: SearchResult[] = [];

  /**
   * 构造函数
   * @param config 搜索框配置
   * @param styleConfig 样式配置
   */
  constructor(config: SearchBoxConfig = {}, styleConfig: StyleConfig = {}) {
    super('div', {
      className: 'vmap-search-box',
      style: {
        position: 'relative',
        minWidth: '200px',
        ...styleConfig.style,
      },
      ...styleConfig,
    });

    this.config = {
      placeholder: '搜索地点...',
      debounceTime: 300,
      minQueryLength: 2,
      maxResults: 10,
      showClearButton: true,
      autoFocus: false,
      ...config,
    };

    this.inputElement = document.createElement('input');
    this.setupInput();
    this.setupClearButton();
    this.setupResultsContainer();
  }

  /**
   * 设置输入框
   */
  private setupInput(): void {
    this.inputElement.type = 'text';
    this.inputElement.placeholder = this.config.placeholder!;
    this.inputElement.style.width = '100%';
    this.inputElement.style.padding = '8px 12px';
    this.inputElement.style.border = '1px solid #ddd';
    this.inputElement.style.borderRadius = '4px';
    this.inputElement.style.fontSize = '14px';
    this.inputElement.style.outline = 'none';
    this.inputElement.style.boxSizing = 'border-box';

    if (this.config.autoFocus) {
      this.inputElement.autofocus = true;
    }

    // 输入事件
    this.inputElement.addEventListener('input', this.handleInput.bind(this));
    
    // 键盘事件
    this.inputElement.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    // 聚焦事件
    this.inputElement.addEventListener('focus', this.handleFocus.bind(this));
    
    // 失焦事件
    this.inputElement.addEventListener('blur', this.handleBlur.bind(this));

    this.element.appendChild(this.inputElement);
  }

  /**
   * 设置清除按钮
   */
  private setupClearButton(): void {
    if (!this.config.showClearButton) return;

    this.clearButton = document.createElement('button');
    this.clearButton.innerHTML = '×';
    this.clearButton.style.position = 'absolute';
    this.clearButton.style.right = '8px';
    this.clearButton.style.top = '50%';
    this.clearButton.style.transform = 'translateY(-50%)';
    this.clearButton.style.background = 'none';
    this.clearButton.style.border = 'none';
    this.clearButton.style.fontSize = '18px';
    this.clearButton.style.cursor = 'pointer';
    this.clearButton.style.color = '#999';
    this.clearButton.style.padding = '0';
    this.clearButton.style.width = '20px';
    this.clearButton.style.height = '20px';
    this.clearButton.style.display = 'none';

    this.clearButton.addEventListener('click', () => {
      this.clear();
      this.inputElement.focus();
    });

    this.element.appendChild(this.clearButton);
  }

  /**
   * 设置结果容器
   */
  private setupResultsContainer(): void {
    this.resultsContainer = document.createElement('div');
    this.resultsContainer.className = 'vmap-search-results';
    this.resultsContainer.style.position = 'absolute';
    this.resultsContainer.style.top = '100%';
    this.resultsContainer.style.left = '0';
    this.resultsContainer.style.right = '0';
    this.resultsContainer.style.background = 'white';
    this.resultsContainer.style.border = '1px solid #ddd';
    this.resultsContainer.style.borderRadius = '4px';
    this.resultsContainer.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
    this.resultsContainer.style.marginTop = '4px';
    this.resultsContainer.style.maxHeight = '300px';
    this.resultsContainer.style.overflowY = 'auto';
    this.resultsContainer.style.zIndex = '1001';
    this.resultsContainer.style.display = 'none';

    this.element.appendChild(this.resultsContainer);
  }

  /**
   * 处理输入事件
   */
  private handleInput(event: Event): void {
    const query = this.inputElement.value.trim();
    
    // 显示/隐藏清除按钮
    if (this.clearButton) {
      this.clearButton.style.display = query ? '' : 'none';
    }

    // 清除之前的防抖定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // 如果查询太短，隐藏结果
    if (query.length < this.config.minQueryLength!) {
      this.hideResults();
      return;
    }

    // 设置防抖定时器
    this.debounceTimer = window.setTimeout(() => {
      this.performSearch(query);
    }, this.config.debounceTime);
  }

  /**
   * 处理键盘事件
   */
  private handleKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        this.hideResults();
        break;
      case 'Enter':
        if (this.currentResults.length > 0) {
          this.selectResult(this.currentResults[0]);
        }
        break;
      case 'ArrowUp':
      case 'ArrowDown':
        event.preventDefault();
        this.navigateResults(event.key === 'ArrowDown' ? 1 : -1);
        break;
    }
  }

  /**
   * 处理聚焦事件
   */
  private handleFocus(): void {
    if (this.inputElement.value.trim().length >= this.config.minQueryLength!) {
      this.showResults();
    }
  }

  /**
   * 处理失焦事件
   */
  private handleBlur(): void {
    // 延迟隐藏结果，以便点击结果
    setTimeout(() => {
      this.hideResults();
    }, 200);
  }

  /**
   * 执行搜索
   */
  private async performSearch(query: string): Promise<void> {
    if (!this.onSearchCallback) {
      console.warn('搜索回调未设置');
      return;
    }

    try {
      const results = await this.onSearchCallback(query);
      this.currentResults = results.slice(0, this.config.maxResults);
      this.displayResults(this.currentResults);
    } catch (error) {
      console.error('搜索失败:', error);
      this.displayError('搜索失败，请重试');
    }
  }

  /**
   * 显示搜索结果
   */
  private displayResults(results: SearchResult[]): void {
    if (!this.resultsContainer) return;

    this.resultsContainer.innerHTML = '';

    if (results.length === 0) {
      const noResults = document.createElement('div');
      noResults.textContent = '未找到结果';
      noResults.style.padding = '12px';
      noResults.style.textAlign = 'center';
      noResults.style.color = '#999';
      this.resultsContainer.appendChild(noResults);
    } else {
      results.forEach((result, index) => {
        const resultElement = this.createResultElement(result, index === 0);
        this.resultsContainer!.appendChild(resultElement);
      });
    }

    this.showResults();
  }

  /**
   * 显示错误信息
   */
  private displayError(message: string): void {
    if (!this.resultsContainer) return;

    this.resultsContainer.innerHTML = '';
    
    const errorElement = document.createElement('div');
    errorElement.textContent = message;
    errorElement.style.padding = '12px';
    errorElement.style.textAlign = 'center';
    errorElement.style.color = '#f44336';
    this.resultsContainer.appendChild(errorElement);
    
    this.showResults();
  }

  /**
   * 创建结果元素
   */
  private createResultElement(result: SearchResult, isFirst: boolean = false): HTMLElement {
    const element = document.createElement('div');
    element.className = 'vmap-search-result';
    element.style.padding = '8px 12px';
    element.style.borderBottom = '1px solid #f0f0f0';
    element.style.cursor = 'pointer';
    element.style.transition = 'background-color 0.2s';
    
    if (isFirst) {
      element.style.backgroundColor = '#f5f5f5';
    }

    // 名称
    const nameElement = document.createElement('div');
    nameElement.textContent = result.name;
    nameElement.style.fontWeight = 'bold';
    nameElement.style.marginBottom = '4px';

    // 地址
    const addressElement = document.createElement('div');
    addressElement.textContent = result.address;
    addressElement.style.fontSize = '12px';
    addressElement.style.color = '#666';

    element.appendChild(nameElement);
    element.appendChild(addressElement);

    // 点击事件
    element.addEventListener('click', () => {
      this.selectResult(result);
    });

    // 鼠标事件
    element.addEventListener('mouseenter', () => {
      element.style.backgroundColor = '#f5f5f5';
    });

    element.addEventListener('mouseleave', () => {
      element.style.backgroundColor = isFirst ? '#f5f5f5' : 'transparent';
    });

    return element;
  }

  /**
   * 导航结果
   */
  private navigateResults(direction: number): void {
    const results = this.resultsContainer?.querySelectorAll('.vmap-search-result');
    if (!results || results.length === 0) return;

    let currentIndex = -1;
    
    // 查找当前选中的结果
    results.forEach((result, index) => {
      if ((result as HTMLElement).style.backgroundColor === 'rgb(245, 245, 245)') {
        currentIndex = index;
      }
    });

    // 计算新的索引
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = results.length - 1;
    if (newIndex >= results.length) newIndex = 0;

    // 更新选中状态
    results.forEach((result, index) => {
      (result as HTMLElement).style.backgroundColor = index === newIndex ? '#f5f5f5' : 'transparent';
    });

    // 滚动到可见区域
    results[newIndex].scrollIntoView({ block: 'nearest' });
  }

  /**
   * 选择结果
   */
  private selectResult(result: SearchResult): void {
    this.inputElement.value = result.name;
    this.hideResults();

    if (this.onSelectCallback) {
      this.onSelectCallback(result);
    }

    // 触发自定义事件
    const event = new CustomEvent('search-select', {
      detail: { result },
      bubbles: true,
    });
    this.element.dispatchEvent(event);
  }

  /**
   * 显示结果容器
   */
  private showResults(): void {
    if (this.resultsContainer) {
      this.resultsContainer.style.display = 'block';
    }
  }

  /**
   * 隐藏结果容器
   */
  private hideResults(): void {
    if (this.resultsContainer) {
      this.resultsContainer.style.display = 'none';
    }
  }

  /**
   * 设置搜索回调
   */
  setOnSearch(callback: (query: string) => Promise<SearchResult[]>): void {
    this.onSearchCallback = callback;
  }

  /**
   * 设置选择回调
   */
  setOnSelect(callback: (result: SearchResult) => void): void {
    this.onSelectCallback = callback;
  }

  /**
   * 获取当前查询
   */
  getQuery(): string {
    return this.inputElement.value.trim();
  }

  /**
   * 设置查询
   */
  setQuery(query: string): void {
    this.inputElement.value = query;
    this.handleInput(new Event('input'));
  }

  /**
   * 清空搜索框
   */
  clear(): void {
    this.inputElement.value = '';
    this.currentResults = [];
    this.hideResults();
    
    if (this.clearButton) {
      this.clearButton.style.display = 'none';
    }

    // 触发自定义事件
    const event = new CustomEvent('search-clear', { bubbles: true });
    this.element.dispatchEvent(event);
  }

  /**
   * 聚焦输入框
   */
  focus(): void {
    this.inputElement.focus();
  }

  /**
   * 失焦输入框
   */
  blur(): void {
    this.inputElement.blur();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SearchBoxConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.placeholder !== undefined) {
      this.inputElement.placeholder = config.placeholder;
    }
  }

  /**
   * 获取配置
   */
  getConfig(): SearchBoxConfig {
    return { ...this.config };
  }

  /**
   * 销毁组件
   */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    super.destroy();
  }
}

/**
 * 创建搜索框的工厂函数
 */
export function createSearchBox(config?: SearchBoxConfig, styleConfig?: StyleConfig): SearchBox {
  return new SearchBox(config, styleConfig);
}