/**
 * 工具栏服务
 * 负责工具栏的创建、按钮管理、事件协调等核心功能
 */
import { Toolbar } from '../../../components/Toolbar';
import type { CustomButtonConfig, LayersPanelStyleConfig, SearchPanelStyleConfig, ToolbarConfig as CoreToolbarConfig } from '../../../core/types';
import type { IButtonHandler, ToolbarServiceConfig, MeasurementServiceLike } from './types';
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
import { MapControllerLike } from './buttons/SimpleButtonHandler';
/**
 * 工具栏服务类
 */
export declare class ToolbarService {
    /** 工具栏 UI 组件 */
    private toolbar;
    /** 按钮处理器映射表 */
    private buttonHandlers;
    /** 配置 */
    private config;
    /** 国际化实例 */
    private i18n?;
    /** 是否使用国际化 */
    private useI18n;
    /** 地图控制器 */
    private mapController?;
    /** 测量服务实例 */
    private measurementService?;
    /** 搜索服务实例 */
    private searchService?;
    /** 图层服务实例 */
    private layersService?;
    /** 绘图助手实例 */
    private drawHelper?;
    /** 工具栏服务选项 */
    private options;
    private buttonConfigs?;
    private unsubscribeI18n?;
    /**
     * 构造函数
     * @param config 工具栏服务配置
     * @param options 工具栏服务选项
     */
    constructor(config: ToolbarServiceConfig, options?: ToolbarServiceOptions);
    /**
     * 初始化工具栏
     */
    initialize(): void;
    private setupLocaleSync;
    /**
     * 创建工具栏 UI
     */
    private createToolbar;
    /**
     * 注册默认按钮处理器
     */
    private registerDefaultButtonHandlers;
    /**
     * 初始化按钮
     */
    private initializeButtons;
    /**
     * 注册按钮处理器
     * @param handler 按钮处理器
     */
    registerButtonHandler(handler: IButtonHandler): void;
    /**
     * 获取按钮处理器
     * @param id 按钮 ID
     */
    getButtonHandler(id: string): IButtonHandler | null;
    /**
     * 移除按钮处理器
     * @param id 按钮 ID
     */
    unregisterButtonHandler(id: string): void;
    /**
     * 添加自定义按钮
     * @param config 自定义按钮配置
     * @param onClick 点击回调
     */
    addCustomButton(config: CustomButtonConfig, onClick?: (buttonId: string, buttonElement: HTMLElement) => void): void;
    /**
     * 移除按钮
     * @param buttonId 按钮 ID
     */
    removeButton(buttonId: string): void;
    /**
     * 更新按钮配置
     * @param buttonId 按钮 ID
     * @param config 新的按钮配置
     */
    updateButton(buttonId: string, config: Partial<CustomButtonConfig>): void;
    /**
     * 更新工具栏样式，避免业务层重新初始化工具栏。
     */
    updateToolbarStyle(config: Partial<CoreToolbarConfig>): void;
    /**
     * 启用按钮
     * @param buttonId 按钮 ID
     */
    enableButton(buttonId: string): void;
    /**
     * 禁用按钮
     * @param buttonId 按钮 ID
     */
    disableButton(buttonId: string): void;
    /**
     * 显示按钮
     * @param buttonId 按钮 ID
     */
    showButton(buttonId: string): void;
    /**
     * 隐藏按钮
     * @param buttonId 按钮 ID
     */
    hideButton(buttonId: string): void;
    /**
     * 设置测量服务
     * @param service 测量服务实例
     */
    setMeasurementService(service: MeasurementServiceLike): void;
    /**
     * 设置搜索服务
     * @param service 搜索服务实例
     */
    setSearchService(service: any): void;
    /**
     * 设置图层服务
     * @param service 图层服务实例
     */
    setLayersService(service: any): void;
    /**
     * 获取搜索服务
     */
    getSearchService(): any;
    /**
     * 获取测量服务
     */
    getMeasurementService(): any;
    /**
     * 获取图层服务
     */
    getLayersService(): any;
    /**
     * 设置地图控制器
     * @param controller 地图控制器
     */
    setMapController(controller: MapControllerLike): void;
    /**
     * 获取工具栏 UI 组件
     */
    getToolbar(): Toolbar | null;
    /**
     * 获取工具栏容器元素
     */
    getToolbarElement(): HTMLElement | null;
    /**
     * 关闭所有打开的菜单
     */
    closeAllMenus(): void;
    /**
     * 销毁工具栏服务
     */
    destroy(): void;
}
/**
 * 创建工具栏服务的工厂函数
 * @param config 工具栏服务配置
 * @param options 工具栏服务选项
 * @returns 工具栏服务实例
 */
export declare function createToolbarService(config: ToolbarServiceConfig, options?: ToolbarServiceOptions): ToolbarService;
