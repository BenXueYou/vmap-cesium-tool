import type { Viewer } from 'cesium';
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
export declare class MapLayersService {
    private viewer;
    private toolbarElement;
    private config;
    private menuElement;
    constructor(viewer: Viewer, toolbarElement: HTMLElement, config: MapLayersServiceConfig);
    bootstrapCurrentMapContext(): void;
    switchMapType(mapTypeId: string): void;
    togglePlaceName(): void;
    showNoFlyZones(): void;
    toggleNoFlyZoneVisibility(): void;
    closeLayersMenu(): void;
    toggleLayers(buttonElement: HTMLElement): void;
    updateConfig(config: Partial<MapLayersServiceConfig>): void;
    destroy(): void;
}
