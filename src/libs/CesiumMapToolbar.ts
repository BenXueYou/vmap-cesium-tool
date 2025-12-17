import * as Cesium from 'cesium';
import type { Viewer, Cartesian3 } from 'cesium';
import DrawHelper from './CesiumMapHelper';
import { CesiumMapController } from './CesiumMapController';
import { MeasurementService } from './MeasurementService';
import type {
  ButtonConfig, MapType, SearchResult, ToolbarConfig,
  SearchCallback, MeasurementCallback, ZoomCallback, CustomButtonConfig
} from './CesiumMapModel';

import { TDTMapTypes } from './CesiumMapConfig'
import { TD_Map_Search_URL, China_Map_Extent } from '../hooks/useMap';
import { loadAllAirportNoFlyZones, type AirportNoFlyZone } from '../utils/geojson';


/**
 * Cesium地图工具栏类
 * 提供搜索、测量、2D/3D切换、图层切换、定位、缩放、全屏等功能
 */
export class CesiumMapToolbar {
  private viewer: Viewer; // Cesium地图查看器实例
  private drawHelper: DrawHelper; // 绘图助手实例
  private container: HTMLElement; // 容器元素
  private toolbarElement!: HTMLElement; // 工具栏元素
  private config: ToolbarConfig; // 工具栏配置
  private searchCallback?: SearchCallback; // 搜索回调函数
  private measurementCallback?: MeasurementCallback; // 测量回调函数
  private zoomCallback?: ZoomCallback; // 缩放回调函数
  private initialCenter?: { longitude: number; latitude: number; height: number }; // 初始中心点
  private isFullscreen: boolean = false; // 是否全屏
  private currentMapType: string = 'imagery'; // 当前地图类型
  public TD_Token: string = 'your_tianditu_token_here'; // 请替换为您的天地图密钥

  // 地图类型配置
  public mapTypes: MapType[] = TDTMapTypes;

  // 禁飞区相关
  private noFlyZoneEntities: Cesium.Entity[] = [];
  private isNoFlyZoneVisible: boolean = false;
  // 防止并发重复加载禁飞区
  private isNoFlyZoneLoading: boolean = false;
  private isNoFlyZoneChecked: boolean = true;
  private readonly noFlyZoneExtrudedHeight = 1000;

  // 三维地名服务实例
  private currentGeoWTFS: any = null;

  // 当前测量模式：none（未测量）、distance（测距）、area（测面）
  private measurementService!: MeasurementService;

  // 对外暴露的测量相关 API
  public readonly measurement = {
    getMeasureMode: (): 'none' | 'distance' | 'area' => this.measurementService?.getMeasureMode() ?? 'none',
  };

  // 地图控制器：负责相机缩放、层级计算、2D/3D 切换和复位逻辑
  private mapController: CesiumMapController;

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

    // 初始化测量服务并注册与 DrawHelper 的回调
    this.measurementService = new MeasurementService(this.viewer, this.drawHelper, this.measurementCallback);
    this.setupDrawHelperCallbacks();

    // 初始化地图控制器
    this.mapController = new CesiumMapController(this.viewer, {
      initialCenter: this.initialCenter,
      getMapTypes: () => this.mapTypes,
      getCurrentMapTypeId: () => this.currentMapType,
      getToken: () => this.TD_Token,
      zoomCallback: this.zoomCallback,
      onSceneModeChanged: () => {
        const anyHelper = this.drawHelper as any;
        if (anyHelper && typeof anyHelper.handleSceneModeChanged === 'function') {
          anyHelper.handleSceneModeChanged();
        }
      },
    });

    // 创建工具栏
    this.createToolbar();

    // 自动加载禁飞区（如果默认勾选）
    this.autoLoadNoFlyZones();

