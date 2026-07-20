import type { Viewer } from 'cesium';
import { CesiumMapController } from './toolBar/CesiumMapController';
import { MeasurementService } from './toolBar/MeasurementService';
import { SearchService } from './toolBar/MapSearchService';
import { MapLayersService } from './toolBar/MapLayersService';
import { NotFlyZonesService } from './toolBar/NotFlyZonesService';
import type { MapType, ToolbarConfig, SearchCallback, MeasurementCallback, ZoomCallback, CustomButtonConfig } from '../core/types';
/**
 * Cesium地图工具栏类
 * 提供搜索、测量、2D/3D切换、图层切换、定位、缩放、全屏等功能
 */
export declare class CesiumMapToolbar {
    private viewer;
    private drawHelper;
    private container;
    private toolbarElement;
    private config;
    private searchService;
    private mapLayersService;
    private notFlyZonesService;
    private measurementCallback?;
    private zoomCallback?;
    private fullscreenCallback?;
    private resetLocationCallback?;
    private initialCenter?;
    private currentMapType;
    TD_Token: string;
    mapTypes: MapType[];
    private isNoFlyZoneChecked;
    private currentGeoWTFS;
    private measurementService;
    private unsubscribeI18n?;
    private sceneModeListenerDispose?;
    private i18n;
    private useI18n;
    readonly measurement: {
        getMeasureMode: () => "none" | "distance" | "area";
    };
    private mapController;
    constructor(viewer: Viewer, container: HTMLElement, config?: ToolbarConfig, callbacks?: {
        search?: SearchCallback;
        measurement?: MeasurementCallback;
        zoom?: ZoomCallback;
        fullscreen?: (isFullscreen: boolean) => void;
        resetLocation?: () => void;
    }, initialCenter?: {
        longitude: number;
        latitude: number;
        height: number;
    });
    /**
     * searchService 对外暴露的获取搜索服务方法
     */
    getSearchService(): SearchService;
    /**
     * notFlyZonesService 对外暴露的获取禁飞区服务方法
     */
    getNotFlyZonesService(): NotFlyZonesService;
    /**
     * measurementService 对外暴露的获取测量服务方法
     */
    getMeasurementService(): MeasurementService;
    /**
     * cesmapController 对外暴露的获取地图控制器方法
     */
    getCesiumMapCtrl(): CesiumMapController;
    /**
     * mapLayersService 对外暴露的获取图层服务方法
     */
    getMapLayersService(): MapLayersService;
    /**
     * 设置地图类型配置
     * @param mapTypes
     */
    setMapTypes(mapTypes: MapType[]): void;
    /**
     * 设置天地图密钥
     * @param TD_Token
     */
    setTDToken(TD_Token: string): void;
    /**
     * 设置初始中心点
     */
    setInitialCenter(center: {
        longitude: number;
        latitude: number;
        height: number;
    }): void;
    /**
     * 获取初始中心点
     */
    getInitialCenter(): {
        longitude: number;
        latitude: number;
        height: number;
    } | undefined;
    /**
     * 复位到初始位置（公共方法）
     */
    resetToInitialLocation(): void;
    /**
     * 更新按钮配置
     */
    updateButtonConfig(buttonId: string, config: Partial<CustomButtonConfig>): void;
    /**
     * 添加自定义按钮
     * @param config 按钮配置，支持 sort 参数控制插入位置
     */
    addCustomButton(config: CustomButtonConfig): void;
    /**
     * 获取所有按钮配置（包括默认按钮和自定义按钮），并添加 sort 值
     */
    private resolveIcon;
    /**
     * 获取按钮配置（已排序，包含默认按钮兜底）
     * - 未传 buttons：使用默认按钮
     * - 传了 buttons：按传入按钮列表渲染，并用默认按钮补齐缺省字段
     */
    private getButtonConfigs;
    /**
     * 重新构建工具栏按钮
     */
    private rebuildToolbarButtons;
    /**
     * 移除按钮
     */
    removeButton(buttonId: string): void;
    /**
     * 获取按钮元素
     */
    private setupDrawHelperCallbacks;
    /**
     * 创建工具栏
     */
    private createToolbar;
    /**
     * 创建按钮
     */
    private createButton;
    /**
     * 设置按钮图标
     */
    private setButtonIcon;
    /**
     * 判断是否为图片路径
     */
    private isImagePath;
    /**
     * 加载图片图标
     */
    private loadImageIcon;
    /**
     * 设置默认图标（当图片加载失败时）
     */
    private setDefaultIcon;
    /**
     * 设置按钮事件
     */
    private setupButtonEvents;
    /**
     * 按钮鼠标离开时关闭菜单
     */
    private closeMenuOnButtonLeave;
    /**
     * 关闭搜索框
     */
    private closeSearchContainer;
    /**
     * 处理按钮点击
     */
    private handleButtonClick;
    /**
     * 切换测量功能
     */
    private toggleMeasurement;
    /**
     * 处理测量操作
     */
    private handleMeasurementAction;
    /**
     * 切换2D/3D视图
     */
    private toggle2D3D;
    /**
     * 复位到初始位置
     */
    private resetLocation;
    /**
     * 放大
     */
    private zoomIn;
    /**
     * 缩小
     */
    private zoomOut;
    /**
     * 加载并显示机场禁飞区
     * @deprecated 使用 NotFlyZonesService.showNoFlyZones 代替
     */
    showNoFlyZones(): Promise<void>;
    /**
     * 隐藏机场禁飞区
     * @deprecated 使用 NotFlyZonesService.hideNoFlyZones 代替
     */
    hideNoFlyZones(): void;
    /**
     * 切换机场禁飞区显示状态
     * @deprecated 使用 NotFlyZonesService.toggleNoFlyZones 代替
     */
    toggleNoFlyZones(): Promise<void>;
    /**
     * 获取禁飞区显示状态
     * @deprecated 使用 NotFlyZonesService.getNoFlyZoneVisible 代替
     */
    getNoFlyZoneVisible(): boolean;
    /**
     * 同步 view2d3d 按钮显示当前场景模式
     */
    private syncView2D3DButton;
    /**
     * 销毁工具栏
     */
    destroy(): void;
}
