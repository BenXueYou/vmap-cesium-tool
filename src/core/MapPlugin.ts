import * as Cesium from 'cesium';
import type {
  CameraConfig,
  DrawPluginOptions,
  GaodeLayerConfig,
  BaiduLayerConfig,
  CustomLayerConfig,
  LayersConfig,
  MapType,
  MapPluginOptions,
  MapPluginServicesOptions,
  OSMLayerConfig,
  OverlayPluginOptions,
  TDTLayerConfig,
  ToolbarLayersMenuOptions,
  ToolbarConfig,
  ToolbarPluginOptions,
} from './types';
import { 
  DEFAULT_CAMERA_CONFIG,
  DEFAULT_PROVIDER_TYPE,
} from './constants';
import { DEFAULT_TOOLBAR_STYLE, DEFAULT_MAP_TYPES } from './services/toolbar/config';
import { OverlayService } from './services/overlay/OverlayService';
import { DrawService } from './services/draw/DrawService';
import { ToolbarService } from './services/toolbar/ToolbarService';
import type { ToolbarServiceOptions } from './services/toolbar/ToolbarService';

import { 
  createTDTImageryConfig,
  createTDTVectorConfig,
  createTDTTerrainConfig 
} from './layers/TDTMapLayer';

import {
  createGaodeImageryConfig,
  createGaodeVectorConfig
} from './layers/GaodeMapLayer';

import {
  createBaiduImageryConfig
} from './layers/BaiduMapLayer';

import {
  createOSMConfig
} from './layers/OSMMapLayer';
import { loadAllAirportNoFlyZones, geojsonCoordinatesToCartesian3 } from '../utils/geojson';

interface InitialCenter {
  longitude: number;
  latitude: number;
  height: number;
}

class PluginMapController {
  constructor(
    private readonly viewer: Cesium.Viewer,
    private readonly getInitialCenter: () => InitialCenter,
    private readonly setInitialCenter: (center: InitialCenter) => void,
  ) {}

  toggle2D3D(): void {
    if (this.viewer.scene.mode === Cesium.SceneMode.SCENE3D) {
      this.viewer.scene.morphTo2D(0);
      return;
    }

    this.viewer.scene.morphTo3D(0);
  }

  resetLocation(): void {
    const center = this.getInitialCenter();
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(center.longitude, center.latitude, center.height),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
      duration: 0,
    });
  }

  zoomIn(): void {
    const height = this.viewer.camera.positionCartographic.height || 1000;
    this.viewer.camera.zoomIn(Math.max(height * 0.5, 100));
  }

  zoomOut(): void {
    const height = this.viewer.camera.positionCartographic.height || 1000;
    this.viewer.camera.zoomOut(Math.max(height * 0.5, 100));
  }

  toggleFullscreen(): void {
    const container = this.viewer.container as HTMLElement;
    if (!document.fullscreenElement) {
      void container.requestFullscreen?.();
      return;
    }

    void document.exitFullscreen?.();
  }

  setInitialCenterValue(center: InitialCenter): void {
    this.setInitialCenter(center);
  }

  getInitialCenterValue(): InitialCenter {
    return this.getInitialCenter();
  }
}

/**
 * 地图插件核心类
 * 负责整合所有地图功能，提供统一的 API 接口
 */
export class MapPlugin {
  private viewer: Cesium.Viewer | null = null;
  private containerId: string;
  
  // 分层配置
  private viewerOptions: Cesium.Viewer.ConstructorOptions;
  private cameraConfig: CameraConfig;
  private layersConfig: LayersConfig;
  private cesiumToken: string;
  
  // 工具栏和样式配置
  private toolbarConfig: ToolbarConfig;
  private toolbarLayersMenuConfig: ToolbarLayersMenuOptions;
  private servicesConfig: MapPluginServicesOptions;
  private initialCenter: InitialCenter;
  private toolbarController: PluginMapController | null = null;
  private toolbarMapTypes: MapType[];
  private currentMapTypeId: string;
  private placeNameVisible: boolean;
  private noFlyZoneVisible = false;
  private noFlyZoneDataSource: Cesium.CustomDataSource | null = null;
  private noFlyZoneLoadPromise: Promise<Cesium.CustomDataSource> | null = null;
  private currentGeoWTFS: any = null;
  private sceneModeListenerDispose: (() => void) | null = null;

