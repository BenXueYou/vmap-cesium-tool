import * as Cesium from 'cesium';
import type { Viewer, Cartesian3, Cartographic } from 'cesium';
import DrawHelper from './CesiumMapHelper';

// 工具栏配置接口
export interface ToolbarConfig {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  buttonSize?: number;
  buttonSpacing?: number;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  boxShadow?: string;
  zIndex?: number;
}

// 按钮配置接口
export interface ButtonConfig {
  id: string;
  icon: string;
  title: string;
  size?: number;
  color?: string;
  hoverColor?: string;
  activeColor?: string;
}

// 搜索回调接口
export interface SearchCallback {
  onSearch?: (query: string) => Promise<SearchResult[]>;
  onSelect?: (result: SearchResult) => void;
}

// 搜索结果接口
export interface SearchResult {
  name: string;
  address: string;
  longitude: number;
  latitude: number;
  height?: number;
}

// 测量回调接口
export interface MeasurementCallback {
  onDistanceComplete?: (positions: Cartesian3[], distance: number) => void;
  onAreaComplete?: (positions: Cartesian3[], area: number) => void;
  onClear?: () => void;
}

// 缩放回调接口
export interface ZoomCallback {
  onZoomIn?: (beforeLevel: number, afterLevel: number) => void;
  onZoomOut?: (beforeLevel: number, afterLevel: number) => void;
}

// 地图类型接口
export interface MapType {
  id: string;
  name: string;
  thumbnail: string;
  provider: Cesium.ImageryProvider;
}

/**
 * Cesium地图工具栏类
 * 提供搜索、测量、2D/3D切换、图层切换、定位、缩放、全屏等功能
 */
export class CesiumMapToolbar {
  private viewer: Viewer;
  private drawHelper: DrawHelper;
  private container: HTMLElement;
  private toolbarElement!: HTMLElement;
  private config: ToolbarConfig;
  private searchCallback?: SearchCallback;
  private measurementCallback?: MeasurementCallback;
  private zoomCallback?: ZoomCallback;
  private initialCenter?: { longitude: number; latitude: number; height: number };
  private isFullscreen: boolean = false;
  private currentMapType: string = 'imagery';

  // 地图类型配置
  private mapTypes: MapType[] = [
    {
      id: 'normal',
      name: '天地图-普通',
      thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjBmMGYwIi8+CjxwYXRoIGQ9Ik0xMCAxMEgzMFYzMEgxMFYxMFoiIGZpbGw9IiNlMGUwZTAiLz4KPC9zdmc+',
      provider: new Cesium.UrlTemplateImageryProvider({
        url: 'https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=your_token',
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        minimumLevel: 1,
        maximumLevel: 18,
        credit: '© 天地图'
      })
    },
    {
      id: '3d',
      name: '天地图-三维',
      thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjBmMGYwIi8+CjxwYXRoIGQ9Ik0xMCAxMEgzMFYzMEgxMFYxMFoiIGZpbGw9IiNlMGUwZTAiLz4KPC9zdmc+',
      provider: new Cesium.UrlTemplateImageryProvider({
        url: 'https://t{s}.tianditu.gov.cn/ter_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ter&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=your_token',
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        minimumLevel: 1,
        maximumLevel: 18,
        credit: '© 天地图'
      })
    },
    {
      id: 'imagery',
      name: '天地图-影像',
      thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjBmMGYwIi8+CjxwYXRoIGQ9Ik0xMCAxMEgzMFYzMEgxMFYxMFoiIGZpbGw9IiNlMGUwZTAiLz4KPC9zdmc+',
      provider: new Cesium.UrlTemplateImageryProvider({
        url: 'https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=your_token',
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        minimumLevel: 1,
        maximumLevel: 18,
        credit: '© 天地图'
      })
    },
    {
      id: 'terrain',
      name: '天地图-地形',
      thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjBmMGYwIi8+CjxwYXRoIGQ9Ik0xMCAxMEgzMFYzMEgxMFYxMFoiIGZpbGw9IiNlMGUwZTAiLz4KPC9zdmc+',
      provider: new Cesium.UrlTemplateImageryProvider({
        url: 'https://t{s}.tianditu.gov.cn/ter_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ter&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=your_token',
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        minimumLevel: 1,
        maximumLevel: 18,
        credit: '© 天地图'
      })
    }
  ];

