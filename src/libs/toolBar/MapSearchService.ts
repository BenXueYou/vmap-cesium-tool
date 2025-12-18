import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';
import type { SearchResult, SearchCallback } from '../CesiumMapModel';
import { TD_Map_Search_URL, China_Map_Extent } from '../../hooks/useMap';

/**
 * 搜索服务类
 * 负责处理地图搜索相关的所有逻辑
 */
export class SearchService {
  private viewer: Viewer;
  private toolbarElement: HTMLElement;
  private searchCallback?: SearchCallback;
  private searchContainer: HTMLElement | null = null;

  constructor(viewer: Viewer, toolbarElement: HTMLElement, searchCallback?: SearchCallback) {
    this.viewer = viewer;
    this.toolbarElement = toolbarElement;
    this.searchCallback = searchCallback;
  }

  /**
   * 设置搜索回调
   */
  public setSearchCallback(callback: SearchCallback): void {
    this.searchCallback = callback;
  }

  /**
   * 切换搜索功能
   */
  public toggleSearch(buttonElement: HTMLElement): void {
    const existingSearch = this.toolbarElement.querySelector('.search-container');
    if (existingSearch) {
      return; // 如果搜索框已存在，不重复创建
    }

    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    searchContainer.style.cssText = `
      position: absolute;
      right: 100%;
      top: 0;
      margin-right: 8px;
      background: rgba(0, 40, 80, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      padding: 8px;
      min-width: 200px;
      z-index: 1001;
    `;

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = '请输入地址';
    searchInput.style.cssText = `
      padding: 6px 8px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      background: rgba(0, 40, 80, 0.95);
      color: #fff;
      font-size: 14px;
      outline: none;
      width: 100%;
      box-sizing: border-box;
    `;

    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'search-results';
    resultsContainer.style.cssText = `
      margin-top: 8px;
      max-height: 200px;
      overflow-y: auto;
    `;

    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(resultsContainer);

    // 插入到按钮前面
    this.toolbarElement.insertBefore(searchContainer, buttonElement);
    this.searchContainer = searchContainer;

    // 搜索功能
    let searchTimeout: ReturnType<typeof setTimeout>;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      const query = searchInput.value.trim();

      // 如果用户提供了自定义搜索输入处理逻辑
      if (this.searchCallback?.onSearchInput) {
        this.searchCallback.onSearchInput(query, resultsContainer);
        return;
      }

      if (query.length < 2) {
        resultsContainer.innerHTML = '';
        return;
      }

      searchTimeout = setTimeout(async () => {
        if (this.searchCallback?.onSearch) {
          try {
            const results = await this.searchCallback.onSearch(query);
            this.displaySearchResults(results, resultsContainer);
          } catch (error) {
            console.error('搜索失败:', error);
            resultsContainer.innerHTML = '<div style="padding: 8px; color: #666;">搜索失败</div>';
          }
        } else {
          // 默认搜索逻辑：使用天地图 POI 搜索接口
          try {
            const results = await this.performDefaultSearch(query);
            this.displaySearchResults(results, resultsContainer);
          } catch (error) {
            console.error('默认搜索失败:', error);
            resultsContainer.innerHTML = '<div style="padding: 8px; color: #666;">搜索失败</div>';
          }
        }
      }, 300);
    });

    // 鼠标离开搜索框时关闭（延迟关闭，给用户时间移回按钮或其他区域）
    let closeTimeout: ReturnType<typeof setTimeout>;
    const handleSearchContainerLeave = (event: MouseEvent) => {
      // 检查鼠标是否移到了其他工具栏按钮上
      const target = event.relatedTarget as HTMLElement;
      const isMovingToButton = target && (
        target.closest('.cesium-toolbar-button') !== null ||
        target.closest('.cesium-map-toolbar') !== null
      );

      // 如果移到了其他按钮，立即关闭搜索框，让其他按钮的hover事件能正常触发
      if (isMovingToButton) {
        clearTimeout(closeTimeout);
        this.closeSearchContainer();
        searchContainer.removeEventListener('mouseleave', handleSearchContainerLeave);
        searchContainer.removeEventListener('mouseenter', handleSearchContainerEnter);
        searchInput.removeEventListener('blur', handleInputBlur);
        return;
      }

      closeTimeout = setTimeout(() => {
        // 检查鼠标是否在搜索框、按钮或其他工具栏按钮上
        const isHoveringSearch = searchContainer.matches(':hover');
        const isHoveringButton = buttonElement.matches(':hover');
        const isHoveringToolbar = this.toolbarElement.matches(':hover');
        const isInputFocused = document.activeElement === searchInput;

        // 如果不在搜索框、按钮或工具栏上，且输入框未聚焦，则关闭
        if (!isHoveringSearch && !isHoveringButton && !isHoveringToolbar && !isInputFocused) {
          this.closeSearchContainer();
          searchContainer.removeEventListener('mouseleave', handleSearchContainerLeave);
          searchContainer.removeEventListener('mouseenter', handleSearchContainerEnter);
          searchInput.removeEventListener('blur', handleInputBlur);
        }
      }, 150);
    };

    // 鼠标进入搜索框时清除关闭定时器
    const handleSearchContainerEnter = () => {
      clearTimeout(closeTimeout);
    };

    // 输入框失去焦点时的处理
    const handleInputBlur = () => {
      // 延迟检查，给用户时间点击搜索结果
      setTimeout(() => {
        const isHoveringSearch = searchContainer.matches(':hover');
        const isHoveringButton = buttonElement.matches(':hover');
        const isHoveringToolbar = this.toolbarElement.matches(':hover');
        const isInputFocused = document.activeElement === searchInput;

        // 如果输入框重新获得焦点，不关闭
        if (isInputFocused) {
          return;
        }

        if (!isHoveringSearch && !isHoveringButton && !isHoveringToolbar) {
          this.closeSearchContainer();
          searchContainer.removeEventListener('mouseleave', handleSearchContainerLeave);
          searchContainer.removeEventListener('mouseenter', handleSearchContainerEnter);
          searchInput.removeEventListener('blur', handleInputBlur);
        }
      }, 200);
    };

    // 添加ESC键关闭搜索框的逻辑
    const closeSearchOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.closeSearchContainer();
        searchContainer.removeEventListener('mouseleave', handleSearchContainerLeave);
        searchContainer.removeEventListener('mouseenter', handleSearchContainerEnter);
        searchInput.removeEventListener('blur', handleInputBlur);
        document.removeEventListener('keydown', closeSearchOnEscape);
      }
    };

    // 绑定事件
    searchContainer.addEventListener('mouseleave', handleSearchContainerLeave);
    searchContainer.addEventListener('mouseenter', handleSearchContainerEnter);
    searchInput.addEventListener('blur', handleInputBlur);
    document.addEventListener('keydown', closeSearchOnEscape);

    // 延迟聚焦，避免立即触发blur事件
    setTimeout(() => {
      searchInput.focus();
    }, 100);
  }

  /**
   * 执行默认搜索（使用天地图 API）
   */
  private async performDefaultSearch(query: string): Promise<SearchResult[]> {
    const url = TD_Map_Search_URL(query, China_Map_Extent);
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const pois = data?.data?.pois || data?.pois || [];
    return pois.map((location: any) => ({
      name: location?.name || query,
      address: location?.address || '',
      longitude: Number(location?.lonlat?.split(',')[0] || 0),
      latitude: Number(location?.lonlat?.split(',')[1] || 0),
      height: 100,
    }));
  }

  /**
   * 显示搜索结果
   */
  public displaySearchResults(results: SearchResult[], container: HTMLElement): void {
    // 如果用户提供了自定义搜索结果处理逻辑
    if (this.searchCallback?.onSearchResults) {
      this.searchCallback.onSearchResults(results, container);
      return;
    }

    // 默认搜索结果显示逻辑
    container.innerHTML = '';

    if (results.length === 0) {
      container.innerHTML = '<div style="padding: 8px; color: #666;">未找到相关地址</div>';
      return;
    }

    results.forEach(result => {
      const resultItem = document.createElement('div');
      resultItem.style.cssText = `
        padding: 8px;
        border-bottom: 1px solid #f0f0f0;
        cursor: pointer;
        transition: background-color 0.2s;
      `;

      resultItem.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 2px;">${result.name}</div>
        <div style="font-size: 12px; color: #666;">${result.address}</div>
      `;

      resultItem.addEventListener('mouseenter', () => {
        resultItem.style.backgroundColor = '#f5f5f5';
      });

      resultItem.addEventListener('mouseleave', () => {
        resultItem.style.backgroundColor = 'transparent';
      });

      resultItem.addEventListener('click', () => {
        this.selectSearchResult(result);
        container.parentElement?.remove();
        this.searchContainer = null;
      });

      container.appendChild(resultItem);
    });
  }

  /**
   * 选择搜索结果
   */
  public selectSearchResult(result: SearchResult): void {
    // 飞行到指定位置
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        result.longitude,
        result.latitude,
        result.height || 1000
      ),
      duration: 1.0
    });

    // 触发回调
    if (this.searchCallback?.onSelect) {
      this.searchCallback.onSelect(result);
    }
  }

  /**
   * 关闭搜索框
   */
  public closeSearchContainer(): void {
    const searchContainer = this.toolbarElement.querySelector('.search-container');
    if (searchContainer) {
      searchContainer.remove();
      this.searchContainer = null;
    }
  }

  /**
   * 销毁搜索服务
   */
  public destroy(): void {
    this.closeSearchContainer();
    this.searchCallback = undefined;
  }
}

