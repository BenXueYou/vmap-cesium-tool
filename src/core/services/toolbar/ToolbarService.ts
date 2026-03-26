/**
 * 工具栏服务
 * 负责工具栏的创建、按钮管理、事件协调等核心功能
 */

import { Toolbar, createToolbar } from '../../../components/Toolbar';
import { ToolbarButton, createToolbarButton } from '../../../components/ToolbarButton';
import type { CustomButtonConfig, LayersPanelStyleConfig, SearchPanelStyleConfig, ToolbarConfig as CoreToolbarConfig } from '../../../core/types';
import type { I18nLike } from '../../../i18n';

import type {
  IButtonHandler,
  ToolbarServiceConfig,
  ToolbarCallbacks,
  DefaultButtonConfig,
} from './types';

import { DEFAULT_TOOLBAR_STYLE, DEFAULT_BUTTON_CONFIGS } from './config';
import { deepMerge } from '../../../utils/common';
/**
 * 工具栏服务配置扩展
 * 支持自定义工具栏样式和按钮配置
 */
export interface ToolbarServiceOptions {
  /** 工具栏样式配置 */
  toolbarStyle?: Partial<CoreToolbarConfig>;
  /** 按钮配置列表（覆盖默认配置） */
  buttonConfigs?: CustomButtonConfig[];
  /** 是否使用默认按钮 */
  useDefaultButtons?: boolean;
  /** 搜索面板样式 */
  searchPanelStyle?: SearchPanelStyleConfig;
  /** 搜索面板默认动作图标 */
  searchIdleActionIcon?: string | HTMLElement;
  /** 搜索面板清空动作图标 */
  searchClearActionIcon?: string | HTMLElement;
  /** 图层菜单样式 */
  layersPanelStyle?: LayersPanelStyleConfig;
}

import { SearchButtonHandler } from './buttons/SearchButtonHandler';
import { MeasureButtonHandler } from './buttons/MeasureButtonHandler';
import { LayersButtonHandler, MapTypeConfig } from './buttons/LayersButtonHandler';
import { SimpleButtonHandler, SimpleButtonConfig, MapControllerLike } from './buttons/SimpleButtonHandler';

/**
 * 工具栏服务类
 */
export class ToolbarService {
  /** 工具栏 UI 组件 */
  private toolbar: Toolbar | null = null;
  
  /** 按钮处理器映射表 */
  private buttonHandlers: Map<string, IButtonHandler> = new Map();
  
  /** 配置 */
  private config: ToolbarServiceConfig;
  
  /** 国际化实例 */
  private i18n?: I18nLike;
  
  /** 是否使用国际化 */
  private useI18n: boolean;
  
  /** 地图控制器 */
  private mapController?: MapControllerLike;
  
  /** 测量服务实例 */
  private measurementService?: any;
  
  /** 搜索服务实例 */
  private searchService?: any;
  
  /** 图层服务实例 */
  private layersService?: any;
  
  /** 绘图助手实例 */
  private drawHelper?: any;
  
  /** 工具栏服务选项 */
  private options: ToolbarServiceOptions;

  private buttonConfigs?: Array<CustomButtonConfig>;

  /**
   * 构造函数
   * @param config 工具栏服务配置
   * @param options 工具栏服务选项
   */
  constructor(config: ToolbarServiceConfig, options?: ToolbarServiceOptions) {
    this.config = config;
    this.i18n = config.i18n;
    this.useI18n = config.useI18n ?? true;
    this.drawHelper = config.drawHelper;
    this.options = {
      useDefaultButtons: true,
      ...options,
    };
    this.buttonConfigs = this.options.buttonConfigs
      ? this.options.buttonConfigs.map((config) => {
          const defaultConfig = DEFAULT_BUTTON_CONFIGS.find((btn) => btn.id === config.id);
          return deepMerge(defaultConfig || config, config) as CustomButtonConfig;
        })
      : DEFAULT_BUTTON_CONFIGS;
    
  }

  /**
   * 初始化工具栏
   */
  initialize(): void {
    // 创建工具栏 UI
    this.createToolbar();
    
    // 注册默认按钮处理器
    this.registerDefaultButtonHandlers();
    
    // 初始化所有按钮
    this.initializeButtons();
  }