  constructor(
    viewer: Viewer,
    container: HTMLElement,
    config: ToolbarConfig = {},
    callbacks?: {
      search?: SearchCallback;
      measurement?: MeasurementCallback;
      zoom?: ZoomCallback;
    },
    initialCenter?: { longitude: number; latitude: number; height: number }
  ) {
    this.viewer = viewer;
    this.container = container;
    this.config = {
      position: 'bottom-right',
      buttonSize: 40,
      buttonSpacing: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#e0e0e0',
      borderRadius: 6,
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
      zIndex: 1000,
      ...config
    };
    this.searchCallback = callbacks?.search;
    this.measurementCallback = callbacks?.measurement;
    this.zoomCallback = callbacks?.zoom;

    // 设置初始中心点
    this.initialCenter = initialCenter;

    // 初始化绘图助手
    this.drawHelper = new DrawHelper(viewer);
    this.setupDrawHelperCallbacks();

    // 创建工具栏
    this.createToolbar();
  }

  /**
   * 设置初始中心点
   */
  public setInitialCenter(center: { longitude: number; latitude: number; height: number }): void {
    this.initialCenter = center;
  }

  /**
   * 获取初始中心点
   */
  public getInitialCenter(): { longitude: number; latitude: number; height: number } | undefined {
    return this.initialCenter;
  }

  /**
   * 复位到初始位置（公共方法）
   */
  public resetToInitialLocation(): void {
    this.resetLocation();
  }

  /**
   * 设置绘图助手回调
   */
  private setupDrawHelperCallbacks(): void {
    this.drawHelper.onDrawStart(() => {
      console.log('开始绘制');
    });

    this.drawHelper.onDrawEnd((entity) => {
      if (entity) {
        console.log('绘制完成', entity);
        // 根据绘制类型触发相应回调
        if (entity.polyline) {
          // 测距完成
          const positions = entity.polyline.positions?.getValue(Cesium.JulianDate.now()) as Cartesian3[];
          if (positions && this.measurementCallback?.onDistanceComplete) {
            let totalDistance = 0;
            for (let i = 1; i < positions.length; i++) {
              totalDistance += Cesium.Cartesian3.distance(positions[i-1], positions[i]);
            }
            this.measurementCallback.onDistanceComplete(positions, totalDistance);
          }
        } else if (entity.polygon) {
          // 测面积完成
          const positions = entity.polygon.hierarchy?.getValue(Cesium.JulianDate.now()) as Cesium.PolygonHierarchy;
          if (positions && this.measurementCallback?.onAreaComplete) {
            // 计算面积
            const area = this.calculatePolygonArea(positions.positions);
            this.measurementCallback.onAreaComplete(positions.positions, area);
          }
        }
      }
    });

    this.drawHelper.onEntityRemoved((entity) => {
      console.log('实体被移除', entity);
    });
  }

  /**
   * 计算多边形面积
   */
  private calculatePolygonArea(positions: Cartesian3[]): number {
    if (positions.length < 3) return 0;
    
    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    let area = 0;
    const len = positions.length;
    
    for (let i = 0; i < len; i++) {
      const p1 = ellipsoid.cartesianToCartographic(positions[i]);
      const p2 = ellipsoid.cartesianToCartographic(positions[(i + 1) % len]);
      area += (p2.longitude - p1.longitude) * (2 + Math.sin(p1.latitude) + Math.sin(p2.latitude));
    }
    
    area = Math.abs(area * 6378137.0 * 6378137.0 / 2.0);
    return area / 1e6; // 转换为平方公里
  }

