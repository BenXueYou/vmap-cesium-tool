import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';
import { DEFAULT_MAP_TYPES, DEFAULT_TOOLBAR_STYLE, withDefaultMapTypeThumbnails } from '../core/services/toolbar/config';
import type {
  CustomButtonConfig,
  MapType,
  MapAuthConfig,
  MeasurementCallback,
  SearchCallback,
  ToolbarConfig,
  ZoomCallback,
} from '../core/types';
import { ToolbarService } from '../core/services/toolbar/ToolbarService';
import type { MapPlugin, LayersServiceBridge } from '../core/MapPlugin';
import { DrawHelperAdapter } from './DrawHelperAdapter';
import { SearchService as LegacySearchService } from '../libs/toolBar/MapSearchService';
import { MeasurementService as LegacyMeasurementService } from '../libs/toolBar/MeasurementService';
import { i18n, type I18nLike } from '../i18n';
import { lngLatToCartesian } from '../core/mapProviders/coordinates/cesium';
import { baseMapRegistry, resolveMapTypeId } from '../core/mapProviders/registry';

interface LegacyInitialCenter {
  longitude: number;
  latitude: number;
  height: number;
}

export interface LegacyCesiumMapToolbarCallbacks {
  search?: SearchCallback;
  measurement?: MeasurementCallback;
  zoom?: ZoomCallback;
  fullscreen?: (isFullscreen: boolean) => void;
  resetLocation?: () => void;
}

interface LegacyMapLayersBridge {
  setMapType: (mapTypeId: string) => void;
  setPlaceNameVisible: (isChecked: boolean) => void;
  togglePlaceNameVisibility: () => void;
  showNoFlyZones: () => Promise<void>;
  hideNoFlyZones: () => void;
  toggleNoFlyZoneVisibility: () => void;
  toggleNoFlyZones: () => Promise<void>;
  getNoFlyZoneVisible: () => boolean;
}

class ToolbarAdapterMapController {
  constructor(
    private readonly viewer: Viewer,
    private initialCenter: LegacyInitialCenter,
    private readonly callbacks?: {
      zoom?: ZoomCallback;
      fullscreen?: (isFullscreen: boolean) => void;
      resetLocation?: () => void;
    },
  ) {}

  toggle2D3D(): void {
    if (this.viewer.scene.mode === Cesium.SceneMode.SCENE3D) {
      this.viewer.scene.morphTo2D(0);
      return;
    }

    this.viewer.scene.morphTo3D(0);
  }

  resetLocation(): void {
    this.viewer.camera.flyTo({
      destination: lngLatToCartesian({
        longitude: this.initialCenter.longitude,
        latitude: this.initialCenter.latitude,
        height: this.initialCenter.height,
      }),
      duration: 0,
    });
    this.callbacks?.resetLocation?.();
  }

  zoomIn(): void {
    const beforeHeight = this.viewer.camera.positionCartographic.height || 0;
    const requestedAmount = Math.max(beforeHeight * 0.5, 100);
    const minimumDistance = this.viewer.scene.screenSpaceCameraController.minimumZoomDistance;
    this.viewer.camera.zoomIn(Math.min(requestedAmount, Math.max(0, beforeHeight - minimumDistance)));
    const afterHeight = this.viewer.camera.positionCartographic.height || 0;
    this.callbacks?.zoom?.onZoomIn?.(beforeHeight, afterHeight, 0);
  }

  zoomOut(): void {
    const beforeHeight = this.viewer.camera.positionCartographic.height || 0;
    const requestedAmount = Math.max(beforeHeight * 0.5, 100);
    const maximumDistance = this.viewer.scene.screenSpaceCameraController.maximumZoomDistance;
    this.viewer.camera.zoomOut(Math.min(requestedAmount, Math.max(0, maximumDistance - beforeHeight)));
    const afterHeight = this.viewer.camera.positionCartographic.height || 0;
    this.callbacks?.zoom?.onZoomOut?.(beforeHeight, afterHeight, 0);
  }

  toggleFullscreen(): void {
    const container = this.viewer.container as HTMLElement;
    const willEnterFullscreen = !document.fullscreenElement;
    if (willEnterFullscreen) {
      void container.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
    this.callbacks?.fullscreen?.(willEnterFullscreen);
  }

  setInitialCenter(center: LegacyInitialCenter): void {
    this.initialCenter = center;
  }

  getInitialCenter(): LegacyInitialCenter {
    return this.initialCenter;
  }
}

/**
 * CesiumMapToolbar 兼容适配器。
 * 旧类名仍可继续使用，但内部已经转调新的 ToolbarService。
 */
export class ToolbarAdapter {
  private readonly viewer: Viewer;
  private readonly container: HTMLElement;
  private config: ToolbarConfig;
  private readonly callbacks?: LegacyCesiumMapToolbarCallbacks;
  private readonly toolbarService: ToolbarService;
  private readonly drawHelper: DrawHelperAdapter;
  private readonly mapController: ToolbarAdapterMapController;
  private readonly i18nInstance: I18nLike;
  private readonly mapPlugin: MapPlugin | null;