  private toolbarService: ToolbarService | null = null;
  private overlayService: OverlayService | null = null;
  private drawService: DrawService | null = null;
  
  private isInitialized = false;

  /**
   * 构造函数
   * @param containerId 地图容器 ID
   * @param options 地图插件配置选项
   */
  constructor(
    containerId: string,
    options: Partial<MapPluginOptions> = {}
  ) {
    this.containerId = containerId;
    
    // 解析分层配置
    this.viewerOptions = options.viewerOptions || {};
    this.cameraConfig = this.mergeCameraConfig(options.camera);
    this.layersConfig = this.mergeLayersConfig(options.layers);
    this.cesiumToken = options.cesiumToken || '';
    this.servicesConfig = options.services || {};
    this.toolbarLayersMenuConfig = this.getToolbarLayersMenuConfig(options.services?.toolbar);
    this.initialCenter = this.toInitialCenter(this.cameraConfig);
    this.toolbarMapTypes = this.toolbarLayersMenuConfig.mapTypes || DEFAULT_MAP_TYPES;
    this.currentMapTypeId = this.resolveCurrentMapTypeId(this.layersConfig);
    this.placeNameVisible = this.toolbarLayersMenuConfig.defaultPlaceNameChecked
      ?? this.resolvePlaceNameVisible(this.layersConfig);
    this.noFlyZoneVisible = this.toolbarLayersMenuConfig.defaultNoFlyZoneChecked ?? false;
    
    // 工具栏和样式配置（保持向后兼容）
    this.toolbarConfig = this.getToolbarConfig(options.services?.toolbar);
  }

  private getToolbarConfig(toolbarOptions?: boolean | ToolbarPluginOptions): ToolbarConfig {
    if (typeof toolbarOptions === 'object' && toolbarOptions.config) {
      return {
        ...DEFAULT_TOOLBAR_STYLE,
        ...toolbarOptions.config,
      };
    }

    return DEFAULT_TOOLBAR_STYLE;
  }

  private getToolbarLayersMenuConfig(toolbarOptions?: boolean | ToolbarPluginOptions): ToolbarLayersMenuOptions {
    if (typeof toolbarOptions === 'object' && toolbarOptions.layersMenu) {
      return toolbarOptions.layersMenu;
    }

    return {};
  }

  private toInitialCenter(cameraConfig: CameraConfig): InitialCenter {
    return {
      longitude: cameraConfig.center[0],
      latitude: cameraConfig.center[1],
      height: cameraConfig.center[2],
    };
  }

  private isServiceEnabled<T extends { enabled?: boolean }>(
    serviceConfig: boolean | T | undefined,
    defaultEnabled: boolean,
  ): boolean {
    if (typeof serviceConfig === 'boolean') {
      return serviceConfig;
    }

    if (typeof serviceConfig === 'object') {
      return serviceConfig.enabled ?? defaultEnabled;
    }

    return defaultEnabled;
  }

  private getServiceConfig<T>(serviceConfig: boolean | T | undefined): T | undefined {
    return typeof serviceConfig === 'object' ? serviceConfig : undefined;
  }

  private ensureViewer(): Cesium.Viewer {
    if (!this.viewer) {
      throw new Error('MapPlugin 尚未初始化，请先调用 initialize()');
    }

    return this.viewer;
  }

  private getToolbarContainer(toolbarOptions?: ToolbarPluginOptions): HTMLElement {
    const viewer = this.ensureViewer();
    return toolbarOptions?.container ?? (viewer.container as HTMLElement);
  }

  private getToolbarController(): PluginMapController {
    if (!this.toolbarController) {
      const viewer = this.ensureViewer();
      this.toolbarController = new PluginMapController(
        viewer,
        () => this.initialCenter,
        (center) => {
          this.initialCenter = center;
        },
      );
    }

    return this.toolbarController;
  }

  private initializeServices(): void {
    if (this.isServiceEnabled(this.servicesConfig.overlay, true)) {
      this.createOverlayService(this.getServiceConfig(this.servicesConfig.overlay));
    }

    if (this.isServiceEnabled(this.servicesConfig.draw, true)) {
      this.createDrawService(this.getServiceConfig(this.servicesConfig.draw));
    }

    if (this.isServiceEnabled(this.servicesConfig.toolbar, false)) {
      this.createToolbarService(this.getServiceConfig(this.servicesConfig.toolbar));
    }
  }