  /**
   * 创建工具栏
   */
  private createToolbar(): void {
    this.toolbarElement = document.createElement('div');
    this.toolbarElement.className = 'cesium-map-toolbar';
    this.toolbarElement.style.cssText = `
      position: absolute;
      ${this.config.position?.includes('right') ? 'right' : 'left'}: 10px;
      ${this.config.position?.includes('bottom') ? 'bottom' : 'top'}: 10px;
      background: ${this.config.backgroundColor};
      border: ${this.config.borderWidth}px solid ${this.config.borderColor};
      border-radius: ${this.config.borderRadius}px;
      box-shadow: ${this.config.boxShadow};
      padding: 8px;
      z-index: ${this.config.zIndex};
      display: flex;
      flex-direction: column;
      gap: ${this.config.buttonSpacing}px;
    `;

    // 创建按钮
    const buttons = [
      { id: 'search', icon: '🔍', title: '搜索' },
      { id: 'measure', icon: '📏', title: '测量' },
      { id: 'view2d3d', icon: '2D', title: '2D或3D' },
      { id: 'layers', icon: '📚', title: '图层切换' },
      { id: 'location', icon: '🎯', title: '定位' },
      { id: 'zoom-in', icon: '🔍+', title: '放大' },
      { id: 'zoom-out', icon: '🔍-', title: '缩小' },
      { id: 'fullscreen', icon: '⛶', title: '全屏' }
    ];

    buttons.forEach(button => {
      const buttonElement = this.createButton(button);
      this.toolbarElement.appendChild(buttonElement);
    });

    this.container.appendChild(this.toolbarElement);
  }