  private searchService: LegacySearchService | null = null;
  private measurementService: LegacyMeasurementService | null = null;
  private layersServiceBridge: LegacyMapLayersBridge | null = null;

  private currentMapType = 'img';
  private placeNameVisible = true;
  private noFlyZoneVisible = false;

  public TD_Token = '';
  public TD_SK = '';
  public mapTypes: MapType[] = DEFAULT_MAP_TYPES;

  public readonly measurement = {
    getMeasureMode: (): 'none' | 'distance' | 'area' => this.measurementService?.getMeasureMode?.() ?? 'none',
  };

  private resolveToolbarMapTypesFromPlugin(): MapType[] {
    if (!this.mapPlugin) {
      return this.mapTypes;
    }

    const pluginConfig = this.mapPlugin.getConfig();
    const toolbarOptions = pluginConfig.services?.toolbar;
    const configuredMapTypes = typeof toolbarOptions === 'object'
      ? toolbarOptions.layersMenu?.mapTypes
      : undefined;

    if (configuredMapTypes?.length) {
      return withDefaultMapTypeThumbnails(configuredMapTypes);
    }

    if (pluginConfig.baseMap) {
      return withDefaultMapTypeThumbnails(
        baseMapRegistry.getMapTypes(pluginConfig.baseMap, pluginConfig.mapAuth, this.viewer),
      );
    }

    return withDefaultMapTypeThumbnails(this.mapTypes);
  }

