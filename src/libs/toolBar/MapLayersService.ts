import * as Cesium from 'cesium';
import type { Viewer, ImageryLayer } from 'cesium';
import type { MapType } from '../CesiumMapModel';
import type { I18nLike } from '../../i18n';

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
  private menuElement: HTMLElement | null = null;

  constructor(viewer: Viewer, toolbarElement: HTMLElement, config: MapLayersServiceConfig) {
    this.viewer = viewer;
    this.toolbarElement = toolbarElement;
    this.config = config;
  }

  bootstrapCurrentMapContext(): void {
    this.config.onMapTypeChange?.(this.config.currentMapType);
  }

  switchMapType(mapTypeId: string): void {
    this.config.currentMapType = mapTypeId;
    this.config.onMapTypeChange?.(mapTypeId);
    this.closeLayersMenu();
  }

  togglePlaceName(): void {
    // 存根实现
  }

  showNoFlyZones(): void {
    void this.config.onShowNoFlyZones?.();
  }

  toggleNoFlyZoneVisibility(): void {
    const isChecked = !this.config.isNoFlyZoneChecked;
    this.config.isNoFlyZoneChecked = isChecked;
    this.config.onNoFlyZoneToggle?.(isChecked);
  }

  closeLayersMenu(): void {
    if (!this.menuElement) {
      return;
    }

    this.menuElement.remove();
    this.menuElement = null;
  }

  toggleLayers(buttonElement: HTMLElement): void {
    if (this.menuElement) {
      this.closeLayersMenu();
      return;
    }

    const menu = document.createElement('div');
    menu.className = 'cesium-map-toolbar-layers';
    menu.style.cssText = [
      'position:absolute',
      `top:${buttonElement.offsetTop}px`,
      'right:calc(100% + 8px)',
      'min-width:180px',
      'padding:8px',
      'background:rgba(7, 26, 48, 0.94)',
      'border:1px solid rgba(87, 164, 255, 0.35)',
      'border-radius:8px',
      'box-shadow:0 8px 20px rgba(0, 0, 0, 0.24)',
      'z-index:1001'
    ].join(';');

    this.config.mapTypes.forEach((mapType) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.textContent = mapType.name;
      item.style.cssText = [
        'display:block',
        'width:100%',
        'padding:8px 10px',
        'margin-bottom:4px',
        'text-align:left',
        'color:#fff',
        'background:transparent',
        'border:0',
        'border-radius:6px',
        'cursor:pointer'
      ].join(';');
      if (mapType.id === this.config.currentMapType) {
        item.style.background = 'rgba(87, 164, 255, 0.24)';
      }
      item.addEventListener('click', () => this.switchMapType(mapType.id));
      menu.appendChild(item);
    });

    const noFlyItem = document.createElement('label');
    noFlyItem.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:8px',
      'padding:8px 10px',
      'color:#fff',
      'cursor:pointer'
    ].join(';');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = this.config.isNoFlyZoneChecked;
    checkbox.addEventListener('change', () => this.toggleNoFlyZoneVisibility());

    const text = document.createElement('span');
    text.textContent = this.config.useI18n && this.config.i18n
      ? this.config.i18n.t('layers.no_fly_zone')
      : '禁飞区';

    noFlyItem.appendChild(checkbox);
    noFlyItem.appendChild(text);
    menu.appendChild(noFlyItem);

    this.toolbarElement.appendChild(menu);
    this.menuElement = menu;
  }

  updateConfig(config: Partial<MapLayersServiceConfig>): void {
    Object.assign(this.config, config);
  }

  destroy(): void {
    this.closeLayersMenu();
  }
}