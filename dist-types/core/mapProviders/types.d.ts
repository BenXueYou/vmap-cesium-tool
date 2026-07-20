import * as Cesium from 'cesium';
export type BaseMapProviderId = 'tdt' | 'gaode' | 'tencent' | 'baidu' | 'google' | 'custom';
export interface BaseMapRectangle {
    west: number;
    south: number;
    east: number;
    north: number;
}
export interface OfflineCameraBoundsConfig {
    enabled?: boolean;
    clamp?: boolean;
    enableTilt?: boolean;
    minimumZoomDistance?: number;
    maximumZoomDistance?: number;
    initialFlyTo?: boolean;
    initialHeight?: number;
}
export interface BaseMapConfig {
    provider: BaseMapProviderId;
    type?: string;
    key?: string;
    token?: string;
    ak?: string;
    sk?: string;
    style?: string;
    subdomains?: string[];
    customUrl?: string;
    urlTemplate?: string;
    rectangle?: BaseMapRectangle;
    minimumLevel?: number;
    maximumLevel?: number;
    credit?: string;
    cameraBounds?: OfflineCameraBoundsConfig;
    mode?: 'online' | 'offline';
    showLabel?: boolean;
    providers?: Cesium.ImageryProvider[];
    wmtsLayer?: string;
    wmtsStyle?: string;
    wmtsFormat?: string;
    tileMatrixSetId?: string;
}
export interface MapAuthConfig {
    tdt?: {
        token?: string;
        sk?: string;
    };
    gaode?: {
        key?: string;
        securityKey?: string;
    };
    tencent?: {
        key?: string;
    };
    baidu?: {
        ak?: string;
    };
    google?: {
        apiKey?: string;
        mapId?: string;
    };
}
export interface MapProviderContext {
    viewer?: Cesium.Viewer;
    baseMap: BaseMapConfig;
    auth?: MapAuthConfig;
}