  constructor(
    viewer: Viewer,
    container: HTMLElement,
    config: ToolbarConfig = {},
    callbacks?: LegacyCesiumMapToolbarCallbacks,
    initialCenter: LegacyInitialCenter = {
      longitude: 116.3974,
      latitude: 39.9093,
      height: 1000000,
    },
  ) {
    this.viewer = viewer;
    this.container = container;
    this.config = {
      ...DEFAULT_TOOLBAR_STYLE,
      ...config,
    };
    this.callbacks = callbacks;
    this.i18nInstance = config.i18n ?? i18n;
    this.drawHelper = new DrawHelperAdapter(viewer);
    this.mapController = new ToolbarAdapterMapController(viewer, initialCenter, {
      zoom: callbacks?.zoom,
      fullscreen: callbacks?.fullscreen,
      resetLocation: callbacks?.resetLocation,
    });
    this.mapPlugin = (viewer as Viewer & { __vmapMapPlugin?: MapPlugin }).__vmapMapPlugin || null;

    const legacyConfig = config as ToolbarConfig & {
      token?: string;
      sk?: string;
      TD_Token?: string;
      TD_SK?: string;
    };

    this.TD_Token = legacyConfig.TD_Token || legacyConfig.token || this.TD_Token;
    this.TD_SK = legacyConfig.TD_SK || legacyConfig.sk || this.TD_SK;

    const pluginConfig = this.mapPlugin?.getConfig();
    this.mapTypes = this.resolveToolbarMapTypesFromPlugin();
    if (pluginConfig?.baseMap) {
      this.currentMapType = resolveMapTypeId(pluginConfig.baseMap);
      this.placeNameVisible = pluginConfig.baseMap.showLabel ?? this.placeNameVisible;
    }
    // baseMap 是新版唯一可信底图状态；仅在旧配置没有 baseMap 时读取 layers。
    if (!pluginConfig?.baseMap && pluginConfig?.layers) {
      switch (pluginConfig.layers.type) {
        case 'tdt':
          this.currentMapType = pluginConfig.layers.tdt?.mapTypeId || 'img';
          this.TD_Token = pluginConfig.layers.tdt?.token || this.TD_Token;
          this.TD_SK = pluginConfig.layers.tdt?.sk || this.TD_SK;
          this.placeNameVisible = pluginConfig.layers.tdt?.showLabel ?? true;
          break;
        case 'gaode':
          this.currentMapType = pluginConfig.layers.gaode?.mapTypeId || 'satellite';
          this.placeNameVisible = pluginConfig.layers.gaode?.showLabel ?? true;
          break;
        case 'baidu':
          this.currentMapType = pluginConfig.layers.baidu?.mapTypeId || 'satellite';
          this.placeNameVisible = pluginConfig.layers.baidu?.showLabel ?? true;
          break;
        default:
          break;
      }
    }

    this.noFlyZoneVisible = this.mapPlugin?.getNoFlyZoneVisible?.() ?? false;

    this.toolbarService = new ToolbarService(
      {
        viewer,
        container,
        drawHelper: this.drawHelper,
        i18n: this.i18nInstance,
        useI18n: config.useI18n ?? true,
        callbacks: {
          onSearch: callbacks?.search?.onSearch,
          onSelect: callbacks?.search?.onSelect,
          onMeasurementStart: callbacks?.measurement?.onMeasurementStart,
          onDistanceComplete: callbacks?.measurement?.onDistanceComplete,
          onAreaComplete: callbacks?.measurement?.onAreaComplete,
          onClear: callbacks?.measurement?.onClear,
        },
        layers: {
          mapTypes: this.mapTypes,
          currentMapType: this.currentMapType,
          token: this.TD_Token,
          isPlaceNameChecked: this.placeNameVisible,
          onMapTypeChange: (mapTypeId) => this.setMapType(mapTypeId),
          onPlaceNameToggle: (isChecked: boolean) => {
            this.placeNameVisible = isChecked;
            if (this.mapPlugin) {
              this.mapPlugin.getLayersServiceBridge().setPlaceNameVisible(isChecked);
            }
            this.syncLayersHandler();
          },
        },
        noFlyZone: {
          isChecked: this.noFlyZoneVisible,
        },
      },
      {
        toolbarStyle: this.config,
        buttonConfigs: this.config.buttons,
      },
    );

    this.toolbarService.initialize();

    const toolbarElement = this.toolbarService.getToolbarElement() || this.container;
    this.searchService = new LegacySearchService(
      this.viewer,
      toolbarElement,
      callbacks?.search,
      {
        i18n: this.i18nInstance,
        useI18n: this.config.useI18n ?? true,
      },
    );

    this.measurementService = new LegacyMeasurementService(this.viewer, this.drawHelper, callbacks?.measurement);
    this.measurementService.setupDrawHelperCallbacks();

    this.layersServiceBridge = this.createLayersServiceBridge();

    this.toolbarService.setSearchService(this.searchService);
    this.toolbarService.setMeasurementService(this.measurementService);
    this.toolbarService.setLayersService(this.layersServiceBridge);
    this.toolbarService.setMapController(this.mapController);

    this.syncLayersHandler();
  }

  private getLayersButtonCallback(): ((isChecked: boolean, toolbar: ToolbarAdapter) => void) | undefined {
    const layersButton = this.config.buttons?.find((btn) => btn.id === 'layers');
    return layersButton?.callback as ((isChecked: boolean, toolbar: ToolbarAdapter) => void) | undefined;
  }

  private emitLayersButtonCallback(isChecked: boolean): void {
    try {
      this.getLayersButtonCallback()?.(isChecked, this);
    } catch (error) {
      console.warn('layers callback 执行失败:', error);
    }
  }

  private syncLayersHandler(): void {
    const handler = this.toolbarService.getButtonHandler('layers') as any;
    if (!handler?.updateOptions) {
      return;
    }

    handler.updateOptions({
      layersService: this.layersServiceBridge,
      mapTypes: this.mapTypes,
      currentMapType: this.currentMapType,
      isPlaceNameChecked: this.placeNameVisible,
      token: this.TD_Token,
      isNoFlyZoneChecked: this.noFlyZoneVisible,
      onMapTypeChange: (mapTypeId: string) => this.setMapType(mapTypeId),
      onPlaceNameToggle: (isChecked: boolean) => {
        this.placeNameVisible = isChecked;
        this.layersServiceBridge?.setPlaceNameVisible(isChecked);
      },
      onShowNoFlyZones: async () => {
        await this.showNoFlyZones();
      },
      onNoFlyZoneToggle: (isChecked: boolean) => {
        if (isChecked) {
          void this.showNoFlyZones();
          return;
        }

        this.hideNoFlyZones();
      },
    });
  }

  private syncTdtAuthToMapPlugin(): void {
    if (!this.mapPlugin) {
      return;
    }

    // 认证更新不能通过 updateLayers 下发，否则会重新解析 provider，
    // 将当前腾讯/高德等底图意外切换为天地图。
    this.mapPlugin.updateMapAuth({
      tdt: {
        token: this.TD_Token,
        sk: this.TD_SK,
      },
    });
  }

