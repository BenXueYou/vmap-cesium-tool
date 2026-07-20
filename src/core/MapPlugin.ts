import * as Cesium from 'cesium';
import { setCesiumCreditVisible } from '../utils/hideCesiumCredit';
import type {
  BaseMapConfig,
  MapAuthConfig,
  CameraConfig,
  DrawPluginOptions,
  GaodeLayerConfig,
  BaiduLayerConfig,
  CustomLayerConfig,
  LayersConfig,
  MapType,
  MapPluginOptions,
  MapPluginServicesOptions,
  NoFlyZonePluginOptions,
  OSMLayerConfig,
  OverlayPluginOptions,
  TDTLayerConfig,
  ToolbarLayersMenuOptions,
  ToolbarConfig,
  ToolbarPluginOptions,
  ProviderSearchOptions,
  CreditsOptions,
} from './types';
import { 
  DEFAULT_CAMERA_CONFIG,
  DEFAULT_PROVIDER_TYPE,
} from './constants';
import { DEFAULT_TOOLBAR_STYLE, withDefaultMapTypeThumbnails } from './services/toolbar/config';
import { OverlayService } from './services/overlay/OverlayService';
import { DrawService } from './services/draw/DrawService';
import { ToolbarService } from './services/toolbar/ToolbarService';
import type { ToolbarServiceOptions } from './services/toolbar/ToolbarService';
import type { ToolbarCallbacks } from './services/toolbar/types';
import { ensureTDT3DExtensionLoaded } from './layers/TDTMapLayer';
import { createTDT3DTerrainProvider, createTDT3DImageryConfig, createTDTImageryConfig, createTDTTerrainConfig, createTDTVectorConfig } from './layers/TDTMapLayer';
import { createGaodeImageryConfig, createGaodeVectorConfig } from './layers/GaodeMapLayer';
import { createBaiduImageryConfig } from './layers/BaiduMapLayer';
import { createOSMConfig } from './layers/OSMMapLayer';
import { loadAllAirportNoFlyZones, geojsonCoordinatesToCartesian3 } from '../utils/geojson';
import {
  baseMapRegistry,
  buildDefaultBaseMap,
  mapTypeIdToBaseMapConfig,
  normalizeProviderId,
  resolveMapTypeId,
} from './mapProviders/registry';
import { coordinateService } from './mapProviders/coordinates/CoordinateService';
import { normalizeMapAuth, ProviderSearchService } from './mapProviders/ProviderSearchService';

interface InitialCenter {
  longitude: number;
  latitude: number;
  height: number;
}

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

class PluginMapController {
  private callbacks?: Pick<ToolbarCallbacks, 'onZoomIn' | 'onZoomOut' | 'onFullscreenChange' | 'onResetLocation'>;

  constructor(
    private readonly viewer: Cesium.Viewer,
    private readonly getInitialCenter: () => InitialCenter,
    private readonly setInitialCenter: (center: InitialCenter) => void,
    callbacks?: Pick<ToolbarCallbacks, 'onZoomIn' | 'onZoomOut' | 'onFullscreenChange' | 'onResetLocation'>,
  ) {
    this.callbacks = callbacks;
  }