  /**
   * 创建按钮
   */
  private createButton(config: ButtonConfig): HTMLElement {
    const button = document.createElement('div');
    button.className = 'cesium-toolbar-button';
    button.setAttribute('data-tool', config.id);
    button.title = config.title;
    
     button.style.cssText = `
       width: ${this.config.buttonSize}px;
       height: ${this.config.buttonSize}px;
       display: flex;
       align-items: center;
       justify-content: center;
       background: rgba(66, 133, 244, 0.4);
       color: white;
       border: none;
       border-radius: 4px;
       cursor: pointer;
       font-size: 14px;
       font-weight: bold;
       transition: all 0.2s ease;
       user-select: none;
       position: relative;
     `;

    button.innerHTML = config.icon;

    // 悬停效果
    button.addEventListener('mouseenter', () => {
      button.style.background = 'rgba(51, 103, 214, 0.9)';
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = 'rgba(66, 133, 244, 0.4)';
      button.style.transform = 'scale(1)';
    });

    // 点击事件
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleButtonClick(config.id, button);
    });

    return button;
  }

  /**
   * 处理按钮点击
   */
  private handleButtonClick(buttonId: string, buttonElement: HTMLElement): void {
    switch (buttonId) {
      case 'search':
        this.toggleSearch(buttonElement);
        break;
      case 'measure':
        this.toggleMeasurement(buttonElement);
        break;
      case 'view2d3d':
        this.toggle2D3D(buttonElement);
        break;
      case 'layers':
        this.toggleLayers(buttonElement);
        break;
      case 'location':
        this.resetLocation();
        break;
      case 'zoom-in':
        this.zoomIn();
        break;
      case 'zoom-out':
        this.zoomOut();
        break;
      case 'fullscreen':
        this.toggleFullscreen();
        break;
    }
  }

  /**
   * 切换搜索功能
   */
  private toggleSearch(buttonElement: HTMLElement): void {
    const existingSearch = this.toolbarElement.querySelector('.search-container');
    if (existingSearch) {
      existingSearch.remove();
      return;
    }

    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    searchContainer.style.cssText = `
      position: absolute;
      right: 100%;
      top: 0;
      margin-right: 8px;
      background: white;
      border: 1px solid #e0e0e0;
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
      border: 1px solid #ddd;
      border-radius: 3px;
      font-size: 14px;
      outline: none;
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

    // 搜索功能
    let searchTimeout: ReturnType<typeof setTimeout>;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      const query = searchInput.value.trim();
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
          // 默认搜索逻辑
          this.performDefaultSearch(query, resultsContainer);
        }
      }, 300);
    });

    // 点击外部关闭搜索框
    const closeSearch = (e: Event) => {
      if (!searchContainer.contains(e.target as Node)) {
        searchContainer.remove();
        document.removeEventListener('click', closeSearch);
      }
    };
    setTimeout(() => document.addEventListener('click', closeSearch), 100);
  }

  /**
   * 显示搜索结果
   */
  private displaySearchResults(results: SearchResult[], container: HTMLElement): void {
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
      });

      container.appendChild(resultItem);
    });
  }

  /**
   * 选择搜索结果
   */
  private selectSearchResult(result: SearchResult): void {
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
   * 默认搜索逻辑
   */
  private performDefaultSearch(query: string, container: HTMLElement): void {
    // 模拟搜索结果
    const mockResults: SearchResult[] = [
      {
        name: '人工智能产业园',
        address: '浙江省杭州市西湖区',
        longitude: 120.16,
        latitude: 30.28,
        height: 100
      },
      {
        name: '人工智能产业园',
        address: '浙江省杭州市西湖区',
        longitude: 120.16,
        latitude: 30.28,
        height: 100
      },
      {
        name: '人工智能产业园',
        address: '浙江省杭州市西湖区',
        longitude: 120.16,
        latitude: 30.28,
        height: 100
      }
    ];

    this.displaySearchResults(mockResults, container);
  }

  /**
   * 切换测量功能
   */
  private toggleMeasurement(buttonElement: HTMLElement): void {
    const existingMenu = this.toolbarElement.querySelector('.measurement-menu');
    if (existingMenu) {
      existingMenu.remove();
      return;
    }

    const menu = document.createElement('div');
    menu.className = 'measurement-menu';
    menu.style.cssText = `
      position: absolute;
      right: 100%;
      top: 0;
      margin-right: 8px;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      padding: 4px 0;
      min-width: 120px;
      z-index: 1001;
    `;

    const menuItems = [
      { id: 'measure-area', text: '测面积', icon: '📐' },
      { id: 'measure-distance', text: '测距', icon: '📏' },
      { id: 'clear-measurement', text: '清除', icon: '🗑️' }
    ];

    menuItems.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: background-color 0.2s;
      `;
      
      menuItem.innerHTML = `${item.icon} ${item.text}`;

      menuItem.addEventListener('mouseenter', () => {
        menuItem.style.backgroundColor = '#f5f5f5';
      });

      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.backgroundColor = 'transparent';
      });

      menuItem.addEventListener('click', () => {
        this.handleMeasurementAction(item.id);
        menu.remove();
      });

      menu.appendChild(menuItem);
    });

    this.toolbarElement.insertBefore(menu, buttonElement);

    // 点击外部关闭菜单
    const closeMenu = (e: Event) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 100);
  }

  /**
   * 处理测量操作
   */
  private handleMeasurementAction(action: string): void {
    switch (action) {
      case 'measure-area':
        this.drawHelper.startDrawingPolygon();
        break;
      case 'measure-distance':
        this.drawHelper.startDrawingLine();
        break;
      case 'clear-measurement':
        this.drawHelper.clearAll();
        if (this.measurementCallback?.onClear) {
          this.measurementCallback.onClear();
        }
        break;
    }
  }

  /**
   * 切换2D/3D视图
   */
  private toggle2D3D(buttonElement: HTMLElement): void {
    const currentMode = this.viewer.scene.mode;
    const targetMode = currentMode === Cesium.SceneMode.SCENE3D 
      ? Cesium.SceneMode.SCENE2D 
      : Cesium.SceneMode.SCENE3D;
    
    this.viewer.scene.mode = targetMode;
    
    // 更新按钮文本
    buttonElement.innerHTML = targetMode === Cesium.SceneMode.SCENE3D ? '3D' : '2D';
  }

  /**
   * 切换图层
   */
  private toggleLayers(buttonElement: HTMLElement): void {
    const existingMenu = this.toolbarElement.querySelector('.layers-menu');
    if (existingMenu) {
      existingMenu.remove();
      return;
    }

    const menu = document.createElement('div');
    menu.className = 'layers-menu';
    menu.style.cssText = `
      position: absolute;
      right: 100%;
      top: 0;
      margin-right: 8px;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      padding: 8px;
      min-width: 200px;
      z-index: 1001;
    `;

    // 地图类型选择
    const mapTypeSection = document.createElement('div');
    mapTypeSection.innerHTML = '<div style="font-weight: bold; margin-bottom: 8px;">地图类型</div>';
    
    this.mapTypes.forEach(mapType => {
      const mapTypeItem = document.createElement('div');
      mapTypeItem.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px;
        cursor: pointer;
        border-radius: 3px;
        transition: background-color 0.2s;
        ${mapType.id === this.currentMapType ? 'background-color: #e3f2fd;' : ''}
      `;

      const thumbnail = document.createElement('img');
      thumbnail.src = mapType.thumbnail;
      thumbnail.style.cssText = 'width: 20px; height: 20px; border-radius: 2px;';

      const label = document.createElement('span');
      label.textContent = mapType.name;
      label.style.fontSize = '14px';

      const checkmark = document.createElement('span');
      if (mapType.id === this.currentMapType) {
        checkmark.textContent = '✓';
        checkmark.style.cssText = 'color: #1976d2; font-weight: bold; margin-left: auto;';
      }

      mapTypeItem.appendChild(thumbnail);
      mapTypeItem.appendChild(label);
      mapTypeItem.appendChild(checkmark);

      mapTypeItem.addEventListener('mouseenter', () => {
        if (mapType.id !== this.currentMapType) {
          mapTypeItem.style.backgroundColor = '#f5f5f5';
        }
      });

      mapTypeItem.addEventListener('mouseleave', () => {
        if (mapType.id !== this.currentMapType) {
          mapTypeItem.style.backgroundColor = 'transparent';
        }
      });

      mapTypeItem.addEventListener('click', () => {
        this.switchMapType(mapType.id);
        menu.remove();
      });

      mapTypeSection.appendChild(mapTypeItem);
    });

    menu.appendChild(mapTypeSection);

    this.toolbarElement.insertBefore(menu, buttonElement);

    // 点击外部关闭菜单
    const closeMenu = (e: Event) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 100);
  }

  /**
   * 切换地图类型
   */
  private switchMapType(mapTypeId: string): void {
    const mapType = this.mapTypes.find(mt => mt.id === mapTypeId);
    if (!mapType) return;

    // 移除当前图层
    this.viewer.imageryLayers.removeAll();
    
    // 添加新图层
    this.viewer.imageryLayers.addImageryProvider(mapType.provider);
    
    this.currentMapType = mapTypeId;
  }

  /**
   * 复位到初始位置
   */
  private resetLocation(): void {
    if (!this.initialCenter) {
      console.warn('未设置初始中心点，无法执行复位操作');
      return;
    }

    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        this.initialCenter.longitude,
        this.initialCenter.latitude,
        this.initialCenter.height
      ),
      duration: 1.0
    });
  }

  /**
   * 放大
   */
  private zoomIn(): void {
    const beforeLevel = this.viewer.camera.positionCartographic.height;
    this.viewer.camera.zoomIn(this.viewer.camera.positionCartographic.height * 0.5);
    const afterLevel = this.viewer.camera.positionCartographic.height;
    
    if (this.zoomCallback?.onZoomIn) {
      this.zoomCallback.onZoomIn(beforeLevel, afterLevel);
    }
  }

  /**
   * 缩小
   */
  private zoomOut(): void {
    const beforeLevel = this.viewer.camera.positionCartographic.height;
    this.viewer.camera.zoomOut(this.viewer.camera.positionCartographic.height * 0.5);
    const afterLevel = this.viewer.camera.positionCartographic.height;
    
    if (this.zoomCallback?.onZoomOut) {
      this.zoomCallback.onZoomOut(beforeLevel, afterLevel);
    }
  }

  /**
   * 切换全屏
   */
  private toggleFullscreen(): void {
    if (!this.isFullscreen) {
      this.enterFullscreen();
    } else {
      this.exitFullscreen();
    }
  }

  /**
   * 进入全屏
   */
  private enterFullscreen(): void {
    const container = this.viewer.container;
    
    if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if ((container as any).webkitRequestFullscreen) {
      (container as any).webkitRequestFullscreen();
    } else if ((container as any).msRequestFullscreen) {
      (container as any).msRequestFullscreen();
    }

    this.isFullscreen = true;
    
    // 监听全屏状态变化
    const fullscreenChange = () => {
      if (!document.fullscreenElement && 
          !(document as any).webkitFullscreenElement && 
          !(document as any).msFullscreenElement) {
        this.isFullscreen = false;
        document.removeEventListener('fullscreenchange', fullscreenChange);
        document.removeEventListener('webkitfullscreenchange', fullscreenChange);
        document.removeEventListener('msfullscreenchange', fullscreenChange);
      }
    };

    document.addEventListener('fullscreenchange', fullscreenChange);
    document.addEventListener('webkitfullscreenchange', fullscreenChange);
    document.addEventListener('msfullscreenchange', fullscreenChange);
  }

  /**
   * 退出全屏
   */
  private exitFullscreen(): void {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
    }

    this.isFullscreen = false;
  }

  /**
   * 销毁工具栏
   */
  destroy(): void {
    if (this.toolbarElement && this.toolbarElement.parentNode) {
      this.toolbarElement.parentNode.removeChild(this.toolbarElement);
    }
    this.drawHelper.destroy();
  }
}