  private createLayersServiceBridge(): LegacyMapLayersBridge {
    return {
      setMapType: (mapTypeId: string) => {
        this.currentMapType = mapTypeId;
        if (this.mapPlugin) {
          this.mapPlugin.getLayersServiceBridge().setMapType(mapTypeId);
        } else {
          this.applyMapTypeDirectly(mapTypeId);
        }
        this.syncLayersHandler();
      },
      setPlaceNameVisible: (_isChecked: boolean) => {
        this.placeNameVisible = _isChecked;
        if (this.mapPlugin) {
          this.mapPlugin.getLayersServiceBridge().setPlaceNameVisible(_isChecked);
        }
        this.syncLayersHandler();
      },
      togglePlaceNameVisibility: () => {
        this.placeNameVisible = !this.placeNameVisible;
        if (this.mapPlugin) {
          this.mapPlugin.getLayersServiceBridge().togglePlaceNameVisibility();
        }
        this.syncLayersHandler();
      },
      showNoFlyZones: async () => {
        if (this.noFlyZoneVisible) {
          return;
        }

        this.noFlyZoneVisible = true;
        if (this.mapPlugin) {
          await this.mapPlugin.showNoFlyZones();
        }
        this.emitLayersButtonCallback(true);
        this.syncLayersHandler();
      },
      hideNoFlyZones: () => {
        if (!this.noFlyZoneVisible) {
          return;
        }

        this.noFlyZoneVisible = false;
        if (this.mapPlugin) {
          this.mapPlugin.hideNoFlyZones();
        }
        this.emitLayersButtonCallback(false);
        this.syncLayersHandler();
      },
      toggleNoFlyZoneVisibility: () => {
        if (this.noFlyZoneVisible) {
          this.layersServiceBridge?.hideNoFlyZones();
          return;
        }

        void this.layersServiceBridge?.showNoFlyZones();
      },
      toggleNoFlyZones: async () => {
        if (this.noFlyZoneVisible) {
          this.layersServiceBridge?.hideNoFlyZones();
          return;
        }

        await this.layersServiceBridge?.showNoFlyZones();
      },
      getNoFlyZoneVisible: () => this.noFlyZoneVisible,
    };
  }

  private applyMapTypeDirectly(mapTypeId: string): void {
    const mapType = this.mapTypes.find((item) => item.id === mapTypeId);
    if (!mapType) {
      return;
    }

    void Promise.resolve(mapType.provider(this.TD_Token)).then((providers) => {
      this.viewer.imageryLayers.removeAll();
      providers.forEach((provider) => {
        this.viewer.imageryLayers.addImageryProvider(provider);
      });
    });
  }

  public getSearchService(): LegacySearchService | null {
    return this.toolbarService.getSearchService() || this.searchService;
  }

  public getMeasurementService(): LegacyMeasurementService | null {
    return this.toolbarService.getMeasurementService() || this.measurementService;
  }

  public getMapLayersService(): LegacyMapLayersBridge | LayersServiceBridge | null {
    return this.toolbarService.getLayersService() || this.layersServiceBridge;
  }

  public setMapType(mapTypeId: string): void {
    this.currentMapType = mapTypeId;
    if (this.layersServiceBridge) {
      this.layersServiceBridge.setMapType(mapTypeId);
    } else {
      this.applyMapTypeDirectly(mapTypeId);
      this.syncLayersHandler();
    }
  }

  public getToolbarService(): ToolbarService {
    return this.toolbarService;
  }

  public updateToolbarStyle(config: Partial<ToolbarConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
    this.toolbarService.updateToolbarStyle(config);
  }

  public setToolbarPosition(
    position: NonNullable<ToolbarConfig['position']>,
    offsets: Pick<ToolbarConfig, 'offsetTop' | 'offsetRight' | 'offsetBottom' | 'offsetLeft'> = {},
  ): void {
    this.updateToolbarStyle({
      position,
      ...offsets,
    });
  }

  public getToolbarStyle(): ToolbarConfig {
    return this.toolbarService.getToolbarStyle();
  }

  public getToolbarElement(): HTMLElement | null {
    return this.toolbarService.getToolbarElement();
  }

  public getCesiumMapCtrl(): ToolbarAdapterMapController {
    return this.mapController;
  }

  public setMapTypes(mapTypes: MapType[]): void {
    this.mapTypes = mapTypes;
    this.syncLayersHandler();
  }

  public setTDToken(token: string): void {
    this.TD_Token = token;
    this.syncTdtAuthToMapPlugin();
    this.syncLayersHandler();
  }