  /**
   * 创建工具栏 UI
   */
  private createToolbar(): void {
    const { container } = this.config;
    
    // 合并默认样式和用户自定义样式
    const toolbarStyle = {
      ...DEFAULT_TOOLBAR_STYLE,
      ...this.options.toolbarStyle,
    };
    
    // 使用 Toolbar 组件创建工具栏
    this.toolbar = createToolbar({
      position: toolbarStyle.position,
      direction: toolbarStyle.direction,
      buttonSize: toolbarStyle.buttonSize,
      buttonSpacing: toolbarStyle.buttonSpacing,
      padding: toolbarStyle.padding,
      backgroundColor: toolbarStyle.backgroundColor,
      borderColor: toolbarStyle.borderColor,
      borderWidth: toolbarStyle.borderWidth,
      borderRadius: toolbarStyle.borderRadius,
      boxShadow: toolbarStyle.boxShadow,
      zIndex: toolbarStyle.zIndex,
      offsetTop: toolbarStyle.offsetTop,
      offsetRight: toolbarStyle.offsetRight,
      offsetBottom: toolbarStyle.offsetBottom,
      offsetLeft: toolbarStyle.offsetLeft,
    });

    // 挂载到容器
    this.toolbar.mount(container);
  }

  /**
   * 注册默认按钮处理器
   */
  private registerDefaultButtonHandlers(): void {
    const { viewer, callbacks } = this.config;
    
    // 获取按钮配置（使用用户自定义配置或默认配置）
    this.buttonConfigs = this.options.buttonConfigs || DEFAULT_BUTTON_CONFIGS;

    // 搜索按钮
    const searchHandler = new SearchButtonHandler(
      viewer,
      {
        searchService: this.searchService,
        searchContainerStyle: this.options.searchPanelStyle,
        idleActionIcon: this.options.searchIdleActionIcon,
        clearActionIcon: this.options.searchClearActionIcon,
        onSearch: callbacks?.onSearch,
        onSelect: callbacks?.onSelect,
      },
      this.i18n,
      this.useI18n
    );
    this.registerButtonHandler(searchHandler);

    // 测量按钮
    const measureHandler = new MeasureButtonHandler(
      viewer,
      {
        measurementService: this.measurementService,
        drawHelper: this.drawHelper,
        onDistanceStart: callbacks?.onMeasurementStart,
        getDistanceDrawOptions: callbacks?.getDistanceDrawOptions,
        onAreaStart: () => {},
        getAreaDrawOptions: callbacks?.getAreaDrawOptions,
        onClear: callbacks?.onClear,
      },
      this.i18n,
      this.useI18n
    );
    this.registerButtonHandler(measureHandler);

    // 图层按钮
    const layersHandler = new LayersButtonHandler(
      this.toolbar?.getElement() || this.config.container,
      {
        layersService: this.layersService,
        mapTypes: this.config.layers?.mapTypes as MapTypeConfig[] || [],
        currentMapType: this.config.layers?.currentMapType,
        isPlaceNameChecked: this.config.layers?.isPlaceNameChecked,
        token: this.config.layers?.token,
        isNoFlyZoneChecked: this.config.noFlyZone?.isChecked,
        onMapTypeChange: this.config.layers?.onMapTypeChange,
        onPlaceNameToggle: this.config.layers?.onPlaceNameToggle,
        panelStyle: this.options.layersPanelStyle,
        onShowNoFlyZones: async () => {
          if (this.layersService?.showNoFlyZones) {
            await this.layersService.showNoFlyZones();
          }
        },
        onNoFlyZoneToggle: (isChecked: boolean) => {
          if (this.layersService?.toggleNoFlyZoneVisibility) {
            this.layersService.toggleNoFlyZoneVisibility();
            return;
          }

          if (isChecked) {
            void this.layersService?.showNoFlyZones?.();
            return;
          }

          this.layersService?.hideNoFlyZones?.();
        },
      },
      this.i18n,
      this.useI18n
    );
    this.registerButtonHandler(layersHandler);

    // 从配置中读取简单按钮（2D/3D、定位、缩放、全屏）
    const simpleButtonIds = ['view2d3d', 'location', 'zoom-in', 'zoom-out', 'fullscreen'];
    
    simpleButtonIds.forEach(id => {
      const btnConfig = this.buttonConfigs?.find(btn => btn.id === id);
      if (btnConfig) {
        const handler = new SimpleButtonHandler(
          {
            id: btnConfig.id,
            title: btnConfig.title,
            titleKey: btnConfig.titleKey,
            icon: btnConfig.icon as string | HTMLElement,
            toggleable: id === 'view2d3d',
            activeIcon: btnConfig.activeIcon as string | HTMLElement | undefined,
          },
          viewer,
          this.mapController,
          this.i18n,
          this.useI18n
        );
        this.registerButtonHandler(handler);
      }
    });
  }