  setCallbacks(
    callbacks?: Pick<ToolbarCallbacks, 'onZoomIn' | 'onZoomOut' | 'onFullscreenChange' | 'onResetLocation'>,
  ): void {
    this.callbacks = callbacks;
  }

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
    this.callbacks?.onResetLocation?.();
  }

  zoomIn(): void {
    const beforeHeight = this.viewer.camera.positionCartographic.height || 1000;
    this.viewer.camera.zoomIn(Math.max(beforeHeight * 0.5, 100));
    const afterHeight = this.viewer.camera.positionCartographic.height || 0;
    this.callbacks?.onZoomIn?.(beforeHeight, afterHeight);
  }

  zoomOut(): void {
    const beforeHeight = this.viewer.camera.positionCartographic.height || 1000;
    this.viewer.camera.zoomOut(Math.max(beforeHeight * 0.5, 100));
    const afterHeight = this.viewer.camera.positionCartographic.height || 0;
    this.callbacks?.onZoomOut?.(beforeHeight, afterHeight);
  }

  toggleFullscreen(): void {
    const container = this.viewer.container as HTMLElement;
    const willEnterFullscreen = !document.fullscreenElement;
    if (willEnterFullscreen) {
      void container.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
    this.callbacks?.onFullscreenChange?.(willEnterFullscreen);
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
  private baseMapConfig: BaseMapConfig;
  private mapAuthConfig: MapAuthConfig | undefined;
  private providerSearchConfig: ProviderSearchOptions;
  private creditsConfig: CreditsOptions;
  private cesiumToken: string;
  
  // 工具栏和样式配置
  private toolbarConfig: ToolbarConfig;
  private toolbarLayersMenuConfig: ToolbarLayersMenuOptions;
  private servicesConfig: MapPluginServicesOptions;
  private noFlyZoneConfig: NoFlyZonePluginOptions;
  private initialCenter: InitialCenter;
  private toolbarController: PluginMapController | null = null;
  private toolbarMapTypes: MapType[];
  private currentMapTypeId: string;
  private placeNameVisible: boolean;
  private nonForcedPlaceNameVisible: boolean;
  private noFlyZoneVisible = false;
  private noFlyZoneDataSource: Cesium.CustomDataSource | null = null;
  private noFlyZoneLoadPromise: Promise<Cesium.CustomDataSource> | null = null;
  private currentGeoWTFS: any = null;
  private sceneModeListenerDispose: (() => void) | null = null;
  private offlineCleanup: (() => void) | null = null;
  private layerRequestVersion = 0;

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
    this.baseMapConfig = this.resolveBaseMapConfig(options);
    this.mapAuthConfig = normalizeMapAuth(options.mapAuth);
    this.providerSearchConfig = options.providerSearch || {};
    this.creditsConfig = { visible: true, ...(options.credits || {}) };
    this.cesiumToken = options.cesiumToken || '';
    this.servicesConfig = options.services || {};
    this.toolbarLayersMenuConfig = this.getToolbarLayersMenuConfig(options.services?.toolbar);
    this.noFlyZoneConfig = this.resolveNoFlyZoneConfig(options.noFlyZone);
    this.initialCenter = this.toInitialCenter(this.cameraConfig);
    this.toolbarMapTypes = withDefaultMapTypeThumbnails(
      this.toolbarLayersMenuConfig.mapTypes
        || baseMapRegistry.getMapTypes(this.baseMapConfig, this.mapAuthConfig),
    );
    this.currentMapTypeId = this.resolveCurrentMapTypeId();
    this.nonForcedPlaceNameVisible = this.toolbarLayersMenuConfig.defaultPlaceNameChecked
      ?? this.resolvePlaceNameVisible();
    this.placeNameVisible = this.getCurrentToolbarMapType()?.forcePlaceName
      ? true
      : this.nonForcedPlaceNameVisible;
    this.noFlyZoneVisible = this.noFlyZoneConfig.visible ?? false;
    
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

  private resolveNoFlyZoneConfig(noFlyZoneOptions?: NoFlyZonePluginOptions): NoFlyZonePluginOptions {
    let visible = noFlyZoneOptions?.visible ?? this.toolbarLayersMenuConfig.defaultNoFlyZoneChecked ?? false;
    let autoLoad = noFlyZoneOptions?.autoLoad ?? visible;

    if (visible) {
      autoLoad = true;
    }

    if (autoLoad) {
      visible = true;
    }

    return {
      extrudedHeight: noFlyZoneOptions?.extrudedHeight ?? 1000,
      ...noFlyZoneOptions,
      visible,
      autoLoad,
    };
  }

  private toInitialCenter(cameraConfig: CameraConfig): InitialCenter {
    const point = coordinateService.toWGS84({
      longitude: cameraConfig.center[0],
      latitude: cameraConfig.center[1],
      height: cameraConfig.center[2],
    }, cameraConfig.coordSystem || 'WGS84');
    return {
      longitude: point.longitude,
      latitude: point.latitude,
      height: point.height ?? cameraConfig.center[2],
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
        undefined,
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
      tencent: config?.tencent,
      google: config?.google,
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
        sk: '',
        showLabel: true,
      };
    }

    return result;
  }

  private resolveBaseMapConfig(options: Partial<MapPluginOptions>): BaseMapConfig {
    if (options.baseMap) {
      const provider = normalizeProviderId(options.baseMap.provider);
      return {
        ...buildDefaultBaseMap(provider),
        ...options.baseMap,
        provider,
      };
    }

    const layers = this.mergeLayersConfig(options.layers);
    switch (layers.type) {
      case 'gaode':
        return {
          provider: 'gaode',
          type: layers.gaode?.mapTypeId || 'satellite',
          key: layers.gaode?.token,
          sk: layers.gaode?.sk,
          showLabel: layers.gaode?.showLabel ?? true,
        };
      case 'tencent':
        return {
          provider: 'tencent',
          type: layers.tencent?.mapTypeId || 'satellite',
          key: layers.tencent?.key || layers.tencent?.token,
          showLabel: layers.tencent?.showLabel ?? true,
        };
      case 'google':
        return {
          provider: 'google',
          type: layers.google?.mapTypeId || 'roadmap',
          key: layers.google?.apiKey || layers.google?.key || layers.google?.token,
          showLabel: layers.google?.showLabel ?? false,
        };
      case 'baidu':
        return {
          provider: 'baidu',
          type: layers.baidu?.mapTypeId || 'satellite',
          ak: layers.baidu?.token,
          sk: layers.baidu?.sk,
          showLabel: layers.baidu?.showLabel ?? true,
        };
      case 'custom':
        return {
          provider: 'custom',
          type: layers.custom?.type || 'imageryProviders',
          mode: layers.custom?.mode || 'online',
          providers: layers.custom?.providers,
          customUrl: layers.custom?.customUrl,
          urlTemplate: layers.custom?.urlTemplate,
          rectangle: layers.custom?.rectangle,
          minimumLevel: layers.custom?.minimumLevel,
          maximumLevel: layers.custom?.maximumLevel,
          credit: layers.custom?.credit,
          cameraBounds: layers.custom?.cameraBounds,
          wmtsLayer: layers.custom?.wmtsLayer,
          wmtsStyle: layers.custom?.wmtsStyle,
          wmtsFormat: layers.custom?.wmtsFormat,
          tileMatrixSetId: layers.custom?.tileMatrixSetId,
          showLabel: false,
        };
      default:
        return {
          provider: 'tdt',
          type: layers.tdt?.mapTypeId || 'img',
          token: layers.tdt?.token,
          sk: layers.tdt?.sk,
          showLabel: layers.tdt?.showLabel ?? true,
        };
    }
  }

  private resolveCurrentMapTypeId(): string {
    return resolveMapTypeId(this.baseMapConfig);
  }

  private resolvePlaceNameVisible(): boolean {
    return this.baseMapConfig.showLabel ?? false;
  }

  private getToolbarMapTypes() {
    return this.toolbarMapTypes;
  }

  private getCurrentToolbarMapType(): MapType | undefined {
    return this.toolbarMapTypes.find((mapType) => mapType.id === this.currentMapTypeId);
  }

  private getLayerToken(): string {
    switch (this.baseMapConfig.provider) {
      case 'tdt':
        return this.baseMapConfig.token || this.mapAuthConfig?.tdt?.token || '';
      case 'gaode':
        return this.baseMapConfig.key || this.mapAuthConfig?.gaode?.key || '';
      case 'tencent':
        return this.baseMapConfig.key || this.mapAuthConfig?.tencent?.key || '';
      case 'baidu':
        return this.baseMapConfig.ak || this.mapAuthConfig?.baidu?.ak || '';
      case 'google':
        return this.baseMapConfig.key || this.mapAuthConfig?.google?.apiKey || '';
      default:
        return this.baseMapConfig.token || this.baseMapConfig.key || '';
    }
  }

  private getLayerSk(): string {
    return this.baseMapConfig.sk || this.mapAuthConfig?.tdt?.sk || '';
  }

  private resetTerrainProvider(): void {
    if (!this.viewer) {
      return;
    }

    this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
  }

  private applyTerrainProvider(terrainProvider?: Cesium.TerrainProvider | null): void {
    if (!this.viewer) {
      return;
    }

    this.viewer.terrainProvider = terrainProvider ?? new Cesium.EllipsoidTerrainProvider();
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
            extrudedHeight: this.noFlyZoneConfig.extrudedHeight ?? 1000,
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

  private async syncGeoWTFS(): Promise<void> {
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

    if (this.currentMapTypeId === 'tdt3d') {
      await ensureTDT3DExtensionLoaded();
    }

    try {
      this.currentGeoWTFS = mapType?.geoWTFS?.(this.getLayerToken(), viewer, this.getLayerSk()) || null;
    } catch (error) {
      console.warn('创建三维路网实例失败:', error);
      this.currentGeoWTFS = null;
    }
  }

  private async refreshLayersAndGeoWTFS(): Promise<void> {
    await this.addLayers();
    await this.syncGeoWTFS();
    this.syncCreditDisplay();
  }

  private syncCreditDisplay(): void {
    if (!this.viewer) {
      return;
    }

    setCesiumCreditVisible(this.viewer, this.creditsConfig.visible !== false);
  }

  private clearOfflineConstraints(): void {
    this.offlineCleanup?.();
    this.offlineCleanup = null;
  }

  private applyOfflineConstraints(): void {
    this.clearOfflineConstraints();
    if (!this.viewer || this.baseMapConfig.provider !== 'custom' || this.baseMapConfig.mode !== 'offline' || !this.baseMapConfig.rectangle) {
      return;
    }

    const viewer = this.viewer;
    const rectangle = Cesium.Rectangle.fromDegrees(
      this.baseMapConfig.rectangle.west,
      this.baseMapConfig.rectangle.south,
      this.baseMapConfig.rectangle.east,
      this.baseMapConfig.rectangle.north,
    );
    const cameraBounds = this.baseMapConfig.cameraBounds || {};
    const controller = viewer.scene.screenSpaceCameraController;
    const previousLimit = viewer.scene.globe.cartographicLimitRectangle;
    const previousTilt = controller.enableTilt;
    const previousMin = controller.minimumZoomDistance;
    const previousMax = controller.maximumZoomDistance;

    viewer.scene.globe.cartographicLimitRectangle = rectangle;
    controller.enableTilt = cameraBounds.enableTilt ?? false;
    controller.minimumZoomDistance = cameraBounds.minimumZoomDistance ?? 50;
    controller.maximumZoomDistance = cameraBounds.maximumZoomDistance ?? 1000000;

    const clampCamera = () => {
      const position = viewer.camera.positionCartographic;
      const longitude = Cesium.Math.clamp(position.longitude, rectangle.west, rectangle.east);
      const latitude = Cesium.Math.clamp(position.latitude, rectangle.south, rectangle.north);
      if (longitude !== position.longitude || latitude !== position.latitude) {
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromRadians(longitude, latitude, position.height),
        });
      }
    };

    const moveEndHandler = viewer.camera.moveEnd.addEventListener(clampCamera);
    if (cameraBounds.initialFlyTo !== false) {
      const centerLongitude = Cesium.Math.toDegrees((rectangle.west + rectangle.east) / 2);
      const centerLatitude = Cesium.Math.toDegrees((rectangle.south + rectangle.north) / 2);
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          centerLongitude,
          centerLatitude,
          cameraBounds.initialHeight ?? this.initialCenter.height,
        ),
        duration: 0,
      });
    }

    this.offlineCleanup = () => {
      moveEndHandler();
      viewer.scene.globe.cartographicLimitRectangle = previousLimit;
      controller.enableTilt = previousTilt;
      controller.minimumZoomDistance = previousMin;
      controller.maximumZoomDistance = previousMax;
    };
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
        void this.setMapType(mapTypeId);
      },
      onPlaceNameToggle: (isChecked: boolean) => {
        void this.setPlaceNameVisible(isChecked);
      },
    });
  }

  private createLayersServiceBridge(): LayersServiceBridge {
    return {
      setMapType: (mapTypeId: string) => {
        void this.setMapType(mapTypeId);
      },
      setPlaceNameVisible: (isChecked: boolean) => {
        void this.setPlaceNameVisible(isChecked);
      },
      togglePlaceNameVisibility: () => {
        void this.setPlaceNameVisible(!this.placeNameVisible);
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
      toggleNoFlyZones: async () => {
        await this.toggleNoFlyZones();
      },
      getNoFlyZoneVisible: () => this.getNoFlyZoneVisible(),
    };
  }

  private syncOfflineToolbarState(): void {
    if (!this.toolbarService) {
      return;
    }

    const isOffline = this.baseMapConfig.provider === 'custom' && this.baseMapConfig.mode === 'offline';
    if (isOffline) {
      this.toolbarService.hideButton('search');
      this.toolbarService.hideButton('layers');
      return;
    }

    this.toolbarService.showButton('search');
    this.toolbarService.showButton('layers');
  }

  private async setMapType(mapTypeId: string): Promise<void> {
    this.currentMapTypeId = mapTypeId;
    const nextBaseMap = mapTypeIdToBaseMapConfig(mapTypeId, this.baseMapConfig);
    const mapType = this.toolbarMapTypes.find((item) => item.id === mapTypeId);
    this.baseMapConfig = {
      ...this.baseMapConfig,
      ...nextBaseMap,
      showLabel: mapType?.forcePlaceName ? true : this.nonForcedPlaceNameVisible,
    };
    this.placeNameVisible = this.baseMapConfig.showLabel ?? false;
    await this.refreshLayersAndGeoWTFS();
    this.updateToolbarLayerState();
  }

  private async setPlaceNameVisible(isChecked: boolean): Promise<void> {
    const mapType = this.getCurrentToolbarMapType();
    if (mapType?.forcePlaceName) {
      this.placeNameVisible = true;
    } else {
      this.placeNameVisible = isChecked;
      this.nonForcedPlaceNameVisible = isChecked;
    }
    this.baseMapConfig = {
      ...this.baseMapConfig,
      showLabel: this.placeNameVisible,
    };
    await this.refreshLayersAndGeoWTFS();
    this.updateToolbarLayerState();
  }

  public async showNoFlyZones(): Promise<void> {
    this.noFlyZoneVisible = true;
    const dataSource = await this.ensureNoFlyZoneDataSource();
    dataSource.show = true;
    this.updateToolbarLayerState();
  }

  public hideNoFlyZones(): void {
    this.noFlyZoneVisible = false;
    if (this.noFlyZoneDataSource) {
      this.noFlyZoneDataSource.show = false;
    }
    this.updateToolbarLayerState();
  }

  public async toggleNoFlyZones(): Promise<void> {
    if (this.noFlyZoneVisible) {
      this.hideNoFlyZones();
      return;
    }

    await this.showNoFlyZones();
  }

  public getNoFlyZoneVisible(): boolean {
    return this.noFlyZoneVisible;
  }

  public getLayersServiceBridge(): LayersServiceBridge {
    return this.createLayersServiceBridge();
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
      this.viewer.scene.globe.enableLighting = true // 启用地形光照
      this.sceneModeListenerDispose = this.viewer.scene.morphComplete.addEventListener(() => {
        void this.syncGeoWTFS();
      });

      // 添加地图图层
      await this.addLayers();
      await this.syncGeoWTFS();
      this.syncCreditDisplay();

      // 设置相机视图
      this.setCameraView();

      // 创建服务层
      this.initializeServices();

      if (this.noFlyZoneConfig.autoLoad) {
        await this.showNoFlyZones();
      }

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
    const requestVersion = ++this.layerRequestVersion;
    const mapType = baseMapRegistry.getMapTypeById(
      this.currentMapTypeId,
      this.baseMapConfig,
      this.mapAuthConfig,
      this.viewer,
    ) || baseMapRegistry.getMapTypes(this.baseMapConfig, this.mapAuthConfig, this.viewer)[0];

    if (!mapType) {
      throw new Error(`未找到可用地图类型: ${this.currentMapTypeId}`);
    }

    if (mapType.id === 'tdt3d') {
      await ensureTDT3DExtensionLoaded();
    }

    const context = {
      viewer: this.viewer,
      baseMap: this.baseMapConfig,
      auth: this.mapAuthConfig,
    };
    const providers = await Promise.resolve(mapType.provider(context));
    const terrainProvider = mapType.terrainProvider
      ? await Promise.resolve(mapType.terrainProvider(context))
      : null;

    if (requestVersion !== this.layerRequestVersion || !this.viewer) {
      return;
    }

    this.viewer.imageryLayers.removeAll();
    providers
      .slice(0, this.placeNameVisible ? providers.length : 1)
      .forEach((provider) => {
        this.viewer!.imageryLayers.addImageryProvider(provider);
      });
    this.applyTerrainProvider(terrainProvider);
    this.applyOfflineConstraints();
    this.syncCreditDisplay();
  }

  /**
   * 添加天地图图层
   */
  private async addTDTLayers(config?: TDTLayerConfig): Promise<void> {
    if (!this.viewer) return;

    const token = config?.token || '';
    const sk = config?.sk || '';
    const mapTypeId = config?.mapTypeId || 'img';
    const showLabel = config?.showLabel ?? true;
    const mapType = this.getCurrentToolbarMapType();

    let providers: Cesium.ImageryProvider[] = [];

    switch (mapTypeId) {
      case 'vec':
        providers = createTDTVectorConfig(token, sk);
        break;
      case 'img':
        providers = createTDTImageryConfig(token, sk);
        break;
      case 'ter':
        providers = createTDTTerrainConfig(token, sk);
        break;
      case 'tdt3d':
        providers = createTDT3DImageryConfig(token, sk);
        break;
      default:
        providers = createTDTImageryConfig(token, sk);
    }

    if (mapTypeId === 'tdt3d') {
      await ensureTDT3DExtensionLoaded();
    }

    const terrainProvider = mapTypeId === 'tdt3d'
      ? createTDT3DTerrainProvider(token, sk)
      : await Promise.resolve(
        mapType?.terrainProvider
          ? mapType.terrainProvider({
            viewer: this.viewer,
            baseMap: this.baseMapConfig,
            auth: this.mapAuthConfig,
          })
          : null,
      );

    this.applyTerrainProvider(terrainProvider);

    if (mapTypeId === 'tdt3d' && this.viewer.scene.mode !== Cesium.SceneMode.SCENE3D) {
      this.viewer.scene.morphTo3D(0);
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
    const point = coordinateService.toWGS84({
      longitude,
      latitude,
      height,
    }, this.cameraConfig.coordSystem || 'WGS84');

    this.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, point.height ?? height),
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
      baseMap: { ...this.baseMapConfig },
      mapAuth: this.mapAuthConfig ? { ...this.mapAuthConfig } : undefined,
      providerSearch: { ...this.providerSearchConfig },
      credits: { ...this.creditsConfig },
      cesiumToken: this.cesiumToken,
      noFlyZone: { ...this.noFlyZoneConfig },
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
    this.baseMapConfig = this.resolveBaseMapConfig({
      layers: this.layersConfig,
      mapAuth: this.mapAuthConfig,
    });
    this.currentMapTypeId = this.resolveCurrentMapTypeId();
    const mapType = this.getCurrentToolbarMapType();
    const isForcedMapType = !!mapType?.forcePlaceName;
    const resolvedPlaceNameVisible = this.resolvePlaceNameVisible();

    if (!isForcedMapType) {
      this.nonForcedPlaceNameVisible = resolvedPlaceNameVisible;
    }

    this.placeNameVisible = isForcedMapType ? true : resolvedPlaceNameVisible;

    // 如果已初始化，立即应用新配置
    if (this.isInitialized) {
      void this.refreshLayersAndGeoWTFS();
    }

    this.updateToolbarLayerState();
    this.syncOfflineToolbarState();
  }

  updateBaseMap(baseMap: Partial<BaseMapConfig>): void {
    this.baseMapConfig = {
      ...this.baseMapConfig,
      ...baseMap,
      provider: normalizeProviderId(baseMap.provider || this.baseMapConfig.provider),
    };
    this.currentMapTypeId = this.resolveCurrentMapTypeId();
    this.placeNameVisible = this.resolvePlaceNameVisible();
    if (this.isInitialized) {
      void this.refreshLayersAndGeoWTFS();
    }
    this.updateToolbarLayerState();
    this.syncOfflineToolbarState();
  }

  updateMapAuth(mapAuth: MapAuthConfig): void {
    const normalized = normalizeMapAuth(mapAuth) || {};
    const nextAuth = { ...(this.mapAuthConfig || {}) };
    (['tdt', 'gaode', 'tencent', 'baidu', 'google'] as const).forEach((provider) => {
      if (normalized[provider] !== undefined) {
        (nextAuth as any)[provider] = normalized[provider];
      }
    });
    this.mapAuthConfig = nextAuth;

    const currentProvider = this.baseMapConfig.provider;
    const affectsCurrentProvider = currentProvider !== 'custom'
      && normalized[currentProvider] !== undefined;
    if (this.isInitialized && affectsCurrentProvider) {
      void this.refreshLayersAndGeoWTFS();
    }
    this.updateToolbarLayerState();
  }

  /** 替换全部厂商鉴权，适合单一当前服务商配置。 */
  setMapAuth(mapAuth: MapAuthConfig): void {
    this.mapAuthConfig = normalizeMapAuth(mapAuth);
    if (this.isInitialized) void this.refreshLayersAndGeoWTFS();
    this.updateToolbarLayerState();
  }

  /** 运行时更新 Cesium credit/版权区域显示状态。 */
  updateCredits(credits: CreditsOptions): void {
    this.creditsConfig = { ...this.creditsConfig, ...credits };
    this.syncCreditDisplay();
  }

  /**
   * 创建 ToolbarService
   */
  createToolbarService(options: ToolbarPluginOptions = {}): ToolbarService {
    if (this.toolbarService) {
      return this.toolbarService;
    }

    const viewer = this.ensureViewer();
    const callbacks: ToolbarCallbacks = { ...(options.callbacks || {}) };
    if (!callbacks.onSearch && this.providerSearchConfig.enabled) {
      const providerSearchService = new ProviderSearchService(this.providerSearchConfig);
      callbacks.onSearch = (query: string) => providerSearchService.search(query, this.baseMapConfig, this.mapAuthConfig);
    }
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
        i18n: options.config?.i18n,
        useI18n: options.config?.useI18n,
        drawHelper: this.getDrawService(),
        layers: {
          mapTypes: this.getToolbarMapTypes(),
          currentMapType: this.currentMapTypeId,
          isPlaceNameChecked: this.placeNameVisible,
          token: this.getLayerToken(),
          onMapTypeChange: (mapTypeId: string) => {
            void this.setMapType(mapTypeId);
          },
          onPlaceNameToggle: (isChecked: boolean) => {
            void this.setPlaceNameVisible(isChecked);
          },
        },
        noFlyZone: {
          isChecked: this.noFlyZoneVisible,
        },
        callbacks,
      },
      toolbarOptions,
    );

    this.getToolbarController().setCallbacks({
      onZoomIn: callbacks.onZoomIn,
      onZoomOut: callbacks.onZoomOut,
      onFullscreenChange: callbacks.onFullscreenChange,
      onResetLocation: callbacks.onResetLocation,
    });
    this.toolbarService.initialize();
    this.toolbarService.setMapController(this.getToolbarController());
    this.toolbarService.setLayersService(this.createLayersServiceBridge());
    this.syncOfflineToolbarState();
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
  createDrawService(options: DrawPluginOptions = {}): DrawService {
    if (this.drawService) {
      return this.drawService;
    }

    const viewer = this.ensureViewer();
    this.drawService = new DrawService(viewer, {
      i18n: options.i18n,
      useI18n: options.useI18n,
    });
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
    this.clearOfflineConstraints();

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
