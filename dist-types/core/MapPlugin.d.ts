import * as Cesium from 'cesium';
import type { BaseMapConfig, MapAuthConfig, CameraConfig, DrawPluginOptions, LayersConfig, MapPluginOptions, OverlayPluginOptions, ToolbarConfig, ToolbarPluginOptions, CreditsOptions } from './types';
import { OverlayService } from './services/overlay/OverlayService';
import { DrawService } from './services/draw/DrawService';
import { ToolbarService } from './services/toolbar/ToolbarService';
export interface LayersServiceBridge {
    setMapType: (mapTypeId: string) => void;
    setPlaceNameVisible: (isChecked: boolean) => void;
    togglePlaceNameVisibility: () => void;
    showNoFlyZones: () => Promise<void>;
    hideNoFlyZones: () => void;
    toggleNoFlyZoneVisibility: () => void;
    toggleNoFlyZones: () => Promise<void>;
    getNoFlyZoneVisible: () => boolean;
}
/**
 * 地图插件核心类
 * 负责整合所有地图功能，提供统一的 API 接口
 */
export declare class MapPlugin {
    private viewer;
    private containerId;
    private viewerOptions;
    private cameraConfig;
    private layersConfig;
    private baseMapConfig;
    private mapAuthConfig;
    private providerSearchConfig;
    private creditsConfig;
    private cesiumToken;
    private toolbarConfig;
    private toolbarLayersMenuConfig;
    private servicesConfig;
    private noFlyZoneConfig;
    private initialCenter;
    private toolbarController;
    private toolbarMapTypes;
    private currentMapTypeId;
    private placeNameVisible;
    private nonForcedPlaceNameVisible;
    private noFlyZoneVisible;
    private noFlyZoneDataSource;
    private noFlyZoneLoadPromise;
    private currentGeoWTFS;
    private sceneModeListenerDispose;
    private offlineCleanup;
    private layerRequestVersion;
    private toolbarService;
    private overlayService;
    private drawService;
    private isInitialized;
    /**
     * 构造函数
     * @param containerId 地图容器 ID
     * @param options 地图插件配置选项
     */
    constructor(containerId: string, options?: Partial<MapPluginOptions>);
    private getToolbarConfig;
    private getToolbarLayersMenuConfig;
    private resolveNoFlyZoneConfig;
    private toInitialCenter;
    private isServiceEnabled;
    private getServiceConfig;
    private ensureViewer;
    private getToolbarContainer;
    private getToolbarController;
    private initializeServices;
    /**
     * 合并相机配置
     */
    private mergeCameraConfig;
    /**
     * 合并图层配置
     */
    private mergeLayersConfig;
    private resolveBaseMapConfig;
    private resolveCurrentMapTypeId;
    private resolvePlaceNameVisible;
    private getToolbarMapTypes;
    private getCurrentToolbarMapType;
    private getLayerToken;
    private getLayerSk;
    private resetTerrainProvider;
    private applyTerrainProvider;
    private ensureNoFlyZoneDataSource;
    private destroyGeoWTFS;
    private syncGeoWTFS;
    private refreshLayersAndGeoWTFS;
    private syncCreditDisplay;
    private clearOfflineConstraints;
    private applyOfflineConstraints;
    private updateToolbarLayerState;
    private createLayersServiceBridge;
    private syncOfflineToolbarState;
    private setMapType;
    private setPlaceNameVisible;
    showNoFlyZones(): Promise<void>;
    hideNoFlyZones(): void;
    toggleNoFlyZones(): Promise<void>;
    getNoFlyZoneVisible(): boolean;
    getLayersServiceBridge(): LayersServiceBridge;
    /**
     * 初始化地图
     */
    initialize(): Promise<Cesium.Viewer>;
    /**
     * 添加地图图层
     */
    private addLayers;
    /**
     * 添加天地图图层
     */
    private addTDTLayers;
    /**
     * 添加高德地图图层
     */
    private addGaodeLayers;
    /**
     * 添加百度地图图层
     */
    private addBaiduLayers;
    /**
     * 添加 OSM 图层
     */
    private addOSMLayers;
    /**
     * 添加自定义图层
     */
    private addCustomLayers;
    /**
     * 设置相机视图
     */
    private setCameraView;
    /**
     * 获取 Cesium Viewer 实例
     */
    getViewer(): Cesium.Viewer | null;
    /**
     * 获取当前配置
     */
    getConfig(): MapPluginOptions;
    /**
     * 更新相机配置
     */
    updateCamera(config: Partial<CameraConfig>): void;
    /**
     * 更新图层配置
     */
    updateLayers(config: Partial<LayersConfig>): void;
    updateBaseMap(baseMap: Partial<BaseMapConfig>): void;
    updateMapAuth(mapAuth: MapAuthConfig): void;
    /** 替换全部厂商鉴权，适合单一当前服务商配置。 */
    setMapAuth(mapAuth: MapAuthConfig): void;
    /** 运行时更新 Cesium credit/版权区域显示状态。 */
    updateCredits(credits: CreditsOptions): void;
    /**
     * 创建 ToolbarService
     */
    createToolbarService(options?: ToolbarPluginOptions): ToolbarService;
    /**
     * 获取 ToolbarService
     */
    getToolbarService(): ToolbarService | null;
    /**
     * 创建 OverlayService
     */
    createOverlayService(options?: OverlayPluginOptions): OverlayService;
    /**
     * 获取 OverlayService
     */
    getOverlayService(): OverlayService;
    /**
     * 创建 DrawService
     */
    createDrawService(options?: DrawPluginOptions): DrawService;
    /**
     * 获取 DrawService
     */
    getDrawService(): DrawService;
    /**
     * 销毁插件
     */
    destroy(): void;
    /**
     * 检查是否已初始化
     */
    isReady(): boolean;
}
/**
 * 创建地图插件实例的工厂函数
 * @param containerId 地图容器 ID
 * @param options 地图插件配置选项
 */
export declare function createMapPlugin(containerId: string, options?: Partial<MapPluginOptions>, toolbarConfig?: ToolbarConfig): MapPlugin;