  public setTDSK(sk: string): void {
    this.TD_SK = sk;
    this.syncTdtAuthToMapPlugin();
    this.syncLayersHandler();
  }

  public setTDTAuth(token: string, sk?: string): void {
    this.TD_Token = token;
    this.TD_SK = sk || '';
    this.syncTdtAuthToMapPlugin();
    this.syncLayersHandler();
  }

  public setMapAuth(auth: MapAuthConfig): void {
    if (!this.mapPlugin) {
      return;
    }

    if (auth.tdt) {
      this.TD_Token = auth.tdt.token || this.TD_Token;
      this.TD_SK = auth.tdt.sk || this.TD_SK;
      if (this.mapPlugin.getConfig().baseMap?.provider === 'tdt') {
        this.mapPlugin.updateBaseMap({
          token: this.TD_Token,
          sk: this.TD_SK,
        });
      }
    }

    this.mapPlugin.updateMapAuth(auth);
    this.mapTypes = this.resolveToolbarMapTypesFromPlugin();
    this.syncLayersHandler();
  }

  public setBaseMapProvider(provider: 'tdt' | 'gaode' | 'tencent' | 'baidu' | 'google' | 'custom', type?: string): void {
    if (!this.mapPlugin) {
      return;
    }

    const baseMap = {
      ...(this.mapPlugin.getConfig().baseMap || {}),
      provider,
      type: type || this.mapPlugin.getConfig().baseMap?.type,
    };

    this.currentMapType = resolveMapTypeId(baseMap as any);
    this.mapPlugin.updateBaseMap(baseMap as any);
    this.mapTypes = this.resolveToolbarMapTypesFromPlugin();
    this.syncLayersHandler();
  }

  public setInitialCenter(center: LegacyInitialCenter): void {
    this.mapController.setInitialCenter(center);
  }

  public getInitialCenter(): LegacyInitialCenter {
    return this.mapController.getInitialCenter();
  }

  public resetToInitialLocation(): void {
    this.mapController.resetLocation();
  }

  public updateButtonConfig(buttonId: string, config: Partial<CustomButtonConfig>): void {
    this.toolbarService.updateButton(buttonId, config);
  }

  public addCustomButton(config: CustomButtonConfig): void {
    this.toolbarService.addCustomButton(config, config.onClick);
  }

  public removeButton(buttonId: string): void {
    this.toolbarService.removeButton(buttonId);
  }

  public showButton(buttonId: string): void {
    this.toolbarService.showButton(buttonId);
  }

  public hideButton(buttonId: string): void {
    this.toolbarService.hideButton(buttonId);
  }

  public enableButton(buttonId: string): void {
    this.toolbarService.enableButton(buttonId);
  }

  public disableButton(buttonId: string): void {
    this.toolbarService.disableButton(buttonId);
  }

  public async showNoFlyZones(): Promise<void> {
    if (!this.layersServiceBridge) {
      this.layersServiceBridge = this.createLayersServiceBridge();
      this.toolbarService.setLayersService(this.layersServiceBridge);
    }

    await this.layersServiceBridge.showNoFlyZones();
  }

  public hideNoFlyZones(): void {
    if (!this.layersServiceBridge) {
      this.layersServiceBridge = this.createLayersServiceBridge();
      this.toolbarService.setLayersService(this.layersServiceBridge);
    }

    this.layersServiceBridge.hideNoFlyZones();
  }

  public async toggleNoFlyZones(): Promise<void> {
    if (!this.layersServiceBridge) {
      this.layersServiceBridge = this.createLayersServiceBridge();
      this.toolbarService.setLayersService(this.layersServiceBridge);
    }

    await this.layersServiceBridge.toggleNoFlyZones();
  }

  public getNoFlyZoneVisible(): boolean {
    if (this.layersServiceBridge) {
      return this.layersServiceBridge.getNoFlyZoneVisible();
    }

    return this.noFlyZoneVisible;
  }

  public destroy(): void {
    this.toolbarService.destroy();
    this.searchService?.destroy();
    this.searchService = null;
    this.measurementService = null;
    this.layersServiceBridge = null;
    this.drawHelper.destroy();
  }
}

export function createToolbarAdapter(
  viewer: Viewer,
  container: HTMLElement,
  config?: ToolbarConfig,
  callbacks?: LegacyCesiumMapToolbarCallbacks,
  initialCenter?: LegacyInitialCenter,
): ToolbarAdapter {
  return new ToolbarAdapter(viewer, container, config, callbacks, initialCenter);
}