    // 监听相机缩放，限制层级范围
    this.mapController.setupCameraZoomLimitListener();
  }

  public setMapTypes(mapTypes: MapType[]): void {
    this.mapTypes = mapTypes;
  }

  public setTDToken(TD_Token: string): void {
    this.TD_Token = TD_Token;
  }

  /**
   * 设置初始中心点
   */
  public setInitialCenter(center: { longitude: number; latitude: number; height: number }): void {
    this.initialCenter = center;
    // 同步到地图控制器
    this.mapController.setInitialCenter(center);
  }

  /**
   * 获取初始中心点
   */
  public getInitialCenter(): { longitude: number; latitude: number; height: number } | undefined {
    return this.mapController.getInitialCenter();
  }

  /**
   * 复位到初始位置（公共方法）
   */
  public resetToInitialLocation(): void {
    this.resetLocation();
  }

  /**
   * 更新按钮配置
   */
  public updateButtonConfig(buttonId: string, config: Partial<CustomButtonConfig>): void {
    const button = this.toolbarElement.querySelector(`[data-tool="${buttonId}"]`) as HTMLElement;
    if (!button) return;

    // 更新按钮属性
    if (config.title) button.title = config.title;
    if (config.icon) this.setButtonIcon(button, config.icon);
    if (config.size) {
      button.style.width = `${config.size}px`;
      button.style.height = `${config.size}px`;
    }
    if (config.color) button.style.color = config.color;
    if (config.backgroundColor) button.style.background = config.backgroundColor;
    if (config.borderColor) button.style.borderColor = config.borderColor;
    if (config.borderWidth) button.style.borderWidth = config.borderWidth + 'px';
    if (config.borderStyle) button.style.borderStyle = config.borderStyle;
    if (config.padding) button.style.padding = config.padding;
    if (config.activeIcon) this.setButtonIcon(button, config.activeIcon);
  }

  /**
   * 添加自定义按钮
   */
  public addCustomButton(config: CustomButtonConfig): void {
    const buttonConfig: ButtonConfig = {
      id: config.id,
      icon: typeof config.icon === 'string' ? config.icon : '',
      title: config.title,
      size: config.size,
      color: config.color,
      hoverColor: config.hoverColor,
      activeColor: config.activeColor,
      backgroundColor: config.backgroundColor,
      callback: config?.callback || (() => { })
    };
    const buttonElement = this.createButton(buttonConfig);
    this.toolbarElement.appendChild(buttonElement);

    // 更新配置
    if (!this.config.buttons) {
      this.config.buttons = [];
    }
    this.config.buttons.push(config);
  }

  /**
   * 移除按钮
   */
  public removeButton(buttonId: string): void {
    const button = this.toolbarElement.querySelector(`[data-tool="${buttonId}"]`) as HTMLElement;
    if (button && button.parentNode) {
      button.parentNode.removeChild(button);
    }

    // 从配置中移除
    if (this.config.buttons) {
      this.config.buttons = this.config.buttons.filter(btn => btn.id !== buttonId);
    }
  }

  /**
   * 获取按钮元素
   */
  private setupDrawHelperCallbacks(): void {
    this.drawHelper.onDrawStart(() => {
      console.log('开始绘制');
      if (this.measurementCallback?.onMeasurementStart) {
        this.measurementCallback?.onMeasurementStart()
      }
    });

    this.drawHelper.onDrawEnd((entity) => {
      if (entity) {
        console.log('绘制完成', entity);
        // 根据绘制类型触发相应回调
        if (entity.polyline) {
          // 测距完成
          const positions = entity.polyline.positions?.getValue(Cesium.JulianDate.now()) as Cartesian3[];
          if (positions) {
            let totalDistance = 0;
            for (let i = 1; i < positions.length; i++) {
              totalDistance += Cesium.Cartesian3.distance(positions[i - 1], positions[i]);
            }
            // 触发回调，传递原始距离值（米）
            if (this.measurementCallback?.onDistanceComplete) {
              this.measurementCallback.onDistanceComplete(positions, totalDistance);
            } else {
              // 如果没有提供回调，显示默认的格式化信息
              const formattedDistance = this.formatDistance(totalDistance);
              console.log(`测距完成，总距离: ${formattedDistance}`);
            }
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

      // 无论线还是面，绘制完成后都认为退出测量交互
      this.currentMeasureMode = 'none';
    });

    this.drawHelper.onEntityRemoved((entity) => {
      console.log('实体被移除', entity);
    });
  }

  /**
   * 格式化距离显示
   * 超过1000m时转换为km，保留两位小数
   * @param distance 距离（米）
   * @returns 格式化后的距离字符串
   */
  private formatDistance(distance: number): string {
    if (distance >= 1000) {
      const km = distance / 1000;
      return `${km.toFixed(2)} km`;
    } else {
      return `${distance.toFixed(2)} m`;
    }
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

    // 获取按钮配置
    const buttons = this.getButtonConfigs();

    buttons.forEach(button => {
      const buttonElement = this.createButton(button);
      this.toolbarElement.appendChild(buttonElement);
    });

    this.container.appendChild(this.toolbarElement);
  }

  /**
   * 获取按钮配置
   */
  private getButtonConfigs(): ButtonConfig[] {
    // 默认按钮配置
    const defaultButtons: ButtonConfig[] = [
      { id: 'search', icon: '🔍', title: '搜索' },
      { id: 'measure', icon: '📏', title: '测量' },
      { id: 'view2d3d', icon: '3D', title: '2D或3D' },
      { id: 'layers', icon: '📚', title: '图层切换' },
      { id: 'location', icon: '🎯', title: '定位' },
      { id: 'zoom-in', icon: '🔍-', title: '缩小' },
      { id: 'zoom-out', icon: '🔍+', title: '放大' },
      { id: 'fullscreen', icon: '⛶', title: '全屏' }
    ];

    const getDefaultButtonIds = (id: string) => defaultButtons.find(button => button.id === id);

    // 如果用户提供了自定义按钮配置，则使用自定义配置
    if (this.config.buttons && this.config.buttons.length > 0) {
      return this.config.buttons.map(customButton => {
        const defaultButton = getDefaultButtonIds(customButton.id);
        return {
          id: customButton.id || defaultButton?.id || '',
          icon: typeof customButton.icon === 'string' ? customButton.icon : (defaultButton?.icon || ''),
          title: customButton.title || defaultButton?.title || '',
          size: typeof customButton.size === 'number'
            ? customButton.size
            : (typeof defaultButton?.size === 'number' ? defaultButton.size : undefined),
          backgroundColor: customButton.backgroundColor || defaultButton?.backgroundColor || '',
          borderColor: customButton.borderColor || defaultButton?.borderColor || '',
          borderWidth: customButton.borderWidth || defaultButton?.borderWidth || 1,
          borderStyle: customButton.borderStyle || defaultButton?.borderStyle || 'solid',
          callback: customButton.callback || defaultButton?.callback || (() => { }),
          color: customButton.color || defaultButton?.color || 'rgba(66, 133, 244, 0.4)',
        };
      });
    }
    return defaultButtons;
  }

  /**
   * 创建按钮
   */
  private createButton(config: ButtonConfig): HTMLElement {
    const button = document.createElement('div');
    button.className = 'cesium-toolbar-button';
    button.setAttribute('data-tool', config.id);
    button.title = config.title;

    const buttonSize = config.size || this.config.buttonSize;
    const buttonColor = config.color || 'rgba(66, 133, 244, 0.4)';
    const backgroundColor = config.backgroundColor || 'rgba(66, 133, 244, 0.4)';
    const borderColor = config.borderColor || 'rgba(66, 133, 244, 0.4)';
    const borderWidth = config.borderWidth || 1;
    const borderStyle = config.borderStyle || 'solid';

    button.style.cssText = `
      width: ${buttonSize}px;
      height: ${buttonSize}px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${backgroundColor};
      color: ${buttonColor};
      border-width: ${borderWidth}px;
      border-style: ${borderStyle};
      border-color: ${borderColor};
      cursor: pointer;
      font-weight: bold;
      transition: all 0.2s ease;
      user-select: none;
      position: relative;
    `;

    // 设置图标内容
    this.setButtonIcon(button, config.icon);

    // 悬停效果
    button.addEventListener('mouseenter', () => {
      // button.style.background = buttonHoverColor;
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseleave', () => {
      // button.style.background = buttonColor;
      button.style.transform = 'scale(1)';
    });

    // 处理点击事件
    this.setupButtonEvents(button, config);

    return button;
  }

  /**
   * 设置按钮图标
   */
  private setButtonIcon(button: HTMLElement, icon: string | HTMLElement): void {
    if (icon instanceof HTMLElement) {
      // 处理HTMLElement类型的图标
      button.innerHTML = '';
      button.appendChild(icon);
    } else if (typeof icon === 'string') {
      if (this.isImagePath(icon)) {
        // 处理图片路径
        this.loadImageIcon(button, icon);
      } else {
        // 处理HTML字符串（如SVG、图标字体等）
        button.innerHTML = icon;
      }
    }
  }

  /**
   * 判断是否为图片路径
   */
  private isImagePath(icon: string): boolean {
    // 检查是否为图片文件扩展名
    const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg|ico)$/i;
    return imageExtensions.test(icon);
  }

  /**
   * 加载图片图标
   */
  private loadImageIcon(button: HTMLElement, imagePath: string): void {
    // 创建图片元素进行预加载和验证
    const img = new Image();

    const buttonRect = button.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(button);

    // 获取按钮的宽高，优先使用计算后的样式
    const buttonWidth = buttonRect.width || parseInt(computedStyle.width) || 36;
    const buttonHeight = buttonRect.height || parseInt(computedStyle.height) || 36;

    // 计算图标的内边距（按钮尺寸的20%作为内边距）
    const imgWidth = Math.min(buttonWidth, buttonHeight) * 0.6;
    const imgHeight = Math.min(buttonWidth, buttonHeight) * 0.6;
    img.width = imgWidth;
    img.height = imgHeight;
    // 设置加载成功回调
    img.onload = () => {
      // 获取按钮的实际尺寸（包括计算后的样式）
      button.appendChild(img);
    };

    // 设置加载失败回调
    img.onerror = () => {
      console.warn(`Failed to load icon: ${imagePath}`);
      // 加载失败时使用默认图标或显示文字
      this.setDefaultIcon(button, imagePath);
    };

    // 开始加载图片
    img.src = imagePath;
  }

  /**
   * 设置默认图标（当图片加载失败时）
   */
  private setDefaultIcon(button: HTMLElement, originalPath: string): void {
    // 可以根据原始路径生成一个简单的默认图标
    const fileName = originalPath.split('/').pop()?.split('.')[0] || 'icon';

    // 使用CSS创建一个简单的默认图标
    button.style.backgroundImage = 'none';
    button.style.backgroundColor = '#ccc';
    button.style.position = 'relative';

    // 添加一个简单的文字图标作为后备
    const fallbackIcon = document.createElement('div');
    fallbackIcon.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 12px;
      color: #666;
      font-weight: bold;
      text-align: center;
      line-height: 1;
    `;
    fallbackIcon.textContent = fileName.charAt(0).toUpperCase();

    button.innerHTML = '';
    button.appendChild(fallbackIcon);
  }

  /**
   * 设置按钮事件
   */
  private setupButtonEvents(button: HTMLElement, config: ButtonConfig): void {
    // 查找自定义按钮配置
    const customButton = this.config.buttons?.find(btn => btn.id === config.id);

    if (customButton?.onClick) {
      // 自定义按钮点击事件
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        customButton.onClick!(config.id, button);
      });
    } else if (!['search', 'measure', 'layers'].includes(config.id)) {
      // 默认按钮点击事件（除了搜索、测量、图层切换按钮）
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleButtonClick(config.id, button, config.callback);
      });
    } else {
      // 搜索、测量、图层切换按钮使用hover事件
      button.addEventListener('mouseenter', () => {
        this.handleButtonClick(config.id, button, config.callback);
      });

      // 添加鼠标离开事件来关闭菜单
      button.addEventListener('mouseleave', () => {
        this.closeMenuOnButtonLeave(config.id);
      });
    }
  }

  /**
   * 按钮鼠标离开时关闭菜单
   */
  private closeMenuOnButtonLeave(buttonId: string): void {
    // 延迟关闭，给用户时间移动到菜单上
    setTimeout(() => {
      switch (buttonId) {
        case 'search':
          const searchContainer = this.toolbarElement.querySelector('.search-container');
          if (searchContainer) {
            // 检查是否在搜索框或输入框中
            const isHoveringSearch = searchContainer.matches(':hover');
            const searchInput = searchContainer.querySelector('input') as HTMLInputElement;
            const isInputFocused = searchInput && document.activeElement === searchInput;

            // 如果不在搜索框上且输入框未聚焦，则关闭
            if (!isHoveringSearch && !isInputFocused) {
              searchContainer.remove();
            }
          }
          break;
        case 'measure':
          const measureMenu = this.toolbarElement.querySelector('.measurement-menu');
          if (measureMenu && !measureMenu.matches(':hover')) {
            measureMenu.remove();
          }
          break;
        case 'layers':
          const layersMenu = this.toolbarElement.querySelector('.layers-menu');
          if (layersMenu && !layersMenu.matches(':hover')) {
            layersMenu.remove();
          }
          break;
      }
    }, 100); // 100ms延迟，给用户时间移动到菜单
  }

  /**
   * 关闭搜索框
   */
  private closeSearchContainer(): void {
    const searchContainer = this.toolbarElement.querySelector('.search-container');
    if (searchContainer) {
      searchContainer.remove();
    }
  }

  /**
   * 处理按钮点击
   */
  private handleButtonClick(buttonId: string, buttonElement: HTMLElement, callback?: () => void): void {
    // 如果触发的是非搜索按钮，先关闭搜索框
    if (buttonId !== 'search') {
      this.closeSearchContainer();
    }

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
        this.toggleLayers(buttonElement, callback);
        break;
      case 'location':
        this.resetLocation();
        break;
      case 'zoom-in':
        this.zoomOut();
        break;
      case 'zoom-out':
        this.zoomIn();
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
            const results = pois.map((location: any) => ({
              name: location?.name || query,
              address: location?.address || '',
              longitude: Number(location?.lonlat?.split(',')[0] || 0),
              latitude: Number(location?.lonlat?.split(',')[1] || 0),
              height: 100,
            }));
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
        searchContainer.remove();
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
          searchContainer.remove();
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
          searchContainer.remove();
          searchContainer.removeEventListener('mouseleave', handleSearchContainerLeave);
          searchContainer.removeEventListener('mouseenter', handleSearchContainerEnter);
          searchInput.removeEventListener('blur', handleInputBlur);
        }
      }, 200);
    };

    // 添加ESC键关闭搜索框的逻辑
    const closeSearchOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        searchContainer.remove();
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
   * 显示搜索结果
   */
  private displaySearchResults(results: SearchResult[], container: HTMLElement): void {
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
   * 切换测量功能
   */
  private toggleMeasurement(buttonElement: HTMLElement): void {
    const existingMenu = this.toolbarElement.querySelector('.measurement-menu');
    if (existingMenu) {
      return; // 如果菜单已存在，不重复创建
    }

    const menu = document.createElement('div');
    menu.className = 'measurement-menu';
    menu.style.cssText = `
      position: absolute;
      right: 100%;
      top: 0;
      margin-right: 8px;
      background: rgba(0, 40, 80, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.2);
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
        color: #fff;
        gap: 8px;
        transition: background-color 0.2s;
      `;

      menuItem.innerHTML = `${item.icon} ${item.text}`;

      menuItem.addEventListener('mouseenter', () => {
        menuItem.style.backgroundColor = '#023C61';
        menuItem.style.transform = 'scale(1.02)';
      });

      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.backgroundColor = 'transparent';
        menuItem.style.transform = 'scale(1.00)';
      });

      menuItem.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        e.preventDefault(); // 阻止默认行为
        this.handleMeasurementAction(item.id);
        menu.remove();
      });

      menu.appendChild(menuItem);
    });

    this.toolbarElement.insertBefore(menu, buttonElement);

    // 鼠标离开菜单区域时关闭
    const closeMenu = () => {
      menu.remove();
    };

    // 监听菜单的鼠标离开事件
    menu.addEventListener('mouseleave', closeMenu);
  }

  /**
   * 处理测量操作
   */
  private handleMeasurementAction(action: string): void {
    switch (action) {
      case 'measure-area':
        this.measurementService.startAreaMeasurement();
        break;
      case 'measure-distance':
        this.measurementService.startDistanceMeasurement();
        break;
      case 'clear-measurement':
        this.measurementService.clearMeasurements();
        break;
    }
  }

  /**
   * 切换2D/3D视图
   */
  private toggle2D3D(buttonElement: HTMLElement): void {
    this.mapController.toggle2D3D(buttonElement);
  }

  /**
   * 切换图层
   */
  private toggleLayers(buttonElement: HTMLElement, callback?: (param: any, toolbar?: CesiumMapToolbar) => void): void {
    const existingMenu = this.toolbarElement.querySelector('.layers-menu');
    if (existingMenu) {
      return; // 如果菜单已存在，不重复创建
    }

    const menu = document.createElement('div');
    menu.className = 'layers-menu';
    menu.style.cssText = `
      position: absolute;
      right: 100%;
      top: 0;
      margin-right: 8px;
      background: rgba(0, 40, 80, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      padding: 10px 12px;
      max-width: 520px;
      z-index: 1001;
      display: flex;
      flex-direction: column;
    `;

    // 第一部分：地图类型
    const mapTypeSection = document.createElement('div');
    mapTypeSection.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: transparent;
    `;

    // 地图类型标题栏
    const mapTypeHeader = document.createElement('div');
    mapTypeHeader.textContent = '地图类型';
    mapTypeHeader.style.cssText = `
      display: flex;
      width: 100%;
      justify-content: flex-start;
      align-items: center;
      text-align: left;
      font-weight: bold;
      font-size: 16px;
      color: #fff;
    `;
    // 地图类型网格容器
    const mapTypeGrid = document.createElement('div');
    mapTypeGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    `;

    this.mapTypes.forEach(mapType => {
      const mapTypeItem = document.createElement('div');
      mapTypeItem.style.cssText = `
        width: 100px;
        position: relative;
        cursor: pointer;
        border-radius: 4px;
        overflow: hidden;
        transition: transform 0.2s, box-shadow 0.2s, background-color 0.2s, border-color 0.2s;
        background-color: transparent;
        ${mapType.id === this.currentMapType ? 'box-shadow: 0 2px 8px rgba(25, 118, 210, 0.5); border: 2px solid #1976d2;' : 'border: 2px solid transparent;'}
      `;

      const thumbnail = document.createElement('img');
      thumbnail.src = mapType.thumbnail;
      thumbnail.style.cssText = `
        width: 100%;
        height: auto;
        display: block;
      `;

      const label = document.createElement('div');
      label.textContent = mapType.name;
      label.style.cssText = `
        font-size: 12px;
        color: #fff;
        padding: 4px 0;
        text-align: center;
        background: rgba(0, 0, 0, 0.3);
      `;

      // 勾选标记
      if (mapType.id === this.currentMapType) {
        const checkmark = document.createElement('div');
        checkmark.innerHTML = '✓';
        checkmark.style.cssText = `
          position: absolute;
          top: 4px;
          right: 4px;
          width: 20px;
          height: 20px;
          background: #1976d2;
          color: #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: bold;
          z-index: 10;
        `;
        mapTypeItem.appendChild(checkmark);
      }

      mapTypeItem.appendChild(thumbnail);
      mapTypeItem.appendChild(label);

      mapTypeItem.addEventListener('mouseenter', () => {
        mapTypeItem.style.transform = 'scale(1.05)';
        mapTypeItem.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
        mapTypeItem.style.borderColor = '#023C61';
        mapTypeItem.style.backgroundColor = '#023C61';
      });

      mapTypeItem.addEventListener('mouseleave', () => {
        mapTypeItem.style.transform = 'scale(1)';
        if (mapType.id !== this.currentMapType) {
          mapTypeItem.style.boxShadow = 'none';
          mapTypeItem.style.borderColor = 'transparent';
          mapTypeItem.style.backgroundColor = 'transparent';
        }
      });

      mapTypeItem.addEventListener('click', () => {
        this.switchMapType(mapType.id);
        menu.remove();
      });

      mapTypeGrid.appendChild(mapTypeItem);
    });


    mapTypeSection.appendChild(mapTypeHeader);
    mapTypeSection.appendChild(mapTypeGrid);

    // 第二部分：叠加图层
    const overlaySection = document.createElement('div');
    overlaySection.style.cssText = `
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      background: transparent;
      margin-top: 12px;
    `;

    const overlayTitle = document.createElement('div');
    overlayTitle.textContent = '叠加图层';
    overlayTitle.style.cssText = `
      font-weight: bold;
      font-size: 16px;
      color: #fff;
      margin-bottom: 4px;
    `;
    overlaySection.appendChild(overlayTitle);
    // 示例叠加图层选项
    const overlayOptions = [
      { id: 'airport', name: '机场禁飞区', icon: '🔴' }
      // 可以添加更多叠加图层选项
    ];

    overlayOptions.forEach(option => {
      const overlayItem = document.createElement('div');
      overlayItem.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
      `;

      const checkbox = document.createElement('div');
      // 机场禁飞区默认勾选
      const isDefaultChecked = this.isNoFlyZoneChecked;
      checkbox.style.cssText = `
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255, 255, 255, 0.5);
        border-radius: 3px;
        background: ${isDefaultChecked ? '#023C61' : 'transparent'};
        display: flex;
        align-items: center;
        justify-content: center;
      `;

      // 如果是默认勾选，设置勾选标记
      if (isDefaultChecked) {
        checkbox.innerHTML = '✓';
        checkbox.style.color = '#ffffff';
        checkbox.style.fontWeight = 'bold';
        checkbox.style.fontSize = '12px';
      }

      const icon = document.createElement('span');
      icon.textContent = option.icon;
      icon.style.cssText = `
        font-size: 12px;
        display: flex;
        align-items: center;
      `;

      const name = document.createElement('span');
      name.textContent = option.name;
      name.style.cssText = `
        font-size: 14px;
        color: #fff;
      `;

      overlayItem.appendChild(checkbox);
      overlayItem.appendChild(icon);
      overlayItem.appendChild(name);

      overlayItem.addEventListener('mouseenter', () => {
        overlayItem.style.backgroundColor = '#023C61';
      });

      overlayItem.addEventListener('mouseleave', () => {
        overlayItem.style.backgroundColor = 'transparent';
      });

      overlayItem.addEventListener('click', () => {
        // 切换复选框状态（可以根据需要实现具体的图层逻辑）
        // const isChecked = checkbox.style.background === '#023C61' || checkbox.style.background === 'rgb(2, 60, 97)';
        const isChecked = this.isNoFlyZoneChecked;
        if (isChecked) {
          checkbox.style.background = 'transparent';
          checkbox.innerHTML = '';
        } else {
          checkbox.style.background = '#023C61';
          checkbox.innerHTML = '✓';
          checkbox.style.color = '#ffffff';
          checkbox.style.fontWeight = 'bold';
          checkbox.style.fontSize = '12px';
        }
        // 传递新的状态（取反，因为点击后状态会改变）和 toolbar 实例
        this.isNoFlyZoneChecked = !this.isNoFlyZoneChecked;
        callback?.(!isChecked, this);
      });

      overlaySection.appendChild(overlayItem);
    });

    // 组装菜单
    menu.appendChild(mapTypeSection);
    menu.appendChild(overlaySection);

    this.toolbarElement.insertBefore(menu, buttonElement);

    // 注意：禁飞区已经在创建 toolbar 后自动加载，这里不需要重复加载
    // 如果禁飞区尚未加载，说明自动加载可能失败了，可以在这里尝试加载
    if (!this.isNoFlyZoneVisible && this.isNoFlyZoneChecked) {
      // 延迟加载，避免阻塞菜单显示
      setTimeout(() => {
        this.showNoFlyZones().catch((error) => {
          console.error('加载禁飞区失败:', error);
        });
      }, 100);
    }

    // 鼠标离开菜单区域时关闭
    const closeMenu = () => {
      menu.remove();
    };

    // 监听菜单的鼠标离开事件
    menu.addEventListener('mouseleave', closeMenu);
  }

  /**
   * 切换地图类型
   */
  private switchMapType(mapTypeId: string): void {
    const mapType = this.mapTypes.find(mt => mt.id === mapTypeId);
    if (!mapType) return;

    // 保存当前相机状态
    const currentCameraState = {
      position: this.viewer.camera.position.clone(),
      heading: this.viewer.camera.heading,
      pitch: this.viewer.camera.pitch,
      roll: this.viewer.camera.roll,
      height: this.viewer.camera.positionCartographic.height
    };

    // 清理之前的三维地名服务实例
    if (this.currentGeoWTFS) {
      try {
        // 如果 GeoWTFS 有销毁方法，调用它
        if (typeof this.currentGeoWTFS.destroy === 'function') {
          this.currentGeoWTFS.destroy();
        } else if (typeof this.currentGeoWTFS.remove === 'function') {
          this.currentGeoWTFS.remove();
        }
      } catch (error) {
        console.warn('清理三维地名服务失败:', error);
      }
      this.currentGeoWTFS = null;
    }

    // 移除当前图层
    this.viewer.imageryLayers.removeAll();

    // 添加新图层
    const layers = mapType.provider(this.TD_Token);
    // 添加天地图
    layers.forEach((layer) => {
      this.viewer.imageryLayers.addImageryProvider(layer);
    });
    this.currentMapType = mapTypeId;
  }

  /**
   * 复位到初始位置
   */
  private resetLocation(): void {
    this.mapController.resetLocation();
  }

  /**
   * 获取当前地图层级
   * @returns 当前层级（1-18）
   */
  private getCurrentZoomLevel(): number {
    return this.mapController.getCurrentZoomLevel();
  }

  /**
   * 设置地图层级
   * @param zoomLevel 目标层级（1-18）
   */
  private setZoomLevel(zoomLevel: number): void {
    this.mapController.setZoomLevel(zoomLevel);
  }
  /**
   * 放大
   */
  private zoomIn(): void {
    this.mapController.zoomIn();
  }

  /**
   * 缩小
   */
  private zoomOut(): void {
    this.mapController.zoomOut();
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
   * 加载并显示机场禁飞区
   */
  public async showNoFlyZones(): Promise<void> {
    if (this.isNoFlyZoneVisible || this.isNoFlyZoneLoading) {
      return; // 已经显示或正在加载，避免重复
    }

    this.isNoFlyZoneLoading = true;

    try {
      // 加载所有机场禁飞区数据
      const noFlyZones = await loadAllAirportNoFlyZones();

      // 清除之前的实体（如果有）
      this.hideNoFlyZones();

      // 为每个禁飞区创建实体
      noFlyZones.forEach((zone) => {
        const coordinates = zone.feature.geometry.coordinates[0]; // 获取外环坐标

        // 将 GeoJSON 坐标转换为 Cesium Cartesian3 数组
        const positions = coordinates.map((coord: number[]) => {
          const [longitude, latitude] = coord;
          return Cesium.Cartesian3.fromDegrees(longitude, latitude, 0);
        });

        // 创建多边形实体
        const polygonOptions = this.createNoFlyZonePolygonOptions(positions);
        const entity = this.viewer.entities.add({
          name: zone.name,
          polygon: polygonOptions,
          description: `机场禁飞区: ${zone.name}`,
        });
        (entity as any).disableDepthTestDistance = Number.POSITIVE_INFINITY;

        this.noFlyZoneEntities.push(entity);

        // 如果存在 extrudedHeight（3D 模式），单独添加顶面边界的 polyline，
        // 这样可以只显示顶面的轮廓，避免 polygon 在 top/bottom 同时绘制 outline 导致“重叠”外观。
        try {
          const is3DMode = this.viewer.scene.mode === Cesium.SceneMode.SCENE3D;
          const extrudedRaw = polygonOptions.extrudedHeight;
          const heightRaw = polygonOptions.height;

          const extrudedHeightValue = typeof extrudedRaw === 'number'
            ? extrudedRaw
            : (extrudedRaw as Cesium.Property | undefined)?.getValue(Cesium.JulianDate.now());

          const baseHeightValue = typeof heightRaw === 'number'
            ? heightRaw
            : (heightRaw as Cesium.Property | undefined)?.getValue(Cesium.JulianDate.now());

          const topHeight = (extrudedHeightValue ?? baseHeightValue) ?? 0;

          if (is3DMode && topHeight > 0) {
            const topPositions = positions.map((p) => {
              const carto = Cesium.Cartographic.fromCartesian(p);
              return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, topHeight);
            });

            const outlineEntity = this.viewer.entities.add({
              name: `${zone.name}_top_outline`,
              polyline: {
                positions: topPositions,
                width: 2,
                material: Cesium.Color.RED,
                clampToGround: false,
              }
            });
            (outlineEntity as any).disableDepthTestDistance = Number.POSITIVE_INFINITY;
            this.noFlyZoneEntities.push(outlineEntity);
          }
        } catch (e) {
          // 忽略边界绘制失败，不影响主多边形显示
        }
      });

      this.isNoFlyZoneVisible = true;
      console.log(`已加载 ${noFlyZones.length} 个机场禁飞区`);
    } catch (error) {
      console.error('加载机场禁飞区失败:', error);
    }
    finally {
      this.isNoFlyZoneLoading = false;
    }
  }

  /**
   * 隐藏机场禁飞区
   */
  public hideNoFlyZones(): void {
    // 移除所有禁飞区实体
    this.noFlyZoneEntities.forEach((entity) => {
      this.viewer.entities.remove(entity);
    });
    this.noFlyZoneEntities = [];
    this.isNoFlyZoneVisible = false;
  }

  /**
   * 根据当前场景模式配置禁飞区多边形
   */
  /**
   * 创建禁飞区多边形配置选项
   * @param positions - 多边形的顶点坐标数组，使用笛卡尔坐标系
   * @returns 返回一个包含多边形图形配置选项的对象
   */
  private createNoFlyZonePolygonOptions(
    positions: Cartesian3[]  // 笛卡尔3D坐标数组，用于定义多边形的顶点
  ): Cesium.PolygonGraphics.ConstructorOptions {  // 返回类型为Cesium多边形图形的构造选项
    const is3DMode = this.viewer.scene.mode === Cesium.SceneMode.SCENE3D;  // 判断当前场景是否为3D模式

    const hoverHeight = is3DMode ? 2 : 0; // 可根据需要调大到 5-10m 来避免近裁剪

    // 在3D模式下设置悬停高度为2米，2D模式下为0
    // 将传入 positions 标准化为海拔 0（避免 positions 中意外的高度影响渲染）
    const normalizedPositions = positions.map((p) => {  // 遍历所有坐标点进行标准化处理
      try {
        const carto = Cesium.Cartographic.fromCartesian(p);  // 将笛卡尔坐标转换为地理坐标
        return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0);  // 转换回笛卡尔坐标，并设置高度为0
      } catch (e) {
        return p; // 若转换失败则回退使用原点
      }
    });
    // 确保场景不会因地形深度测试而遮挡实体（只需设置一次，安全操作）
    try {
      if (this.viewer && this.viewer.scene && this.viewer.scene.globe) {  // 检查viewer及其相关组件是否存在
        this.viewer.scene.globe.depthTestAgainstTerrain = false;  // 禁用地形深度测试，防止地形遮挡实体
      }
    } catch (e) {
      // 忽略无法设置的情况
    }

    return {
      hierarchy: new Cesium.PolygonHierarchy(normalizedPositions),  // 设置多边形的层级结构，使用标准化后的坐标
      material: Cesium.Color.RED.withAlpha(0.3),  // 设置多边形填充材质为半透明红色
      // 在 3D 模式下，我们不依赖 polygon 自带的 outline（会在 top/bottom 同时渲染），
      // 代码中会单独绘制顶面轮廓 polyline，避免重复/重叠视觉效果。
      outline: is3DMode ? false : true,
      outlineColor: Cesium.Color.RED,  // 设置轮廓颜色为红色
      outlineWidth: 2,  // 设置轮廓宽度为2像素
      perPositionHeight: false,  // 不使用每个点的高度
      heightReference: Cesium.HeightReference.NONE,  // 不参考地形高度
      height: hoverHeight,  // 设置多边形底部高度
      extrudedHeight: is3DMode ? this.noFlyZoneExtrudedHeight : undefined,  // 3D模式下设置拉伸高度
      classificationType: Cesium.ClassificationType.BOTH,  // 设置分类类型，同时在地形和3D模型上显示
    };
  }

  /**
   * 切换机场禁飞区显示状态
   */
  public toggleNoFlyZones(): Promise<void> {
    if (this.isNoFlyZoneVisible) {
      this.hideNoFlyZones();
      return Promise.resolve();
    } else {
      return this.showNoFlyZones();
    }
  }

  /**
   * 获取禁飞区显示状态
   */
  public getNoFlyZoneVisible(): boolean {
    return this.isNoFlyZoneVisible;
  }

  /**
   * 自动加载禁飞区（如果默认勾选）
   * 在创建 toolbar 后自动调用
   */
  private async autoLoadNoFlyZones(): Promise<void> {
    // 检查机场禁飞区是否默认勾选
    // 在 toggleLayers 方法中，airport 选项默认是勾选的
    const isDefaultChecked = this.isNoFlyZoneChecked; // 机场禁飞区默认勾选
    if (isDefaultChecked && !this.isNoFlyZoneVisible) {
      // 延迟加载，避免阻塞工具栏创建
      setTimeout(() => {
        this.showNoFlyZones().catch((error) => {
          console.error('自动加载禁飞区失败:', error);
        });
      }, 500); // 延迟 500ms，确保工具栏完全创建完成
    }
  }

  /**
   * 销毁工具栏
   */
  destroy(): void {
    // 清理禁飞区实体
    this.hideNoFlyZones();

    // 清理三维地名服务实例
    if (this.currentGeoWTFS) {
      try {
        if (typeof this.currentGeoWTFS.destroy === 'function') {
          this.currentGeoWTFS.destroy();
        } else if (typeof this.currentGeoWTFS.remove === 'function') {
          this.currentGeoWTFS.remove();
        }
      } catch (error) {
        console.warn('销毁三维地名服务失败:', error);
      }
      this.currentGeoWTFS = null;
    }

    if (this.toolbarElement && this.toolbarElement.parentNode) {
      this.toolbarElement.parentNode.removeChild(this.toolbarElement);
    }
    this.drawHelper.destroy();
  }
}
