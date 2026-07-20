import type { Viewer } from 'cesium';
import type { CustomButtonConfig, MapType, MapAuthConfig, MeasurementCallback, SearchCallback, ToolbarConfig, ZoomCallback } from '../core/types';
import { ToolbarService } from '../core/services/toolbar/ToolbarService';
import type { LayersServiceBridge } from '../core/MapPlugin';
import { SearchService as LegacySearchService } from '../libs/toolBar/MapSearchService';
import { MeasurementService as LegacyMeasurementService } from '../libs/toolBar/MeasurementService';
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
declare class ToolbarAdapterMapController {
    private readonly viewer;
    private initialCenter;
    private readonly callbacks?;
    constructor(viewer: Viewer, initialCenter: LegacyInitialCenter, callbacks?: {
        zoom?: ZoomCallback;
        fullscreen?: (isFullscreen: boolean) => void;
        resetLocation?: () => void;
    } | undefined);
    toggle2D3D(): void;
    resetLocation(): void;
    zoomIn(): void;
    zoomOut(): void;
    toggleFullscreen(): void;
    setInitialCenter(center: LegacyInitialCenter): void;
    getInitialCenter(): LegacyInitialCenter;
}
/**
 * CesiumMapToolbar 兼容适配器。
 * 旧类名仍可继续使用，但内部已经转调新的 ToolbarService。
 */
export declare class ToolbarAdapter {
    private readonly viewer;
    private readonly container;
    private readonly config;
    private readonly callbacks?;
    private readonly toolbarService;
    private readonly drawHelper;
    private readonly mapController;
    private readonly i18nInstance;
    private readonly mapPlugin;
    private searchService;
    private measurementService;
    private layersServiceBridge;
    private currentMapType;
    private placeNameVisible;
    private noFlyZoneVisible;
    TD_Token: string;
    TD_SK: string;
    mapTypes: MapType[];
    readonly measurement: {
        getMeasureMode: () => "none" | "distance" | "area";
    };
    private resolveToolbarMapTypesFromPlugin;
    constructor(viewer: Viewer, container: HTMLElement, config?: ToolbarConfig, callbacks?: LegacyCesiumMapToolbarCallbacks, initialCenter?: LegacyInitialCenter);
    private getLayersButtonCallback;
    private emitLayersButtonCallback;
    private syncLayersHandler;
    private syncTdtAuthToMapPlugin;
    private createLayersServiceBridge;
    private applyMapTypeDirectly;
    getSearchService(): LegacySearchService | null;
    getMeasurementService(): LegacyMeasurementService | null;
    getMapLayersService(): LegacyMapLayersBridge | LayersServiceBridge | null;
    setMapType(mapTypeId: string): void;
    getToolbarService(): ToolbarService;
    getToolbarElement(): HTMLElement | null;
    getCesiumMapCtrl(): ToolbarAdapterMapController;
    setMapTypes(mapTypes: MapType[]): void;
    setTDToken(token: string): void;
    setTDSK(sk: string): void;
    setTDTAuth(token: string, sk?: string): void;
    setMapAuth(auth: MapAuthConfig): void;
    setBaseMapProvider(provider: 'tdt' | 'gaode' | 'tencent' | 'baidu' | 'google' | 'custom', type?: string): void;
    setInitialCenter(center: LegacyInitialCenter): void;
    getInitialCenter(): LegacyInitialCenter;
    resetToInitialLocation(): void;
    updateButtonConfig(buttonId: string, config: Partial<CustomButtonConfig>): void;
    addCustomButton(config: CustomButtonConfig): void;
    removeButton(buttonId: string): void;
    showButton(buttonId: string): void;
    hideButton(buttonId: string): void;
    enableButton(buttonId: string): void;
    disableButton(buttonId: string): void;
    showNoFlyZones(): Promise<void>;
    hideNoFlyZones(): void;
    toggleNoFlyZones(): Promise<void>;
    getNoFlyZoneVisible(): boolean;
    destroy(): void;
}
export declare function createToolbarAdapter(viewer: Viewer, container: HTMLElement, config?: ToolbarConfig, callbacks?: LegacyCesiumMapToolbarCallbacks, initialCenter?: LegacyInitialCenter): ToolbarAdapter;
export {};