  /**
   * 初始化按钮
   */
  private initializeButtons(): void {
    if (!this.toolbar) return;
    
    // 检查是否使用默认按钮
    if (this.options.useDefaultButtons === false) return;

    // 获取按钮配置（使用用户自定义配置或默认配置）
    const buttonConfigs = this.buttonConfigs || DEFAULT_BUTTON_CONFIGS;
    
    // 按排序号排序
    const sortedConfigs = [...buttonConfigs].sort((a, b) => (a.sort || 999) - (b.sort || 999));

    sortedConfigs.forEach(btnConfig => {
      const handler = this.getButtonHandler(btnConfig.id);
      if (handler && this.toolbar) {
        // 添加到工具栏，使用完整的按钮配置（包含样式）
        this.toolbar.addButton({
          id: btnConfig.id,
          icon: btnConfig.icon,
          title: btnConfig.title,
          titleKey: btnConfig.titleKey,
          size: btnConfig.size,
          color: btnConfig.color,
          borderColor: btnConfig.borderColor,
          backgroundColor: btnConfig.backgroundColor,
          hoverColor: btnConfig.hoverColor,
          activeColor: btnConfig.activeColor,
          activeIcon: btnConfig.activeIcon,
          sort: btnConfig.sort,
          onClick: () => handler.handleClick(),
        });

        // 获取刚添加的按钮并初始化处理器
        const button = this.toolbar.getButton(btnConfig.id);
        if (button) {
          handler.initialize(button);
          // 设置工具栏元素引用（如果处理器支持）
          if ('setToolbarElement' in handler) {
            (handler as any).setToolbarElement(this.toolbar.getElement());
          }
        }
      }
    });
  }

  /**
   * 注册按钮处理器
   * @param handler 按钮处理器
   */
  registerButtonHandler(handler: IButtonHandler): void {
    this.buttonHandlers.set(handler.id, handler);
  }

  /**
   * 获取按钮处理器
   * @param id 按钮 ID
   */
  getButtonHandler(id: string): IButtonHandler | null {
    return this.buttonHandlers.get(id) || null;
  }

  /**
   * 移除按钮处理器
   * @param id 按钮 ID
   */
  unregisterButtonHandler(id: string): void {
    const handler = this.buttonHandlers.get(id);
    if (handler) {
      handler.destroy();
      this.buttonHandlers.delete(id);
    }
  }

  /**
   * 添加自定义按钮
   * @param config 自定义按钮配置
   * @param onClick 点击回调
   */
  addCustomButton(config: CustomButtonConfig, onClick?: (buttonId: string, buttonElement: HTMLElement) => void): void {
    if (!this.toolbar) return;

    // 处理 icon 为 false 的情况，转换为空字符串
    const iconValue = typeof config.icon === 'boolean' && config.icon === false ? '' : config.icon;
    
    const handlerConfig: SimpleButtonConfig = {
      id: config.id,
      title: config.title,
      titleKey: config.titleKey,
      icon: iconValue as string | HTMLElement,
      onClick: onClick as (() => void) || config.onClick,
    };

    const handler = new SimpleButtonHandler(
      handlerConfig,
      this.config.viewer,
      this.mapController,
      this.i18n,
      this.useI18n
    );

    this.registerButtonHandler(handler);

    this.toolbar.addButton({
      ...config,
      onClick: () => handler.handleClick(),
    });

    // 获取刚添加的按钮并初始化
    const button = this.toolbar.getButton(config.id);
    if (button) {
      handler.initialize(button);
      if ('setToolbarElement' in handler) {
        (handler as any).setToolbarElement(this.toolbar.getElement());
      }
    }
  }

  /**
   * 移除按钮
   * @param buttonId 按钮 ID
   */
  removeButton(buttonId: string): void {
    this.toolbar?.removeButton(buttonId);
    this.unregisterButtonHandler(buttonId);
  }

  /**
   * 更新按钮配置
   * @param buttonId 按钮 ID
   * @param config 新的按钮配置
   */
  updateButton(buttonId: string, config: Partial<CustomButtonConfig>): void {
    this.toolbar?.updateButton(buttonId, config);
  }

  /**
   * 更新工具栏样式，避免业务层重新初始化工具栏。
   */
  updateToolbarStyle(config: Partial<CoreToolbarConfig>): void {
    this.options.toolbarStyle = {
      ...(this.options.toolbarStyle || {}),
      ...config,
    };
    this.toolbar?.updateConfig(config);
  }

  /**
   * 启用按钮
   * @param buttonId 按钮 ID
   */
  enableButton(buttonId: string): void {
    this.toolbar?.enableButton(buttonId);
  }

