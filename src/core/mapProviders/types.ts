import * as Cesium from 'cesium';
import type { ResolvedMapService } from './mapService';

export type BaseMapProviderId = 'tdt' | 'gaode' | 'tencent' | 'baidu' | 'google' | 'custom';
export type OnlineMapServiceProvider = 'tdt' | 'gaode' | 'tencent' | 'baidu' | 'google';
export type MapServiceProvider = OnlineMapServiceProvider | 'private';
export type CapabilityStatus = 'available' | 'unavailable' | 'unknown' | 'notChecked';
export type MapServiceValidationCode =
  | 'INVALID_CONFIG'
  | 'INVALID_CREDENTIALS'
  | 'NETWORK_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'CLIENT_RESTRICTION'
  | 'PROXY_REQUIRED';

export interface OnlineMapServiceConfig {
  provider: OnlineMapServiceProvider;
  serviceKey: string;
  secureKey?: string;
}

export interface PrivateMapServiceConfig {
  provider: 'private';
  offlineMapUrl: string;
  rectangle?: BaseMapRectangle;
  minimumLevel?: number;
  maximumLevel?: number;
  credit?: string;
  cameraBounds?: OfflineCameraBoundsConfig;
}

export type MapServiceConfig = OnlineMapServiceConfig | PrivateMapServiceConfig;

export interface MapServiceValidationResult {
  ok: boolean;
  provider: MapServiceProvider;
  code?: MapServiceValidationCode;
  capabilities: {
    basemap: {
      status: CapabilityStatus;
      credentialVerified?: boolean;
      message?: string;
    };
    search: {
      status: CapabilityStatus;
      requiresEnablement: boolean;
      requiredProduct?: string;
      setupUrl?: string;
      message?: string;
    };
  };
}

export interface MapServiceUpdateResult extends MapServiceValidationResult {
  changed: boolean;
}

export interface MapServiceValidationOptions {
  request?: (provider: MapServiceProvider, url: string, init?: RequestInit) => Promise<Response>;
  tdtValidationUrl?: string;
  googleValidationUrl?: string;
  privateProbeCoordinates?: {
    z: number;
    x: number;
    y: number;
  };
}

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
  service?: ResolvedMapService;
}
