import * as Cesium from 'cesium';
import { setCesiumCreditVisible } from '../utils/hideCesiumCredit';
import { zoomLevelToHeight } from '../utils/common';
import { MapConfigHint } from '../components/MapConfigHint';
import { i18n as defaultI18n, type I18nLike } from '../i18n';
import type {
  BaseMapConfig,
  MapAuthConfig,
  CameraConfig,
  DrawPluginOptions,
  GaodeLayerConfig,
  BaiduLayerConfig,
  CustomLayerConfig,
  LayersConfig,
  MapServiceConfig,
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
  MapSearchResult,
  SearchResult,
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
import {
  MapServiceConfigError,
  normalizeMapServiceConfig,
  resolveConfiguredMapService,
  resolveLegacyMapService,
  type ResolvedMapService,
} from './mapProviders/mapService';
import type {
  MapServiceProvider,
  MapServiceUpdateResult,
  MapServiceValidationCode,
  MapServiceValidationResult,
  OnlineMapServiceProvider,
} from './mapProviders/types';
import {
  getDefaultMapServiceSearchCapability,
  validateMapService,
} from './mapProviders/validation';

const MAP_SERVICE_SEARCH_META = Symbol('mapServiceSearchMeta');

type SearchResultWithMapServiceMeta = SearchResult & {
  [MAP_SERVICE_SEARCH_META]?: {
    generation: number;
    provider: OnlineMapServiceProvider;
  };
};

interface ResolvedMapRuntimeState {
  mapConfigMode: 'legacy' | 'mapService';
  mapServiceConfig?: MapServiceConfig;
  mapService: ResolvedMapService;
  baseMapConfig: BaseMapConfig;
  mapAuthConfig: MapAuthConfig | undefined;
  layersConfig: LayersConfig;
  toolbarMapTypes: MapType[];
  currentMapTypeId: string;
  placeNameVisible: boolean;
  nonForcedPlaceNameVisible: boolean;
}

interface PreparedMapServiceSwitch {
  runtimeState: ResolvedMapRuntimeState;
  providers: Cesium.ImageryProvider[];
  terrainProvider: Cesium.TerrainProvider | null;
}

interface ViewerLayerSnapshot {
  imageryProviders: Cesium.ImageryProvider[];
  terrainProvider: Cesium.TerrainProvider;
}

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
    const requestedAmount = Math.max(beforeHeight * 0.5, 100);
    const minimumDistance = this.viewer.scene.screenSpaceCameraController.minimumZoomDistance;
    this.viewer.camera.zoomIn(Math.min(requestedAmount, Math.max(0, beforeHeight - minimumDistance)));
    const afterHeight = this.viewer.camera.positionCartographic.height || 0;
    this.callbacks?.onZoomIn?.(beforeHeight, afterHeight);
  }

  zoomOut(): void {
    const beforeHeight = this.viewer.camera.positionCartographic.height || 1000;
    const requestedAmount = Math.max(beforeHeight * 0.5, 100);
    const maximumDistance = this.viewer.scene.screenSpaceCameraController.maximumZoomDistance;
    this.viewer.camera.zoomOut(Math.min(requestedAmount, Math.max(0, maximumDistance - beforeHeight)));
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
  private static readonly LEGACY_MAP_SERVICE_FIELDS: ReadonlyArray<keyof MapPluginOptions> = [
    'layers',
    'baseMap',
    'mapAuth',
  ];

  private viewer: Cesium.Viewer | null = null;
  private containerId: string;
  
  // 分层配置
  private viewerOptions: Cesium.Viewer.ConstructorOptions;
  private cameraConfig: CameraConfig;
  private layersConfig!: LayersConfig;
  private baseMapConfig!: BaseMapConfig;
  private mapAuthConfig: MapAuthConfig | undefined;
  private mapService!: ResolvedMapService;
  private mapServiceConfig: MapServiceConfig | undefined;
  private mapConfigMode: 'legacy' | 'mapService' = 'legacy';
  private providerSearchConfig: ProviderSearchOptions;
  private onSearchResultSelected?: (result: MapSearchResult) => void;
  private creditsConfig: CreditsOptions;
  private fxaa: boolean;
  private cesiumToken: string;
  private readonly mapConfigI18n: I18nLike;
  private mapConfigHint: MapConfigHint | null = null;
  private mapConfigHintContainer: HTMLElement | null = null;
  private mapConfigHintPreviousPosition = '';
  
  // 工具栏和样式配置
  private toolbarConfig: ToolbarConfig;
  private toolbarLayersMenuConfig: ToolbarLayersMenuOptions;
  private servicesConfig: MapPluginServicesOptions;
  private noFlyZoneConfig: NoFlyZonePluginOptions;
  private initialCenter: InitialCenter;
  private toolbarController: PluginMapController | null = null;
  private toolbarMapTypes!: MapType[];
  private currentMapTypeId!: string;
  private placeNameVisible!: boolean;
  private nonForcedPlaceNameVisible!: boolean;
  private noFlyZoneVisible = false;
  private noFlyZoneDataSource: Cesium.CustomDataSource | null = null;
  private noFlyZoneLoadPromise: Promise<Cesium.CustomDataSource> | null = null;
  private currentGeoWTFS: any = null;
  private sceneModeListenerDispose: (() => void) | null = null;
  private offlineCleanup: (() => void) | null = null;
  private layerRequestVersion = 0;
  private mapServiceSearchGeneration = 0;

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
    this.servicesConfig = options.services || {};
    this.toolbarLayersMenuConfig = this.getToolbarLayersMenuConfig(options.services?.toolbar);

    if (options.mapService) {
      this.assertNoMixedMapServiceConfig(options);
      const normalizedMapService = normalizeMapServiceConfig(options.mapService);
      this.applyResolvedMapService(
        resolveConfiguredMapService(normalizedMapService),
        'mapService',
        normalizedMapService,
      );
    } else {
      this.applyResolvedMapService(
        resolveLegacyMapService({
          baseMap: this.resolveBaseMapConfig(options),
          mapAuth: normalizeMapAuth(options.mapAuth),
        }),
        'legacy',
      );
    }

    this.providerSearchConfig = options.providerSearch || {};
    this.onSearchResultSelected = options.onSearchResultSelected;
    this.creditsConfig = { visible: false, ...(options.credits || {}) };
    this.fxaa = options.fxaa ?? true;
    this.cesiumToken = options.cesiumToken || '';
    const toolbarOptions = options.services?.toolbar;
    const toolbarI18n = typeof toolbarOptions === 'object' ? toolbarOptions.config?.i18n : undefined;
    this.mapConfigI18n = options.i18n ?? toolbarI18n ?? defaultI18n;
    this.noFlyZoneConfig = this.resolveNoFlyZoneConfig(options.noFlyZone);
    this.initialCenter = this.toInitialCenter(this.cameraConfig);
    this.noFlyZoneVisible = this.noFlyZoneConfig.visible ?? false;
    
    // 工具栏和样式配置（保持向后兼容）
    this.toolbarConfig = this.resolveToolbarConfig(options.services?.toolbar);
  }

  private assertNoMixedMapServiceConfig(options: Partial<MapPluginOptions>): void {
    const mixedFields = MapPlugin.LEGACY_MAP_SERVICE_FIELDS.filter((field) => options[field] !== undefined);
    if (!mixedFields.length) {
      return;
    }

    throw new MapServiceConfigError(
      `mapService 不能与旧配置同时使用: ${mixedFields.join(', ')}`,
    );
  }

  private resolveToolbarConfig(toolbarOptions?: boolean | ToolbarPluginOptions): ToolbarConfig {
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

  private applyToolbarConfigPatch(config: Partial<ToolbarConfig>): void {
    this.toolbarConfig = {
      ...this.toolbarConfig,
      ...config,
    };

    if (typeof this.servicesConfig.toolbar === 'object') {
      this.servicesConfig.toolbar = {
        ...this.servicesConfig.toolbar,
        config: {
          ...(this.servicesConfig.toolbar.config || {}),
          ...config,
        },
      };
    }
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
    const merged = {
      ...DEFAULT_CAMERA_CONFIG,
      ...config,
    };
    const { minZoomLevel, maxZoomLevel } = merged;
    if (!Number.isFinite(minZoomLevel) || !Number.isFinite(maxZoomLevel) || minZoomLevel! < 1 || maxZoomLevel! < 1 || minZoomLevel! > maxZoomLevel!) {
      throw new RangeError('camera.minZoomLevel 和 camera.maxZoomLevel 必须是大于等于 1 的数字，且 minZoomLevel 不得大于 maxZoomLevel');
    }
    return merged;
  }

  /**
   * 将组件的逻辑缩放级别转换为 Cesium 相机交互距离。
   * 仅作用于 ScreenSpaceCameraController，不拦截业务方直接调用 camera.flyTo/setView。
   */
  private applyCameraZoomConstraints(): void {
    if (!this.viewer) return;

    const controller = this.viewer.scene.screenSpaceCameraController;
    const minZoomLevel = this.cameraConfig.minZoomLevel ?? DEFAULT_CAMERA_CONFIG.minZoomLevel;
    const maxZoomLevel = this.cameraConfig.maxZoomLevel ?? DEFAULT_CAMERA_CONFIG.maxZoomLevel;
    let minimumZoomDistance = zoomLevelToHeight(maxZoomLevel);
    let maximumZoomDistance = zoomLevelToHeight(minZoomLevel);

    // 离线地图已有相机距离约束时，取二者交集，避免新默认值放宽离线地图边界。
    if (this.baseMapConfig?.provider === 'custom' && this.baseMapConfig.mode === 'offline') {
      const offlineBounds = this.baseMapConfig.cameraBounds;
      minimumZoomDistance = Math.max(minimumZoomDistance, offlineBounds?.minimumZoomDistance ?? 0);
      maximumZoomDistance = Math.min(maximumZoomDistance, offlineBounds?.maximumZoomDistance ?? Number.POSITIVE_INFINITY);
    }

    if (minimumZoomDistance > maximumZoomDistance) {
      throw new RangeError('相机缩放范围与离线地图 cameraBounds 没有交集');
    }

    controller.minimumZoomDistance = minimumZoomDistance;
    controller.maximumZoomDistance = maximumZoomDistance;
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

  private buildLayersConfigForBaseMap(baseMap: BaseMapConfig): LayersConfig {
    switch (baseMap.provider) {
      case 'gaode':
        return {
          type: 'gaode',
          gaode: {
            mapTypeId: (baseMap.type as 'vector' | 'satellite' | 'terrain' | undefined) || 'satellite',
            token: baseMap.key || baseMap.token,
            sk: baseMap.sk,
            showLabel: baseMap.showLabel ?? true,
          },
        };
      case 'tencent':
        return {
          type: 'tencent',
          tencent: {
            mapTypeId: (baseMap.type as 'vector' | 'satellite' | undefined) || 'satellite',
            key: baseMap.key,
            token: baseMap.token,
            showLabel: baseMap.showLabel ?? true,
          },
        };
      case 'google':
        return {
          type: 'google',
          google: {
            mapTypeId: (baseMap.type as 'roadmap' | 'satellite' | undefined) || 'roadmap',
            apiKey: baseMap.key || baseMap.token,
            showLabel: baseMap.showLabel ?? false,
          },
        };
      case 'baidu':
        return {
          type: 'baidu',
          baidu: {
            mapTypeId: (baseMap.type as 'normal' | 'satellite' | 'terrain' | undefined) || 'satellite',
            token: baseMap.ak || baseMap.key || baseMap.token,
            sk: baseMap.sk,
            showLabel: baseMap.showLabel ?? true,
          },
        };
      case 'custom':
        return {
          type: 'custom',
          custom: {
            providers: baseMap.providers || [],
            type: baseMap.type as 'xyz' | 'wmts' | 'imageryProviders' | undefined,
            mode: baseMap.mode,
            customUrl: baseMap.customUrl,
            urlTemplate: baseMap.urlTemplate,
            rectangle: baseMap.rectangle,
            minimumLevel: baseMap.minimumLevel,
            maximumLevel: baseMap.maximumLevel,
            credit: baseMap.credit,
            cameraBounds: baseMap.cameraBounds,
            wmtsLayer: baseMap.wmtsLayer,
            wmtsStyle: baseMap.wmtsStyle,
            wmtsFormat: baseMap.wmtsFormat,
            tileMatrixSetId: baseMap.tileMatrixSetId,
          },
        };
      default:
        return {
          type: 'tdt',
          tdt: {
            mapTypeId: (baseMap.type as 'vec' | 'img' | 'ter' | 'tdt3d' | undefined) || 'img',
            token: baseMap.token || baseMap.key || '',
            sk: baseMap.sk,
            showLabel: baseMap.showLabel ?? true,
          },
        };
    }
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

  private resolveCurrentMapTypeId(baseMapConfig: BaseMapConfig = this.baseMapConfig): string {
    return resolveMapTypeId(baseMapConfig);
  }

  private resolvePlaceNameVisible(baseMapConfig: BaseMapConfig = this.baseMapConfig): boolean {
    return baseMapConfig.showLabel ?? false;
  }

  private getToolbarMapTypes() {
    return this.toolbarMapTypes;
  }

  private getCurrentToolbarMapType(): MapType | undefined {
    return this.toolbarMapTypes.find((mapType) => mapType.id === this.currentMapTypeId);
  }

  private resolveToolbarMapTypes(mapService: ResolvedMapService): MapType[] {
    return withDefaultMapTypeThumbnails(
      this.toolbarLayersMenuConfig.mapTypes
        || baseMapRegistry.getMapTypes(mapService.baseMap, mapService.auth, this.viewer || undefined),
    );
  }

  private refreshToolbarMapTypes(): void {
    this.toolbarMapTypes = this.resolveToolbarMapTypes(this.mapService);
  }

  private buildResolvedMapRuntimeState(
    mapService: ResolvedMapService,
    mode: 'legacy' | 'mapService',
    mapServiceConfig?: MapServiceConfig,
  ): ResolvedMapRuntimeState {
    const baseMapConfig = mapService.baseMap;
    const toolbarMapTypes = this.resolveToolbarMapTypes(mapService);
    const currentMapTypeId = this.resolveCurrentMapTypeId(baseMapConfig);
    const resolvedPlaceNameVisible = this.toolbarLayersMenuConfig.defaultPlaceNameChecked
      ?? this.resolvePlaceNameVisible(baseMapConfig);
    const currentToolbarMapType = toolbarMapTypes.find((mapType) => mapType.id === currentMapTypeId);
    const isForcedMapType = !!currentToolbarMapType?.forcePlaceName;
    const nonForcedPlaceNameVisible = resolvedPlaceNameVisible;
    const placeNameVisible = isForcedMapType ? true : resolvedPlaceNameVisible;

    return {
      mapConfigMode: mode,
      mapServiceConfig: mapServiceConfig ? { ...mapServiceConfig } : undefined,
      mapService,
      baseMapConfig,
      mapAuthConfig: mapService.auth,
      layersConfig: this.buildLayersConfigForBaseMap(baseMapConfig),
      toolbarMapTypes,
      currentMapTypeId,
      placeNameVisible,
      nonForcedPlaceNameVisible,
    };
  }

  private applyResolvedMapRuntimeState(state: ResolvedMapRuntimeState): void {
    this.mapConfigMode = state.mapConfigMode;
    this.mapServiceConfig = state.mapServiceConfig ? { ...state.mapServiceConfig } : undefined;
    this.mapService = state.mapService;
    this.baseMapConfig = state.baseMapConfig;
    this.mapAuthConfig = state.mapAuthConfig;
    this.layersConfig = state.layersConfig;
    this.toolbarMapTypes = state.toolbarMapTypes;
    this.currentMapTypeId = state.currentMapTypeId;
    this.placeNameVisible = state.placeNameVisible;
    this.nonForcedPlaceNameVisible = state.nonForcedPlaceNameVisible;
  }

  private applyResolvedMapService(
    mapService: ResolvedMapService,
    mode: 'legacy' | 'mapService',
    mapServiceConfig?: MapServiceConfig,
  ): void {
    this.applyResolvedMapRuntimeState(
      this.buildResolvedMapRuntimeState(mapService, mode, mapServiceConfig),
    );
  }

  private syncMapServiceState(): void {
    this.applyResolvedMapService(
      resolveLegacyMapService({
        baseMap: this.baseMapConfig,
        mapAuth: this.mapAuthConfig,
      }),
      'legacy',
    );
  }

  private assertLegacyMutationAllowed(methodName: string): void {
    if (this.mapConfigMode === 'mapService') {
      throw new MapServiceConfigError(
        `${methodName} 不能在 mapService 模式下调用，请改用 setMapService()`,
      );
    }
  }

  private getLayerToken(): string {
    return this.mapService.credentials.serviceKey;
  }

  private getLayerSk(): string {
    return this.mapService.credentials.secureKey;
  }

  private supportsMapServiceToolbarSearch(): boolean {
    return this.mapConfigMode === 'mapService'
      && !this.mapService.isOffline
      && (
        this.mapService.provider === 'tdt'
        || this.mapService.provider === 'gaode'
        || this.mapService.provider === 'baidu'
        || this.mapService.provider === 'tencent'
        || this.mapService.provider === 'google'
      );
  }

  private invalidateMapServiceSearches(): void {
    this.mapServiceSearchGeneration += 1;
  }

  private attachMapServiceSearchMeta(results: SearchResult[]): SearchResult[] {
    if (
      this.mapService.provider !== 'tdt'
      && this.mapService.provider !== 'gaode'
      && this.mapService.provider !== 'baidu'
      && this.mapService.provider !== 'tencent'
      && this.mapService.provider !== 'google'
    ) {
      return results;
    }

    const generation = this.mapServiceSearchGeneration;
    const provider = this.mapService.provider;

    return results.map((result) => {
      if (!result || typeof result !== 'object') {
        return result;
      }

      Object.defineProperty(result, MAP_SERVICE_SEARCH_META, {
        configurable: true,
        enumerable: false,
        value: {
          generation,
          provider,
        },
      });
      return result;
    });
  }

  private isStaleMapServiceSearchResult(result: SearchResultWithMapServiceMeta): boolean {
    const meta = result?.[MAP_SERVICE_SEARCH_META];
    if (!meta) {
      return false;
    }

    return meta.generation !== this.mapServiceSearchGeneration
      || meta.provider !== this.mapService.provider;
  }

  private createToolbarSearchService(): ProviderSearchService | null {
    if (this.supportsMapServiceToolbarSearch()) {
      return new ProviderSearchService(this.providerSearchConfig);
    }

    if (this.mapConfigMode === 'legacy' && this.providerSearchConfig.enabled) {
      return new ProviderSearchService(this.providerSearchConfig);
    }

    return null;
  }

  private buildToolbarCallbacks(
    callbacks: ToolbarCallbacks = {},
  ): ToolbarCallbacks {
    if (this.mapConfigMode === 'mapService' && callbacks.onSearch) {
      throw new MapServiceConfigError(
        'mapService 模式下不支持通过 callbacks.onSearch 接管搜索，请改用 onSearchResultSelected',
      );
    }

    const resolvedCallbacks: ToolbarCallbacks = { ...callbacks };
    const providerSearchService = this.createToolbarSearchService();

    if (providerSearchService && !resolvedCallbacks.onSearch) {
      resolvedCallbacks.onSearch = async (query: string) => {
        if (this.mapConfigMode !== 'mapService') {
          return providerSearchService.search(query, this.mapService);
        }

        const generation = this.mapServiceSearchGeneration;
        const service = this.mapService;
        const results = await providerSearchService.search(query, service);
        if (
          generation !== this.mapServiceSearchGeneration
          || service !== this.mapService
          || service.provider !== this.mapService.provider
        ) {
          return [];
        }

        return this.attachMapServiceSearchMeta(results);
      };
    }

    if (this.supportsMapServiceToolbarSearch()) {
      resolvedCallbacks.onResultSelect = async (result) => {
        const selectedResult = this.handleMapServiceSearchSelection(result);
        if (selectedResult) {
          callbacks.onSelect?.(selectedResult);
        }
      };
    }

    return resolvedCallbacks;
  }

  private handleMapServiceSearchSelection(result: {
    name: string;
    address: string;
    longitude: number;
    latitude: number;
    height?: number;
    coordSystem?: 'WGS84' | 'GCJ02' | 'BD09';
  }): MapSearchResult | null {
    if (this.isStaleMapServiceSearchResult(result as SearchResultWithMapServiceMeta)) {
      return null;
    }

    const viewer = this.viewer;
    if (!viewer) {
      return null;
    }

    const point = coordinateService.toWGS84(
      {
        longitude: Number(result.longitude),
        latitude: Number(result.latitude),
        height: Number.isFinite(Number(result.height)) ? Number(result.height) : undefined,
      },
      result.coordSystem || 'WGS84',
    );
    const currentHeight = viewer.camera.positionCartographic?.height;
    const height = typeof currentHeight === 'number' && Number.isFinite(currentHeight) && currentHeight > 0
      ? currentHeight
      : (point.height ?? 2000);

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, height),
      orientation: {
        heading: viewer.camera.heading,
        pitch: viewer.camera.pitch,
        roll: viewer.camera.roll,
      },
      duration: 1.2,
    });

    if (
      this.mapService.provider === 'tdt'
      || this.mapService.provider === 'gaode'
      || this.mapService.provider === 'baidu'
      || this.mapService.provider === 'tencent'
      || this.mapService.provider === 'google'
    ) {
      const selectedResult: MapSearchResult = {
        provider: this.mapService.provider,
        name: result.name,
        address: result.address,
        longitude: point.longitude,
        latitude: point.latitude,
        height,
        coordSystem: 'WGS84',
      };
      this.onSearchResultSelected?.(selectedResult);
      return selectedResult;
    }

    return null;
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

  private captureViewerLayerSnapshot(): ViewerLayerSnapshot | null {
    if (!this.viewer) {
      return null;
    }

    const imageryProviders: Cesium.ImageryProvider[] = [];
    for (let index = 0; index < this.viewer.imageryLayers.length; index += 1) {
      const layer = this.viewer.imageryLayers.get(index);
      if (layer?.imageryProvider) {
        imageryProviders.push(layer.imageryProvider);
      }
    }

    return {
      imageryProviders,
      terrainProvider: this.viewer.terrainProvider,
    };
  }

  private restoreViewerLayerSnapshot(snapshot: ViewerLayerSnapshot | null): void {
    if (!this.viewer || !snapshot) {
      return;
    }

    this.viewer.imageryLayers.removeAll();
    snapshot.imageryProviders.forEach((provider) => {
      this.viewer!.imageryLayers.addImageryProvider(provider);
    });
    this.applyTerrainProvider(snapshot.terrainProvider);
    this.applyOfflineConstraints();
    this.syncCreditDisplay();
    void this.syncGeoWTFS();
  }

  private resolveMapTypeForRuntimeState(runtimeState: ResolvedMapRuntimeState): MapType {
    const mapType = baseMapRegistry.getMapTypeById(
      runtimeState.currentMapTypeId,
      runtimeState.mapService.baseMap,
      runtimeState.mapService.auth,
      this.viewer || undefined,
    ) || baseMapRegistry.getMapTypes(
      runtimeState.mapService.baseMap,
      runtimeState.mapService.auth,
      this.viewer || undefined,
    )[0];

    if (!mapType) {
      throw new Error(`未找到可用地图类型: ${runtimeState.currentMapTypeId}`);
    }

    return mapType;
  }

  private async prepareMapServiceSwitch(
    mapService: ResolvedMapService,
    mapServiceConfig?: MapServiceConfig,
  ): Promise<PreparedMapServiceSwitch> {
    const runtimeState = this.buildResolvedMapRuntimeState(mapService, 'mapService', mapServiceConfig);
    return this.preparePreparedMapServiceSwitch(runtimeState);
  }

  private async preparePreparedMapServiceSwitch(
    runtimeState: ResolvedMapRuntimeState,
  ): Promise<PreparedMapServiceSwitch> {
    const viewer = this.viewer;
    if (!viewer) {
      return {
        runtimeState,
        providers: [],
        terrainProvider: null,
      };
    }

    const mapType = this.resolveMapTypeForRuntimeState(runtimeState);
    if (mapType.id === 'tdt3d') {
      await ensureTDT3DExtensionLoaded();
    }

    const context = {
      viewer,
      baseMap: runtimeState.mapService.baseMap,
      auth: runtimeState.mapService.auth,
      service: runtimeState.mapService,
    };
    const providers = await Promise.resolve(mapType.provider(context));
    const terrainProvider = mapType.terrainProvider
      ? await Promise.resolve(mapType.terrainProvider(context))
      : null;

    return {
      runtimeState,
      providers: runtimeState.placeNameVisible ? providers : providers.slice(0, 1),
      terrainProvider,
    };
  }

  private applyPreparedMapServiceSwitch(prepared: PreparedMapServiceSwitch): void {
    if (!this.viewer) {
      return;
    }

    this.viewer.imageryLayers.removeAll();
    prepared.providers.forEach((provider) => {
      this.viewer!.imageryLayers.addImageryProvider(provider);
    });
    this.applyTerrainProvider(prepared.terrainProvider);
    this.applyOfflineConstraints();
    this.syncCreditDisplay();
    this.syncMapConfigHint();
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

  private shouldShowMapConfigHint(): boolean {
    return this.mapService.provider === 'tdt' && !this.mapService.credentials.serviceKey;
  }

  private syncMapConfigHint(): void {
    if (!this.viewer) {
      return;
    }

    if (this.shouldShowMapConfigHint() && !this.mapConfigHint) {
      const container = this.viewer.container as HTMLElement;
      if (getComputedStyle(container).position === 'static') {
        this.mapConfigHintContainer = container;
        this.mapConfigHintPreviousPosition = container.style.position;
        container.style.position = 'relative';
      }
      this.mapConfigHint = new MapConfigHint({ i18n: this.mapConfigI18n });
      this.mapConfigHint.mount(container);
      return;
    }

    if (!this.shouldShowMapConfigHint() && this.mapConfigHint) {
      this.mapConfigHint.destroy();
      this.mapConfigHint = null;
      if (this.mapConfigHintContainer) {
        this.mapConfigHintContainer.style.position = this.mapConfigHintPreviousPosition;
        this.mapConfigHintContainer = null;
        this.mapConfigHintPreviousPosition = '';
      }
    }
  }

  private clearOfflineConstraints(): void {
    this.offlineCleanup?.();
    this.offlineCleanup = null;
  }

  private applyOfflineConstraints(): void {
    this.clearOfflineConstraints();
    if (!this.viewer || this.baseMapConfig.provider !== 'custom' || this.baseMapConfig.mode !== 'offline' || !this.baseMapConfig.rectangle) {
      this.applyCameraZoomConstraints();
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
    this.applyCameraZoomConstraints();

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

    if (this.mapService.isOffline) {
      this.toolbarService.hideButton('search');
      return;
    }

    this.toolbarService.showButton('search');
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
      // Enable native WebGL anti-aliasing by default. Preserve every caller
      // override, including an explicit `antialias: false`.
      const contextOptions = this.viewerOptions.contextOptions;
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
        contextOptions: {
          ...contextOptions,
          webgl: {
            antialias: true,
            ...contextOptions?.webgl,
          },
        },
      };

      // 设置 Cesium Ion token
      if (this.cesiumToken) {
        Cesium.Ion.defaultAccessToken = this.cesiumToken;
        // 使用索引签名访问以绕过类型检查（Cesium 某些版本 ConstructorOptions 不包含 accessToken）
        (viewerOptions as any).accessToken = this.cesiumToken;
      }

      this.viewer = new Cesium.Viewer(container, viewerOptions);
      this.applyCameraZoomConstraints();
      this.syncMapConfigHint();
      // Native MSAA is applied by Viewer when supported; FXAA is the
      // fallback that also smooths Entity/Polyline geometry.
      this.viewer.scene.postProcessStages.fxaa.enabled = this.fxaa;
      // Apply the credit policy before asynchronous layer/terrain loading so
      // the default Cesium Ion logo does not flash during initialization.
      this.syncCreditDisplay();
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
    const prepared = await this.preparePreparedMapServiceSwitch(
      {
        mapConfigMode: this.mapConfigMode,
        mapServiceConfig: this.mapServiceConfig ? { ...this.mapServiceConfig } : undefined,
        mapService: this.mapService,
        baseMapConfig: this.baseMapConfig,
        mapAuthConfig: this.mapAuthConfig,
        layersConfig: this.layersConfig,
        toolbarMapTypes: this.toolbarMapTypes,
        currentMapTypeId: this.currentMapTypeId,
        placeNameVisible: this.placeNameVisible,
        nonForcedPlaceNameVisible: this.nonForcedPlaceNameVisible,
      },
    );

    if (requestVersion !== this.layerRequestVersion || !this.viewer) {
      return;
    }

    this.applyPreparedMapServiceSwitch(prepared);
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
      fxaa: this.fxaa,
      camera: { ...this.cameraConfig },
      layers: this.mapConfigMode === 'legacy' ? { ...this.layersConfig } : undefined,
      mapService: this.mapServiceConfig ? { ...this.mapServiceConfig } : undefined,
      baseMap: this.mapConfigMode === 'legacy' ? { ...this.baseMapConfig } : undefined,
      mapAuth: this.mapConfigMode === 'legacy' && this.mapAuthConfig
        ? { ...this.mapAuthConfig }
        : undefined,
      providerSearch: { ...this.providerSearchConfig },
      onSearchResultSelected: this.onSearchResultSelected,
      credits: { ...this.creditsConfig },
      cesiumToken: this.cesiumToken,
      i18n: this.mapConfigI18n,
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
      this.applyCameraZoomConstraints();
      this.setCameraView();
    }
  }

  /**
   * 更新图层配置
   */
  updateLayers(config: Partial<LayersConfig>): void {
    this.assertLegacyMutationAllowed('updateLayers');
    this.layersConfig = this.mergeLayersConfig(config);
    this.baseMapConfig = this.resolveBaseMapConfig({
      layers: this.layersConfig,
      mapAuth: this.mapAuthConfig,
    });
    this.syncMapServiceState();
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

  /** @deprecated mapService 模式请使用 setMapService()。 */
  updateBaseMap(baseMap: Partial<BaseMapConfig>): void {
    this.assertLegacyMutationAllowed('updateBaseMap');
    this.baseMapConfig = {
      ...this.baseMapConfig,
      ...baseMap,
      provider: normalizeProviderId(baseMap.provider || this.baseMapConfig.provider),
    };
    this.syncMapServiceState();
    this.currentMapTypeId = this.resolveCurrentMapTypeId();
    this.placeNameVisible = this.resolvePlaceNameVisible();
    if (this.isInitialized) {
      void this.refreshLayersAndGeoWTFS();
    }
    this.updateToolbarLayerState();
    this.syncOfflineToolbarState();
  }

  /** @deprecated mapService 模式请使用 setMapService()。 */
  updateMapAuth(mapAuth: MapAuthConfig): void {
    this.assertLegacyMutationAllowed('updateMapAuth');
    const normalized = normalizeMapAuth(mapAuth) || {};
    const nextAuth = { ...(this.mapAuthConfig || {}) };
    (['tdt', 'gaode', 'tencent', 'baidu', 'google'] as const).forEach((provider) => {
      if (normalized[provider] !== undefined) {
        (nextAuth as any)[provider] = normalized[provider];
      }
    });
    this.mapAuthConfig = nextAuth;
    this.syncMapServiceState();

    const currentProvider = this.baseMapConfig.provider;
    const affectsCurrentProvider = currentProvider !== 'custom'
      && normalized[currentProvider] !== undefined;
    if (this.isInitialized && affectsCurrentProvider) {
      void this.refreshLayersAndGeoWTFS();
    }
    this.updateToolbarLayerState();
  }

  /** @deprecated mapService 模式请使用 setMapService()。 */
  setMapAuth(mapAuth: MapAuthConfig): void {
    this.assertLegacyMutationAllowed('setMapAuth');
    this.mapAuthConfig = normalizeMapAuth(mapAuth);
    this.syncMapServiceState();
    if (this.isInitialized) void this.refreshLayersAndGeoWTFS();
    this.updateToolbarLayerState();
  }

  private isEquivalentMapServiceConfig(
    left?: MapServiceConfig,
    right?: MapServiceConfig,
  ): boolean {
    if (!left || !right || left.provider !== right.provider) {
      return false;
    }

    if (left.provider === 'private' && right.provider === 'private') {
      return JSON.stringify({
        offlineMapUrl: left.offlineMapUrl,
        rectangle: left.rectangle,
        minimumLevel: left.minimumLevel,
        maximumLevel: left.maximumLevel,
        credit: left.credit,
        cameraBounds: left.cameraBounds,
      }) === JSON.stringify({
        offlineMapUrl: right.offlineMapUrl,
        rectangle: right.rectangle,
        minimumLevel: right.minimumLevel,
        maximumLevel: right.maximumLevel,
        credit: right.credit,
        cameraBounds: right.cameraBounds,
      });
    }

    if (left.provider === 'private' || right.provider === 'private') {
      return false;
    }

    return left.serviceKey === right.serviceKey && left.secureKey === right.secureKey;
  }

  private mapSwitchErrorToCode(error: unknown): MapServiceValidationCode {
    if (error instanceof MapServiceConfigError) {
      return 'INVALID_CONFIG';
    }

    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (message.includes('proxy') || message.includes('gateway')) {
      return 'PROXY_REQUIRED';
    }
    if (
      message.includes('network')
      || message.includes('timeout')
      || message.includes('failed to fetch')
      || message.includes('fetch failed')
    ) {
      return 'NETWORK_ERROR';
    }
    if (
      message.includes('invalid key')
      || message.includes('api key')
      || message.includes('permission denied')
      || message.includes('credential')
      || message.includes('密钥')
      || message.includes('鉴权')
    ) {
      return 'INVALID_CREDENTIALS';
    }
    if (
      message.includes('referer')
      || message.includes('referrer')
      || message.includes('billing')
      || message.includes('forbidden')
      || message.includes('blocked')
      || message.includes('restriction')
    ) {
      return 'CLIENT_RESTRICTION';
    }
    return 'SERVICE_UNAVAILABLE';
  }

  private buildMapServiceUpdateResult(
    provider: MapServiceProvider,
    overrides: Partial<Omit<MapServiceUpdateResult, 'capabilities' | 'provider'>> & {
      capabilities?: {
        basemap?: Partial<MapServiceUpdateResult['capabilities']['basemap']>;
        search?: Partial<MapServiceUpdateResult['capabilities']['search']>;
      };
    },
  ): MapServiceUpdateResult {
    return {
      ok: overrides.ok ?? false,
      provider,
      code: overrides.code,
      changed: overrides.changed ?? false,
      capabilities: {
        basemap: {
          status: 'unknown',
          ...overrides.capabilities?.basemap,
        },
        search: {
          ...getDefaultMapServiceSearchCapability(provider),
          ...overrides.capabilities?.search,
        },
      },
    };
  }

  private buildSuccessfulMapServiceUpdateResult(
    mapService: MapServiceConfig,
    changed: boolean,
    validated?: MapServiceValidationResult,
  ): MapServiceUpdateResult {
    if (validated) {
      return {
        ...validated,
        changed,
      };
    }

    return this.buildMapServiceUpdateResult(mapService.provider, {
      ok: true,
      changed,
      capabilities: {
        basemap: {
          status: 'available',
          credentialVerified: mapService.provider === 'private' ? undefined : false,
        },
      },
    });
  }

  private buildFailedMapServiceUpdateResult(
    mapService: MapServiceConfig,
    error: unknown,
  ): MapServiceUpdateResult {
    return this.buildMapServiceUpdateResult(mapService.provider, {
      ok: false,
      changed: false,
      code: this.mapSwitchErrorToCode(error),
      capabilities: {
        basemap: {
          status: 'unavailable',
          message: error instanceof Error ? error.message : String(error),
        },
      },
    });
  }

  private async validateMapServiceForSwitch(
    mapService: MapServiceConfig,
  ): Promise<MapServiceValidationResult | null> {
    if (
      mapService.provider === 'tdt'
      || mapService.provider === 'google'
      || mapService.provider === 'private'
    ) {
      return validateMapService(mapService);
    }

    return null;
  }

  async setMapService(mapService: MapServiceConfig): Promise<MapServiceUpdateResult> {
    const normalizedMapService = normalizeMapServiceConfig(mapService);
    const changed = !this.isEquivalentMapServiceConfig(this.mapServiceConfig, normalizedMapService);
    this.invalidateMapServiceSearches();

    if (!changed && this.mapConfigMode === 'mapService') {
      return this.buildSuccessfulMapServiceUpdateResult(normalizedMapService, false);
    }

    const validationResult = await this.validateMapServiceForSwitch(normalizedMapService);
    if (validationResult && !validationResult.ok) {
      return {
        ...validationResult,
        changed: false,
      };
    }

    const resolvedMapService = resolveConfiguredMapService(normalizedMapService);

    if (!this.isInitialized || !this.viewer) {
      this.applyResolvedMapService(
        resolvedMapService,
        'mapService',
        normalizedMapService,
      );
      this.updateToolbarLayerState();
      this.syncOfflineToolbarState();
      return this.buildSuccessfulMapServiceUpdateResult(
        normalizedMapService,
        true,
        validationResult || undefined,
      );
    }

    const previousRuntimeState = this.buildResolvedMapRuntimeState(
      this.mapService,
      this.mapConfigMode,
      this.mapServiceConfig,
    );
    const previousViewerSnapshot = this.captureViewerLayerSnapshot();

    try {
      const preparedSwitch = await this.prepareMapServiceSwitch(
        resolvedMapService,
        normalizedMapService,
      );
      this.applyResolvedMapRuntimeState(preparedSwitch.runtimeState);
      try {
        this.applyPreparedMapServiceSwitch(preparedSwitch);
        await this.syncGeoWTFS();
      } catch (error) {
        this.applyResolvedMapRuntimeState(previousRuntimeState);
        this.restoreViewerLayerSnapshot(previousViewerSnapshot);
        throw error;
      }

      this.updateToolbarLayerState();
      this.syncOfflineToolbarState();
      return this.buildSuccessfulMapServiceUpdateResult(
        normalizedMapService,
        true,
        validationResult || undefined,
      );
    } catch (error) {
      return this.buildFailedMapServiceUpdateResult(normalizedMapService, error);
    }
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
    if (options.config) {
      this.applyToolbarConfigPatch(options.config);
    }

    if (this.toolbarService) {
      return this.toolbarService;
    }

    const callbacks = this.buildToolbarCallbacks(options.callbacks || {});
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
      measureMenu: options.measureMenu,
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
   * 运行时更新工具栏样式配置。
   */
  updateToolbarStyle(config: Partial<ToolbarConfig>): void {
    this.applyToolbarConfigPatch(config);
    this.toolbarService?.updateToolbarStyle(config);
  }

  /**
   * 运行时更新工具栏停靠位置和边距偏移。
   */
  setToolbarPosition(
    position: NonNullable<ToolbarConfig['position']>,
    offsets: Pick<ToolbarConfig, 'offsetTop' | 'offsetRight' | 'offsetBottom' | 'offsetLeft'> = {},
  ): void {
    this.updateToolbarStyle({
      position,
      ...offsets,
    });
  }

  /**
   * 获取当前工具栏配置快照。
   */
  getToolbarConfig(): ToolbarConfig {
    return this.toolbarService?.getToolbarStyle() || { ...this.toolbarConfig };
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
      picking: options.picking,
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

    this.mapConfigHint?.destroy();
    this.mapConfigHint = null;
    if (this.mapConfigHintContainer) {
      this.mapConfigHintContainer.style.position = this.mapConfigHintPreviousPosition;
      this.mapConfigHintContainer = null;
      this.mapConfigHintPreviousPosition = '';
    }

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