  /**
   * 合并相机配置
   */
  private mergeCameraConfig(config?: Partial<CameraConfig>): CameraConfig {
    return {
      ...DEFAULT_CAMERA_CONFIG,
      ...config,
    };
  }

  /**
   * 合并图层配置
   */
  private mergeLayersConfig(config?: Partial<LayersConfig>): LayersConfig {
    const providerType = config?.type || DEFAULT_PROVIDER_TYPE;
    
    const result: LayersConfig = {
      type: providerType,
      tdt: config?.tdt,
      gaode: config?.gaode,
      baidu: config?.baidu,
      arcgis: config?.arcgis,
      osm: config?.osm,
      custom: config?.custom,
    };

    // 如果没有提供具体配置，使用默认值
    if (providerType === 'tdt' && !result.tdt) {
      result.tdt = {
        mapTypeId: 'img',
        token: '',
        showLabel: true,
      };
    }

    return result;
  }

  private resolveCurrentMapTypeId(config: LayersConfig): string {
    switch (config.type) {
      case 'tdt':
        return config.tdt?.mapTypeId || 'img';
      case 'gaode':
        return config.gaode?.mapTypeId || 'satellite';
      case 'baidu':
        return config.baidu?.mapTypeId || 'satellite';
      case 'osm':
        return 'osm';
      case 'custom':
        return 'custom';
      default:
        return 'img';
    }
  }

  private resolvePlaceNameVisible(config: LayersConfig): boolean {
    switch (config.type) {
      case 'tdt':
        return config.tdt?.showLabel ?? true;
      case 'gaode':
        return config.gaode?.showLabel ?? true;
      case 'baidu':
        return config.baidu?.showLabel ?? true;
      default:
        return false;
    }
  }

  private getToolbarMapTypes() {
    return this.toolbarMapTypes;
  }

  private getCurrentToolbarMapType(): MapType | undefined {
    return this.toolbarMapTypes.find((mapType) => mapType.id === this.currentMapTypeId);
  }

  private getLayerToken(): string {
    switch (this.layersConfig.type) {
      case 'tdt':
        return this.layersConfig.tdt?.token || '';
      case 'gaode':
        return this.layersConfig.gaode?.token || '';
      case 'baidu':
        return this.layersConfig.baidu?.token || '';
      default:
        return '';
    }
  }

  private async ensureNoFlyZoneDataSource(): Promise<Cesium.CustomDataSource> {
    if (this.noFlyZoneDataSource) {
      return this.noFlyZoneDataSource;
    }

    if (this.noFlyZoneLoadPromise) {
      return this.noFlyZoneLoadPromise;
    }

    this.noFlyZoneLoadPromise = (async () => {
      const viewer = this.ensureViewer();
      const dataSource = new Cesium.CustomDataSource('airport-no-fly-zones');
      const zones = await loadAllAirportNoFlyZones();

      zones.forEach((zone, index) => {
        const ring = zone.feature.geometry.coordinates[0] || [];
        if (ring.length < 3) {
          return;
        }

        const positions = geojsonCoordinatesToCartesian3(ring, 0);
        const flatPositions = positions.flatMap((position) => [position.longitude, position.latitude, position.height]);

        dataSource.entities.add({
          id: `airport-no-fly-zone-${index}`,
          name: zone.name,
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArrayHeights(flatPositions),
            material: Cesium.Color.RED.withAlpha(0.2),
            outline: true,
            outlineColor: Cesium.Color.RED.withAlpha(0.8),
            height: 0,
            extrudedHeight: 1000,
          },
        });
      });

      dataSource.show = this.noFlyZoneVisible;
      viewer.dataSources.add(dataSource);
      this.noFlyZoneDataSource = dataSource;
      return dataSource;
    })();

