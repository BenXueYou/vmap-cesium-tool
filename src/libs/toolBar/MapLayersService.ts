import * as Cesium from 'cesium';
import type { Viewer, ImageryLayer } from 'cesium';
import type { MapType } from '../CesiumMapModel';
import type { I18nLike } from '../../libs/i18n';

/**
 * 图层服务配置接口
 */
export interface MapLayersServiceConfig {
  mapTypes: MapType[];
  currentMapType: string;
  token: string;
  isNoFlyZoneChecked: boolean;
  isNoFlyZoneVisible: boolean;
  i18n?: I18nLike;
  useI18n?: boolean;
  onMapTypeChange?: (mapTypeId: string) => void;
  onShowNoFlyZones?: () => Promise<void> | void;
  onNoFlyZoneToggle?: (isChecked: boolean) => void;
}

/**
 * 图层服务 - 存根实现
 * 为了保持向后兼容性
 */
export class MapLayersService {
  private viewer: Viewer;
  private toolbarElement: HTMLElement;
  private config: MapLayersServiceConfig;

  constructor(viewer: Viewer, toolbarElement: HTMLElement, config: MapLayersServiceConfig) {
    this.viewer = viewer;
    this.toolbarElement = toolbarElement;
    this.config = config;
  }

  bootstrapCurrentMapContext(): void {
    // 存根实现
  }

  switchMapType(mapTypeId: string): void {
    // 存根实现
  }

  togglePlaceName(): void {
    // 存根实现
  }

  showNoFlyZones(): void {
    // 存根实现
  }

  toggleNoFlyZoneVisibility(): void {
    // 存根实现
  }

  closeLayersMenu(): void {
    // 存根实现 - 保持向后兼容
  }

  toggleLayers(buttonElement: HTMLElement): void {
    // 存根实现 - 保持向后兼容
  }

  updateConfig(config: Partial<MapLayersServiceConfig>): void {
    // 存根实现 - 保持向后兼容
    Object.assign(this.config, config);
  }
}