  /**
   * 禁用按钮
   * @param buttonId 按钮 ID
   */
  disableButton(buttonId: string): void {
    this.toolbar?.disableButton(buttonId);
  }

  /**
   * 显示按钮
   * @param buttonId 按钮 ID
   */
  showButton(buttonId: string): void {
    this.toolbar?.showButton(buttonId);
  }

  /**
   * 隐藏按钮
   * @param buttonId 按钮 ID
   */
  hideButton(buttonId: string): void {
    this.toolbar?.hideButton(buttonId);
  }

  /**
   * 设置测量服务
   * @param service 测量服务实例
   */
  setMeasurementService(service: any): void {
    this.measurementService = service;

    const handler = this.getButtonHandler('measure') as MeasureButtonHandler;
    handler?.updateOptions({
      measurementService: service,
      drawHelper: this.drawHelper,
      onDistanceStart: this.config.callbacks?.onMeasurementStart,
      onAreaStart: () => {},
      onClear: this.config.callbacks?.onClear,
    });
  }

  /**
   * 设置搜索服务
   * @param service 搜索服务实例
   */
  setSearchService(service: any): void {
    this.searchService = service;

    const handler = this.getButtonHandler('search') as SearchButtonHandler;
    handler?.updateOptions({
      searchService: service,
      searchContainerStyle: this.options.searchPanelStyle,
      idleActionIcon: this.options.searchIdleActionIcon,
      clearActionIcon: this.options.searchClearActionIcon,
      onSearch: this.config.callbacks?.onSearch,
      onSelect: this.config.callbacks?.onSelect,
    });
  }

  /**
   * 设置图层服务
   * @param service 图层服务实例
   */
  setLayersService(service: any): void {
    this.layersService = service;

    const handler = this.getButtonHandler('layers') as LayersButtonHandler;
    handler?.updateOptions({
      layersService: service,
      mapTypes: this.config.layers?.mapTypes as MapTypeConfig[] || [],
      currentMapType: this.config.layers?.currentMapType,
      isPlaceNameChecked: this.config.layers?.isPlaceNameChecked,
      token: this.config.layers?.token,
      isNoFlyZoneChecked: this.config.noFlyZone?.isChecked,
      onMapTypeChange: this.config.layers?.onMapTypeChange,
      onPlaceNameToggle: this.config.layers?.onPlaceNameToggle,
      panelStyle: this.options.layersPanelStyle,
      onShowNoFlyZones: async () => {
        await service?.showNoFlyZones?.();
      },
      onNoFlyZoneToggle: (isChecked: boolean) => {
        if (service?.toggleNoFlyZoneVisibility) {
          service.toggleNoFlyZoneVisibility();
          return;
        }

        if (isChecked) {
          void service?.showNoFlyZones?.();
          return;
        }

        service?.hideNoFlyZones?.();
      },
    });
  }

  /**
   * 设置地图控制器
   * @param controller 地图控制器
   */
  setMapController(controller: MapControllerLike): void {
    this.mapController = controller;
    
    // 更新所有简单按钮处理器的地图控制器
    this.buttonHandlers.forEach(handler => {
      if (handler instanceof SimpleButtonHandler) {
        handler.setMapController(controller);
      }
    });
  }

  /**
   * 获取工具栏 UI 组件
   */
  getToolbar(): Toolbar | null {
    return this.toolbar;
  }

  /**
   * 获取工具栏容器元素
   */
  getToolbarElement(): HTMLElement | null {
    return this.toolbar?.getElement() || null;
  }

  /**
   * 关闭所有打开的菜单
   */
  closeAllMenus(): void {
    this.buttonHandlers.forEach(handler => {
      if (handler instanceof SearchButtonHandler) {
        handler.closeSearch();
      } else if (handler instanceof MeasureButtonHandler) {
        handler.hideMenu();
      } else if (handler instanceof LayersButtonHandler) {
        handler.hide();
      }
    });
  }

  /**
   * 销毁工具栏服务
   */
  destroy(): void {
    // 销毁所有按钮处理器
    this.buttonHandlers.forEach(handler => handler.destroy());
    this.buttonHandlers.clear();
    
    // 销毁工具栏 UI
    this.toolbar?.destroy();
    this.toolbar = null;
  }
}

/**
 * 创建工具栏服务的工厂函数
 * @param config 工具栏服务配置
 * @param options 工具栏服务选项
 * @returns 工具栏服务实例
 */
export function createToolbarService(config: ToolbarServiceConfig, options?: ToolbarServiceOptions): ToolbarService {
  return new ToolbarService(config, options);
}