    try {
      return await this.noFlyZoneLoadPromise;
    } finally {
      this.noFlyZoneLoadPromise = null;
    }
  }

  private destroyGeoWTFS(): void {
    if (!this.currentGeoWTFS) {
      return;
    }

    try {
      if (typeof this.currentGeoWTFS.destroy === 'function') {
        this.currentGeoWTFS.destroy();
      } else if (typeof this.currentGeoWTFS.remove === 'function') {
        this.currentGeoWTFS.remove();
      }
    } catch (error) {
      console.warn('销毁三维路网实例失败:', error);
    } finally {
      this.currentGeoWTFS = null;
    }
  }

  private syncGeoWTFS(): void {
    const viewer = this.viewer;
    if (!viewer) {
      return;
    }

    this.destroyGeoWTFS();

    const mapType = this.getCurrentToolbarMapType();
    const shouldEnable = !!mapType?.geoWTFS && (mapType.forcePlaceName || this.placeNameVisible);
    if (!shouldEnable || viewer.scene.mode !== Cesium.SceneMode.SCENE3D) {
      return;
    }

    try {
      this.currentGeoWTFS = mapType?.geoWTFS?.(this.getLayerToken(), viewer) || null;
    } catch (error) {
      console.warn('创建三维路网实例失败:', error);
      this.currentGeoWTFS = null;
    }
  }

  private updateToolbarLayerState(): void {
    const toolbarService = this.toolbarService;
    if (!toolbarService) {
      return;
    }

    toolbarService.setLayersService(this.createLayersServiceBridge());

    const handler = toolbarService.getButtonHandler('layers') as any;
    handler?.updateOptions({
      mapTypes: this.getToolbarMapTypes(),
      currentMapType: this.currentMapTypeId,
      isPlaceNameChecked: this.placeNameVisible,
      isNoFlyZoneChecked: this.noFlyZoneVisible,
      token: this.getLayerToken(),
      onMapTypeChange: (mapTypeId: string) => {
        this.setMapType(mapTypeId);
      },
      onPlaceNameToggle: (isChecked: boolean) => {
        this.setPlaceNameVisible(isChecked);
      },
    });
  }

  private createLayersServiceBridge() {
    return {
      setMapType: (mapTypeId: string) => {
        this.setMapType(mapTypeId);
      },
      setPlaceNameVisible: (isChecked: boolean) => {
        this.setPlaceNameVisible(isChecked);
      },
      togglePlaceNameVisibility: () => {
        this.setPlaceNameVisible(!this.placeNameVisible);
      },
      showNoFlyZones: async () => {
        await this.showNoFlyZones();
      },
      hideNoFlyZones: () => {
        this.hideNoFlyZones();
      },
      toggleNoFlyZoneVisibility: () => {
        void this.toggleNoFlyZones();
      },
    };
  }

  private setMapType(mapTypeId: string): void {
    this.currentMapTypeId = mapTypeId;
    const mapType = this.getCurrentToolbarMapType();
    if (mapType?.forcePlaceName) {
      this.placeNameVisible = true;
    }

    switch (this.layersConfig.type) {
      case 'tdt':
        this.updateLayers({
          type: 'tdt',
          tdt: {
            ...(this.layersConfig.tdt || { token: '' }),
            mapTypeId: mapTypeId as 'vec' | 'img' | 'ter',
            token: this.layersConfig.tdt?.token || '',
            showLabel: this.placeNameVisible,
          },
        });
        break;
      case 'gaode':
        this.updateLayers({
          type: 'gaode',
          gaode: {
            ...(this.layersConfig.gaode || {}),
            mapTypeId: mapTypeId as 'vector' | 'satellite' | 'terrain',
            showLabel: this.placeNameVisible,
          },
        });
        break;
      case 'baidu':
        this.updateLayers({
          type: 'baidu',
          baidu: {
            ...(this.layersConfig.baidu || {}),
            mapTypeId: mapTypeId as 'normal' | 'satellite' | 'terrain',
            showLabel: this.placeNameVisible,
          },
        });
        break;
      default:
        break;
    }

    this.syncGeoWTFS();
  }

  private setPlaceNameVisible(isChecked: boolean): void {
    const mapType = this.getCurrentToolbarMapType();
    this.placeNameVisible = mapType?.forcePlaceName ? true : isChecked;

    switch (this.layersConfig.type) {
      case 'tdt':
        this.updateLayers({
          type: 'tdt',
          tdt: {
            ...(this.layersConfig.tdt || { token: '' }),
            mapTypeId: this.currentMapTypeId as 'vec' | 'img' | 'ter',
            token: this.layersConfig.tdt?.token || '',
            showLabel: this.placeNameVisible,
          },
        });
        break;
      case 'gaode':
        this.updateLayers({
          type: 'gaode',
          gaode: {
            ...(this.layersConfig.gaode || {}),
            mapTypeId: (this.layersConfig.gaode?.mapTypeId || 'satellite') as 'vector' | 'satellite' | 'terrain',
            showLabel: this.placeNameVisible,
          },
        });
        break;
      case 'baidu':
        this.updateLayers({
          type: 'baidu',
          baidu: {
            ...(this.layersConfig.baidu || {}),
            mapTypeId: (this.layersConfig.baidu?.mapTypeId || 'satellite') as 'normal' | 'satellite' | 'terrain',
            showLabel: this.placeNameVisible,
          },
        });
        break;
      default:
        break;
    }

    this.syncGeoWTFS();
  }

  private async showNoFlyZones(): Promise<void> {
    this.noFlyZoneVisible = true;
    const dataSource = await this.ensureNoFlyZoneDataSource();
    dataSource.show = true;
    this.updateToolbarLayerState();
  }

  private hideNoFlyZones(): void {
    this.noFlyZoneVisible = false;
    if (this.noFlyZoneDataSource) {
      this.noFlyZoneDataSource.show = false;
    }
    this.updateToolbarLayerState();
  }

  private async toggleNoFlyZones(): Promise<void> {
    if (this.noFlyZoneVisible) {
      this.hideNoFlyZones();
      return;
    }

    await this.showNoFlyZones();
  }

  /**
   * 初始化地图
   */
  async initialize(): Promise<Cesium.Viewer> {
    if (this.isInitialized) {
      return this.viewer!;
    }

    try {
      // 创建地图容器
      const container = document.getElementById(this.containerId);
      if (!container) {
        throw new Error(`找不到 ID 为"${this.containerId}"的容器元素`);
      }
      // 创建 Cesium Viewer
      const viewerOptions: Cesium.Viewer.ConstructorOptions = {
        ...this.viewerOptions,
        animation: this.viewerOptions.animation ?? false,
        timeline: this.viewerOptions.timeline ?? false,
        navigationHelpButton: this.viewerOptions.navigationHelpButton ?? false,
        fullscreenButton: this.viewerOptions.fullscreenButton ?? false,
        geocoder: this.viewerOptions.geocoder ?? false,
        homeButton: this.viewerOptions.homeButton ?? false,
        baseLayerPicker: this.viewerOptions.baseLayerPicker ?? false,
        sceneModePicker: this.viewerOptions.sceneModePicker ?? false,
        infoBox: this.viewerOptions.infoBox ?? false,
        selectionIndicator: this.viewerOptions.selectionIndicator ?? false,
      };

      // 设置 Cesium Ion token
      if (this.cesiumToken) {
        Cesium.Ion.defaultAccessToken = this.cesiumToken;
        // 使用索引签名访问以绕过类型检查（Cesium 某些版本 ConstructorOptions 不包含 accessToken）
        (viewerOptions as any).accessToken = this.cesiumToken;
      }

      this.viewer = new Cesium.Viewer(container, viewerOptions);

      this.sceneModeListenerDispose = this.viewer.scene.morphComplete.addEventListener(() => {
        this.syncGeoWTFS();
      });

      // 隐藏版权信息
      (this.viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

      // 添加地图图层
      await this.addLayers();
      this.syncGeoWTFS();

      // 设置相机视图
      this.setCameraView();

      // 创建服务层
      this.initializeServices();

      this.isInitialized = true;
      console.log('MapPlugin 初始化完成');
      return this.viewer;
    } catch (error) {
      console.error('MapPlugin 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 添加地图图层
   */
  private async addLayers(): Promise<void> {
    if (!this.viewer) return;

    const { type, tdt, gaode, baidu, osm, custom } = this.layersConfig;

    // 清除默认图层
    this.viewer.imageryLayers.removeAll();

    switch (type) {
      case 'tdt':
        this.addTDTLayers(tdt);
        break;
      case 'gaode':
        this.addGaodeLayers(gaode);
        break;
      case 'baidu':
        this.addBaiduLayers(baidu);
        break;
      case 'osm':
        this.addOSMLayers(osm);
        break;
      case 'custom':
        this.addCustomLayers(custom);
        break;
      default:
        // 默认添加天地图影像图层
        this.addTDTLayers(tdt);
    }
  }

  /**
   * 添加天地图图层
   */
  private addTDTLayers(config?: TDTLayerConfig): void {
    if (!this.viewer) return;

    const token = config?.token || '';
    const mapTypeId = config?.mapTypeId || 'img';
    const showLabel = config?.showLabel ?? true;

    let providers: Cesium.ImageryProvider[] = [];

    switch (mapTypeId) {
      case 'vec':
        providers = createTDTVectorConfig(token);
        break;
      case 'img':
        providers = createTDTImageryConfig(token);
        break;
      case 'ter':
        providers = createTDTTerrainConfig(token);
        break;
      default:
        providers = createTDTImageryConfig(token);
    }

    // 如果不显示注记，只添加底图
    if (!showLabel && providers.length > 1) {
      providers = [providers[0]];
    }

    providers.forEach(provider => {
      this.viewer!.imageryLayers.addImageryProvider(provider);
    });
  }

  /**
   * 添加高德地图图层
   */
  private addGaodeLayers(config?: GaodeLayerConfig): void {
    if (!this.viewer) return;

    const token = config?.token;
    const mapTypeId = config?.mapTypeId || 'satellite';
    const showLabel = config?.showLabel ?? true;

    let providers: Cesium.ImageryProvider[] = [];

    switch (mapTypeId) {
      case 'vector':
        providers = createGaodeVectorConfig(token);
        break;
      case 'satellite':
        providers = createGaodeImageryConfig(token);
        break;
      default:
        providers = createGaodeImageryConfig(token);
    }

    // 如果不显示注记，只添加底图
    if (!showLabel && providers.length > 1) {
      providers = [providers[0]];
    }

    providers.forEach(provider => {
      this.viewer!.imageryLayers.addImageryProvider(provider);
    });
  }

  /**
   * 添加百度地图图层
   */
  private addBaiduLayers(config?: BaiduLayerConfig): void {
    if (!this.viewer) return;

    const token = config?.token;
    const mapTypeId = config?.mapTypeId || 'satellite';

    // 目前只提供影像图层
    const providers = createBaiduImageryConfig(token);
    providers.forEach(provider => {
      this.viewer!.imageryLayers.addImageryProvider(provider);
    });
  }

  /**
   * 添加 OSM 图层
   */
  private addOSMLayers(config?: OSMLayerConfig): void {
    if (!this.viewer) return;

    const providers = createOSMConfig();
    providers.forEach(provider => {
      this.viewer!.imageryLayers.addImageryProvider(provider);
    });
  }

  /**
   * 添加自定义图层
   */
  private addCustomLayers(config?: CustomLayerConfig): void {
    if (!this.viewer || !config?.providers) return;

    config.providers.forEach(provider => {
      this.viewer!.imageryLayers.addImageryProvider(provider);
    });
  }

  /**
   * 设置相机视图
   */
  private setCameraView(): void {
    if (!this.viewer) return;

    const { center, pitch, heading, roll } = this.cameraConfig;
    const [longitude, latitude, height] = center;

    this.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
      orientation: {
        heading: Cesium.Math.toRadians(heading || 0),
        pitch: Cesium.Math.toRadians(pitch || -45),
        roll: Cesium.Math.toRadians(roll || 0),
      },
    });
  }
  /**
   * 获取 Cesium Viewer 实例
   */
  getViewer(): Cesium.Viewer | null {
    return this.viewer;
  }

  /**
   * 获取当前配置
   */
  getConfig(): MapPluginOptions {
    return {
      viewerOptions: { ...this.viewerOptions },
      camera: { ...this.cameraConfig },
      layers: { ...this.layersConfig },
      cesiumToken: this.cesiumToken,
      services: { ...this.servicesConfig },
    };
  }

  /**
   * 更新相机配置
   */
  updateCamera(config: Partial<CameraConfig>): void {
    this.cameraConfig = this.mergeCameraConfig(config);
    this.initialCenter = this.toInitialCenter(this.cameraConfig);
    // 如果已初始化，立即应用新配置
    if (this.isInitialized) {
      this.setCameraView();
    }
  }

  /**
   * 更新图层配置
   */
  updateLayers(config: Partial<LayersConfig>): void {
    this.layersConfig = this.mergeLayersConfig(config);
    this.currentMapTypeId = this.resolveCurrentMapTypeId(this.layersConfig);
    const mapType = this.getCurrentToolbarMapType();
    this.placeNameVisible = mapType?.forcePlaceName ? true : this.resolvePlaceNameVisible(this.layersConfig);
    // 如果已初始化，立即应用新配置
    if (this.isInitialized) {
      this.addLayers();
      this.syncGeoWTFS();
    }

    this.updateToolbarLayerState();
  }

  /**
   * 创建 ToolbarService
   */
  createToolbarService(options: ToolbarPluginOptions = {}): ToolbarService {
    if (this.toolbarService) {
      return this.toolbarService;
    }

    const viewer = this.ensureViewer();
    const toolbarOptions: ToolbarServiceOptions = {
      toolbarStyle: {
        ...DEFAULT_TOOLBAR_STYLE,
        ...this.toolbarConfig,
        ...options.config,
      },
      buttonConfigs: options.buttonConfigs,
      searchPanelStyle: options.searchMenu?.panelStyle,
      searchIdleActionIcon: options.searchMenu?.idleActionIcon,
      searchClearActionIcon: options.searchMenu?.clearActionIcon,
      layersPanelStyle: options.layersMenu?.panelStyle,
      useDefaultButtons: options.useDefaultButtons,
    };

    this.toolbarService = new ToolbarService(
      {
        viewer,
        container: this.getToolbarContainer(options),
        drawHelper: this.getDrawService(),
        layers: {
          mapTypes: this.getToolbarMapTypes(),
          currentMapType: this.currentMapTypeId,
          isPlaceNameChecked: this.placeNameVisible,
          token: this.getLayerToken(),
          onMapTypeChange: (mapTypeId: string) => {
            this.setMapType(mapTypeId);
          },
          onPlaceNameToggle: (isChecked: boolean) => {
            this.setPlaceNameVisible(isChecked);
          },
        },
        noFlyZone: {
          isChecked: this.noFlyZoneVisible,
        },
        callbacks: options.callbacks,
      },
      toolbarOptions,
    );

    this.toolbarService.initialize();
    this.toolbarService.setMapController(this.getToolbarController());
    this.toolbarService.setLayersService(this.createLayersServiceBridge());
    return this.toolbarService;
  }

  /**
   * 获取 ToolbarService
   */
  getToolbarService(): ToolbarService | null {
    return this.toolbarService;
  }

  /**
   * 创建 OverlayService
   */
  createOverlayService(options: OverlayPluginOptions = {}): OverlayService {
    if (this.overlayService) {
      return this.overlayService;
    }

    const viewer = this.ensureViewer();
    this.overlayService = new OverlayService(viewer, {
      enableHoverHandler: options.enableHoverHandler,
      clickPickMinIntervalMs: options.clickPickMinIntervalMs,
    });
    return this.overlayService;
  }

  /**
   * 获取 OverlayService
   */
  getOverlayService(): OverlayService {
    return this.overlayService ?? this.createOverlayService();
  }

  /**
   * 创建 DrawService
   */
  createDrawService(_options: DrawPluginOptions = {}): DrawService {
    if (this.drawService) {
      return this.drawService;
    }

    const viewer = this.ensureViewer();
    this.drawService = new DrawService(viewer);
    return this.drawService;
  }

  /**
   * 获取 DrawService
   */
  getDrawService(): DrawService {
    return this.drawService ?? this.createDrawService();
  }

  /**
   * 销毁插件
   */
  destroy(): void {
    this.toolbarService?.destroy();
    this.toolbarService = null;

    this.overlayService?.destroy();
    this.overlayService = null;

    this.drawService?.destroy();
    this.drawService = null;

    this.destroyGeoWTFS();

    if (this.sceneModeListenerDispose) {
      this.sceneModeListenerDispose();
      this.sceneModeListenerDispose = null;
    }

    if (this.viewer) {
      if (this.noFlyZoneDataSource) {
        this.viewer.dataSources.remove(this.noFlyZoneDataSource, true);
        this.noFlyZoneDataSource = null;
      }
      this.viewer.destroy();
      this.viewer = null;
    }

    this.toolbarController = null;
    this.isInitialized = false;
  }

  /**
   * 检查是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized && this.viewer !== null;
  }
}

/**
 * 创建地图插件实例的工厂函数
 * @param containerId 地图容器 ID
 * @param options 地图插件配置选项
 */
export function createMapPlugin(
  containerId: string,
  options?: Partial<MapPluginOptions>,
  toolbarConfig?: ToolbarConfig,
): MapPlugin {
  if (!toolbarConfig) {
    return new MapPlugin(containerId, options);
  }

  const toolbarServiceOptions = typeof options?.services?.toolbar === 'object'
    ? options.services.toolbar
    : {};

  return new MapPlugin(containerId, {
    ...options,
    services: {
      ...options?.services,
      toolbar: {
        ...toolbarServiceOptions,
        enabled: true,
        config: {
          ...toolbarServiceOptions.config,
          ...toolbarConfig,
        },
      },
    },
  });
}