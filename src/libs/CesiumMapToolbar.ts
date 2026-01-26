import * as Cesium from 'cesium';
import type { Viewer, Cartesian3 } from 'cesium';
import DrawHelper from './CesiumMapDraw';
import { CesiumMapController } from './toolBar/CesiumMapController';
import { MeasurementService } from './toolBar/MeasurementService';
import { SearchService } from './toolBar/MapSearchService';
import { MapLayersService } from './toolBar/MapLayersService';
import { NotFlyZonesService } from './toolBar/NotFlyZonesService';
import type {
  ButtonConfig, MapType, ToolbarConfig,
  SearchCallback, MeasurementCallback, ZoomCallback, CustomButtonConfig
} from './CesiumMapModel';

import { TDTMapTypes } from './config/CesiumMapConfig'
import { formatDistance, calculatePolygonArea } from '../utils/calc';

import { defaultButtons } from './toolBar/MapToolBarConfig'

type ResolvedButtonConfig = Omit<ButtonConfig, 'icon'> & { icon: string | HTMLElement };

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
  private searchService: SearchService; // 搜索服务实例
  private mapLayersService: MapLayersService; // 图层服务实例
  private notFlyZonesService!: NotFlyZonesService; // 禁飞区服务实例
  private measurementCallback?: MeasurementCallback; // 测量回调函数
  private zoomCallback?: ZoomCallback; // 缩放回调函数
  private fullscreenCallback?: (isFullscreen: boolean) => void; // 全屏状态回调函数
  private resetLocationCallback?: () => void; // 复位位置回调函数
  private initialCenter?: { longitude: number; latitude: number; height: number }; // 初始中心点
  private currentMapType: string = 'imagery'; // 当前地图类型
  public TD_Token: string = 'your_tianditu_token_here'; // 请替换为您的天地图密钥

  // 地图类型配置     
  public mapTypes: MapType[] = TDTMapTypes;

  // 禁飞区相关状态（用于图层服务配置）
  private isNoFlyZoneChecked: boolean = true;

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
      fullscreen?: (isFullscreen: boolean) => void; // 全屏回调
      resetLocation?: () => void; // 复位位置回调
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
    this.measurementCallback = callbacks?.measurement;
    this.zoomCallback = callbacks?.zoom;
    this.fullscreenCallback = callbacks?.fullscreen;
    this.resetLocationCallback = callbacks?.resetLocation;
    // 设置初始中心点
    this.initialCenter = initialCenter;

    // 初始化绘图助手
    this.drawHelper = new DrawHelper(viewer);

    // 创建工具栏（需要在创建 SearchService 之前）
    this.createToolbar();

    // 初始化搜索服务
    this.searchService = new SearchService(viewer, this.toolbarElement, callbacks?.search);

    // 初始化禁飞区服务
    this.notFlyZonesService = new NotFlyZonesService(viewer, {
      extrudedHeight: 1000,
      autoLoad: false // 由图层服务控制加载时机
    });

    // 初始化图层服务
    this.mapLayersService = new MapLayersService(viewer, this.toolbarElement, {
      mapTypes: this.mapTypes,
      currentMapType: this.currentMapType,
      token: this.TD_Token,
      isNoFlyZoneChecked: this.isNoFlyZoneChecked,
      isNoFlyZoneVisible: this.notFlyZonesService.getNoFlyZoneVisible(),
      onMapTypeChange: (mapTypeId: string) => {
        this.currentMapType = mapTypeId;
      },
      onNoFlyZoneToggle: (isChecked: boolean) => {
        this.isNoFlyZoneChecked = isChecked;
        // 切换禁飞区显示状态
        if (isChecked) {
          this.notFlyZonesService.showNoFlyZones();
        } else {
          this.notFlyZonesService.hideNoFlyZones();
        }
        // 触发回调
        const layersButton = this.config.buttons?.find(btn => btn.id === 'layers');
        if (layersButton?.callback) {
          // callback 可能是函数，需要检查类型
          if (typeof layersButton.callback === 'function') {
            (layersButton.callback as any)(isChecked, this);
          }
        }
      },
      onShowNoFlyZones: () => {
        return this.showNoFlyZones();
      }
    });

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
      fullscreenCallback: this.fullscreenCallback, // 全屏回调
      resetLocationCallback: this.resetLocationCallback // 复位位置回调
    });

    // 自动加载禁飞区（如果默认勾选）
    if (this.isNoFlyZoneChecked) {
      setTimeout(() => {
        this.notFlyZonesService.showNoFlyZones().catch((error) => {
          console.error('自动加载禁飞区失败:', error);
        });
      }, 500);
    }

    // 监听相机缩放，限制层级范围
    this.mapController.setupCameraZoomLimitListener();
  }

  /**
   * searchService 对外暴露的获取搜索服务方法
   */
  public getSearchService() {
    return this.searchService;
  }
  /**
   * notFlyZonesService 对外暴露的获取禁飞区服务方法
   */
  public getNotFlyZonesService() {
    return this.notFlyZonesService;
  }
  /**
   * measurementService 对外暴露的获取测量服务方法
   */
  public getMeasurementService() {
    return this.measurementService;
  }
  /**
   * cesmapController 对外暴露的获取地图控制器方法
   */
  public getCesiumMapCtrl() {
    return this.mapController;
  }

  /**
   * mapLayersService 对外暴露的获取图层服务方法
   */
  public getMapLayersService() {
    return this.mapLayersService;
  }

  /**
   * 设置地图类型配置
   * @param mapTypes 
   */
  public setMapTypes(mapTypes: MapType[]): void {
    this.mapTypes = mapTypes;
    // 同步更新图层服务配置
    this.mapLayersService.updateConfig({
      mapTypes: mapTypes
    });
  }


  /**
   * 设置天地图密钥
   * @param TD_Token 
   */
  public setTDToken(TD_Token: string): void {
    this.TD_Token = TD_Token;
    // 同步更新图层服务配置
    this.mapLayersService.updateConfig({
      token: TD_Token
    });
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
    this.mapController.resetLocation();
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
   * @param config 按钮配置，支持 sort 参数控制插入位置
   */
  public addCustomButton(config: CustomButtonConfig): void {
    // 更新配置
    if (!this.config.buttons) {
      this.config.buttons = [];
    }

    // 检查是否已存在相同 ID 的按钮
    const existingIndex = this.config.buttons.findIndex(btn => btn.id === config.id);
    if (existingIndex !== -1) {
      // 如果已存在，更新配置
      this.config.buttons[existingIndex] = config;
      // 移除旧的按钮元素
      const oldButton = this.toolbarElement.querySelector(`[data-tool="${config.id}"]`);
      if (oldButton && oldButton.parentNode) {
        oldButton.parentNode.removeChild(oldButton);
      }
    } else {
      // 如果不存在，添加到配置中
      this.config.buttons.push(config);
    }

    // 重新构建工具栏按钮
    this.rebuildToolbarButtons(this.getButtonConfigs());
  }

  /**
   * 获取所有按钮配置（包括默认按钮和自定义按钮），并添加 sort 值
   */
  private resolveIcon(customIcon: CustomButtonConfig['icon'], fallbackIcon: string): string | HTMLElement {
    if (customIcon === false) return fallbackIcon;
    if (customIcon instanceof HTMLElement) return customIcon;
    if (typeof customIcon === 'string') return customIcon;
    return fallbackIcon;
  }

  /**
   * 获取按钮配置（已排序，包含默认按钮兜底）
   * - 未传 buttons：使用默认按钮
   * - 传了 buttons：按传入按钮列表渲染，并用默认按钮补齐缺省字段
   */
  private getButtonConfigs(): ResolvedButtonConfig[] {
    const hasCustomButtons = Array.isArray(this.config.buttons) && this.config.buttons.length > 0;
    const sourceButtons: Array<ButtonConfig | CustomButtonConfig> = hasCustomButtons
      ? (this.config.buttons as CustomButtonConfig[])
      : (defaultButtons as ButtonConfig[]);

    const resolvedButtons: ResolvedButtonConfig[] = sourceButtons.map((btn) => {
      const isCustom = (btn as CustomButtonConfig).icon !== undefined;
      const customButton = isCustom ? (btn as CustomButtonConfig) : undefined;
      const defaultButton = defaultButtons.find(d => d.id === btn.id);

      const resolvedIcon = customButton
        ? this.resolveIcon(customButton.icon, defaultButton?.icon ?? '')
        : (btn as ButtonConfig).icon;

      return {
        id: btn.id,
        icon: resolvedIcon,
        title: (customButton?.title ?? (btn as ButtonConfig).title ?? defaultButton?.title ?? '') as string,
        size: customButton?.size ?? (btn as ButtonConfig).size ?? defaultButton?.size,
        backgroundColor: customButton?.backgroundColor ?? (btn as ButtonConfig).backgroundColor ?? defaultButton?.backgroundColor,
        borderColor: customButton?.borderColor ?? (btn as ButtonConfig).borderColor ?? defaultButton?.borderColor,
        borderWidth: customButton?.borderWidth ?? (btn as ButtonConfig).borderWidth ?? defaultButton?.borderWidth,
        borderStyle: customButton?.borderStyle ?? (btn as ButtonConfig).borderStyle ?? defaultButton?.borderStyle,
        hoverColor: customButton?.hoverColor ?? (btn as ButtonConfig).hoverColor ?? defaultButton?.hoverColor,
        activeColor: customButton?.activeColor ?? (btn as ButtonConfig).activeColor ?? defaultButton?.activeColor,
        color: customButton?.color ?? (btn as ButtonConfig).color ?? defaultButton?.color,
        sort: customButton?.sort ?? (btn as ButtonConfig).sort ?? defaultButton?.sort,
        callback: customButton?.callback ?? (btn as ButtonConfig).callback ?? defaultButton?.callback,
        activeIcon: (customButton && customButton.activeIcon !== false ? customButton.activeIcon : (btn as ButtonConfig).activeIcon) ?? defaultButton?.activeIcon,
      };
    });

    resolvedButtons.sort((a, b) => (a.sort ?? Infinity) - (b.sort ?? Infinity));
    return resolvedButtons;
  }

  /**
   * 重新构建工具栏按钮
   */
  private rebuildToolbarButtons(buttons: ResolvedButtonConfig[]): void {
    // 清除现有按钮（保留工具栏容器）
    const existingButtons = this.toolbarElement.querySelectorAll('.cesium-toolbar-button');
    existingButtons.forEach(btn => {
      if (btn.parentNode) {
        btn.parentNode.removeChild(btn);
      }
    });

    // 按 sort 排序后重新添加按钮
    buttons.forEach(button => {
      const buttonElement = this.createButton(button);
      this.toolbarElement.appendChild(buttonElement);
    });
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
              const formattedDistance = formatDistance(totalDistance);
              console.log(`测距完成，总距离: ${formattedDistance}`);
            }
          }
        } else if (entity.polygon) {
          // 测面积完成
          const positions = entity.polygon.hierarchy?.getValue(Cesium.JulianDate.now()) as Cesium.PolygonHierarchy;
          if (positions && this.measurementCallback?.onAreaComplete) {
            // 计算面积
            const area = calculatePolygonArea(positions.positions, this.viewer.scene.globe.ellipsoid);
            this.measurementCallback.onAreaComplete(positions.positions, area);
          }
        }
      }
    });

    this.drawHelper.onEntityRemoved((entity) => {
      console.log('实体被移除', entity);
    });
  }

  // --- 计算相关方法已移至 calc.ts ---

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

    console.log('创建工具栏按钮:', buttons);

    buttons.forEach(button => {
      const buttonElement = this.createButton(button);
      this.toolbarElement.appendChild(buttonElement);
    });

    this.container.appendChild(this.toolbarElement);
  }

  /**
   * 创建按钮
   */
  private createButton(config: ResolvedButtonConfig): HTMLElement {
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
  private setupButtonEvents(button: HTMLElement, config: ResolvedButtonConfig): void {
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
        this.handleButtonClick(config.id, button);
      });
    } else {
      // 搜索、测量、图层切换按钮使用hover事件
      button.addEventListener('mouseenter', () => {
        this.handleButtonClick(config.id, button);
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
            const isHoveringSearch = searchContainer.matches(':hover');
            const searchInput = searchContainer.querySelector('input') as HTMLInputElement;
            const isInputFocused = searchInput && document.activeElement === searchInput;

            if (!isHoveringSearch && !isInputFocused) {
              this.searchService.closeSearchContainer();
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
            this.mapLayersService.closeLayersMenu();
          }
          break;
      }
    }, 100); // 100ms延迟，给用户时间移动到菜单
  }

  /**
   * 关闭搜索框
   */
  private closeSearchContainer(): void {
    this.searchService.closeSearchContainer();
  }

  /**
   * 处理按钮点击
   */
  private handleButtonClick(buttonId: string, buttonElement: HTMLElement): void {
    // 如果触发的是非搜索按钮，先关闭搜索框
    if (buttonId !== 'search') {
      this.closeSearchContainer();
    }
    if (buttonId !== 'layers') {
      this.mapLayersService.closeLayersMenu();
    }

    switch (buttonId) {
      case 'search':
        this.searchService.toggleSearch(buttonElement);
        break;
      case 'measure':
        this.toggleMeasurement(buttonElement);
        break;
      case 'view2d3d':
        this.toggle2D3D(buttonElement);
        break;
      case 'layers':
        this.mapLayersService.toggleLayers(buttonElement);
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
        this.mapController.toggleFullscreen();
        break;
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

    // 根据按钮在工具栏中的垂直偏移动态定位测量菜单
    const offsetTop = (buttonElement as HTMLElement).offsetTop;

    const menu = document.createElement('div');
    menu.className = 'measurement-menu';
    menu.style.cssText = `
      position: absolute;
      right: 100%;
      top: ${offsetTop}px;
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

    // 插入到按钮前面，这样菜单出现在按钮左侧
    this.toolbarElement.insertBefore(menu, buttonElement);

    // --- 屏幕边缘避让：防止测量菜单超出可视区域 ---
    const menuRect = menu.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    if (menuRect.bottom > viewportHeight) {
      const overflow = menuRect.bottom - viewportHeight;
      const currentTop = parseFloat(menu.style.top || '0');
      const newTop = Math.max(0, currentTop - overflow);
      menu.style.top = `${newTop}px`;
    }

    const updatedRect = menu.getBoundingClientRect();
    if (updatedRect.top < 0) {
      const delta = -updatedRect.top;
      const currentTop = parseFloat(menu.style.top || '0');
      menu.style.top = `${currentTop + delta}px`;
    }

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
   * 复位到初始位置
   */
  private resetLocation(): void {
    this.mapController.resetLocation();
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
   * 加载并显示机场禁飞区
   * @deprecated 使用 NotFlyZonesService.showNoFlyZones 代替
   */
  public async showNoFlyZones(): Promise<void> {
    return this.notFlyZonesService.showNoFlyZones();
  }

  /**
   * 隐藏机场禁飞区
   * @deprecated 使用 NotFlyZonesService.hideNoFlyZones 代替
   */
  public hideNoFlyZones(): void {
    this.notFlyZonesService.hideNoFlyZones();
  }

  /**
   * 切换机场禁飞区显示状态
   * @deprecated 使用 NotFlyZonesService.toggleNoFlyZones 代替
   */
  public toggleNoFlyZones(): Promise<void> {
    return this.notFlyZonesService.toggleNoFlyZones();
  }

  /**
   * 获取禁飞区显示状态
   * @deprecated 使用 NotFlyZonesService.getNoFlyZoneVisible 代替
   */
  public getNoFlyZoneVisible(): boolean {
    return this.notFlyZonesService.getNoFlyZoneVisible();
  }

  /**
   * 销毁工具栏
   */
  destroy(): void {
    // 清理禁飞区服务
    this.notFlyZonesService.destroy();

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
    this.searchService.destroy();
    this.mapLayersService.destroy();
    this.drawHelper.destroy();
  }
}
