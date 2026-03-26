import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';
import { DEFAULT_MAP_TYPES, DEFAULT_TOOLBAR_STYLE } from '../core/services/toolbar/config';
import type {
  CustomButtonConfig,
  MapType,
  MeasurementCallback,
  SearchCallback,
  ToolbarConfig,
  ZoomCallback,
} from '../core/types';
import { ToolbarService } from '../core/services/toolbar/ToolbarService';
import { DrawHelperAdapter } from './DrawHelperAdapter';
import { i18n, type I18nLike } from '../i18n';

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
      destination: Cesium.Cartesian3.fromDegrees(
        this.initialCenter.longitude,
        this.initialCenter.latitude,
        this.initialCenter.height,
      ),
      duration: 0,
    });
    this.callbacks?.resetLocation?.();
  }

  zoomIn(): void {
    const beforeHeight = this.viewer.camera.positionCartographic.height || 0;
    this.viewer.camera.zoomIn(Math.max(beforeHeight * 0.5, 100));
    const afterHeight = this.viewer.camera.positionCartographic.height || 0;
    this.callbacks?.zoom?.onZoomIn?.(beforeHeight, afterHeight, 0);
  }

  zoomOut(): void {
    const beforeHeight = this.viewer.camera.positionCartographic.height || 0;
    this.viewer.camera.zoomOut(Math.max(beforeHeight * 0.5, 100));
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
  private readonly config: ToolbarConfig;
  private readonly callbacks?: LegacyCesiumMapToolbarCallbacks;
  private readonly toolbarService: ToolbarService;
  private readonly drawHelper: DrawHelperAdapter;
  private readonly mapController: ToolbarAdapterMapController;
  private readonly i18nInstance: I18nLike;

  private currentMapType = 'img';

  public TD_Token = '';
  public mapTypes: MapType[] = DEFAULT_MAP_TYPES;

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
          onMapTypeChange: (mapTypeId) => this.setMapType(mapTypeId),
        },
      },
      {
        toolbarStyle: this.config,
        buttonConfigs: this.config.buttons,
      },
    );

    this.toolbarService.setLayersService({
      setMapType: (mapTypeId: string) => this.setMapType(mapTypeId),
    });
    this.toolbarService.initialize();
    this.toolbarService.setMapController(this.mapController);
  }

  private applyMapType(mapTypeId: string): void {
    const mapType = this.mapTypes.find((item) => item.id === mapTypeId);
    if (!mapType) {
      return;
    }

    this.viewer.imageryLayers.removeAll();
    mapType.provider(this.TD_Token).forEach((provider) => {
      this.viewer.imageryLayers.addImageryProvider(provider);
    });
    this.currentMapType = mapTypeId;
  }

  private syncLayersHandler(): void {
    const handler = this.toolbarService.getButtonHandler('layers') as any;
    if (!handler?.options) {
      return;
    }

    handler.options.mapTypes = this.mapTypes;
    handler.options.currentMapType = this.currentMapType;
    handler.options.token = this.TD_Token;
  }

  setMapType(mapTypeId: string): void {
    this.applyMapType(mapTypeId);
    this.syncLayersHandler();
  }

  public getToolbarService(): ToolbarService {
    return this.toolbarService;
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

  public destroy(): void {
    this.toolbarService.destroy();
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