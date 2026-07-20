import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';
import { type MapPlugin } from '../core/MapPlugin';
import type { BaseMapConfig, MapAuthConfig } from '../core/types';
export interface LegacyMapCenter {
    latitude: number;
    longitude: number;
    height: number;
    pitch?: number;
    heading?: number;
    coordSystem?: 'WGS84' | 'GCJ02' | 'BD09';
}
export interface LegacyInitOptions {
    viewerOptions?: Cesium.Viewer.ConstructorOptions;
    mapType?: string;
    tdtMapTypeId?: string;
    token?: string;
    TD_Token?: string;
    sk?: string;
    TD_SK?: string;
    cesiumToken?: string;
    terrainProvider?: Cesium.TerrainProvider | null;
    requestRenderMode?: boolean;
    maximumRenderTimeChange?: number;
    showRenderLoopErrors?: boolean;
    useBrowserRecommendedResolution?: boolean;
    automaticallyTrackDataSourceClocks?: boolean;
    contextOptions?: Cesium.ContextOptions;
    resolutionScale?: number;
    depthTestAgainstTerrain?: boolean;
    fxaa?: boolean;
    loadNoFlyZonesOnInit?: boolean;
    mapCenter?: LegacyMapCenter;
    isFly?: boolean;
    flyDuration?: number;
    success?: () => void;
    cancel?: () => void;
    animation?: boolean;
    timeline?: boolean;
    navigationHelpButton?: boolean;
    fullscreenButton?: boolean;
    geocoder?: boolean;
    homeButton?: boolean;
    infoBox?: boolean;
    sceneModePicker?: boolean;
    baseLayerPicker?: boolean;
    selectionIndicator?: boolean;
    baseMap?: BaseMapConfig;
    mapAuth?: MapAuthConfig;
    [key: string]: unknown;
}
export interface LegacyInitResult {
    viewer: Viewer;
    initialCenter: LegacyMapCenter;
    mapPlugin: MapPlugin;
}
/**
 * initCesium 兼容适配器。
 * 旧函数签名保持不变，内部切换到 MapPlugin。
 */
export declare function initCesium(containerId: string, options?: LegacyInitOptions, mapCenterOrCesiumToken?: LegacyMapCenter | string, cesiumToken?: string): Promise<LegacyInitResult>;
