import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';
import { createMapPlugin, type MapPlugin } from '../core/MapPlugin';
import type { MapPluginOptions } from '../core/types';

export interface LegacyMapCenter {
  latitude: number;
  longitude: number;
  height: number;
  pitch?: number;
  heading?: number;
}

export interface LegacyInitOptions {
  viewerOptions?: Cesium.Viewer.ConstructorOptions;
  mapType?: string;
  tdtMapTypeId?: string;
  token?: string;
  cesiumToken?: string;
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
  [key: string]: unknown;
}

export interface LegacyInitResult {
  viewer: Viewer;
  initialCenter: LegacyMapCenter;
  mapPlugin: MapPlugin;
}

function resolveInitialCenter(
  options: LegacyInitOptions,
  mapCenterOrCesiumToken?: LegacyMapCenter | string,
): LegacyMapCenter {
  if (mapCenterOrCesiumToken && typeof mapCenterOrCesiumToken === 'object') {
    return mapCenterOrCesiumToken;
  }

  return options.mapCenter || {
    longitude: 120.2052342,
    latitude: 30.2489634,
    height: 1000,
    pitch: -45,
    heading: 0,
  };
}

function resolveCesiumToken(
  options: LegacyInitOptions,
  mapCenterOrCesiumToken?: LegacyMapCenter | string,
  cesiumToken?: string,
): string | undefined {
  if (typeof mapCenterOrCesiumToken === 'string') {
    return mapCenterOrCesiumToken;
  }

  return options.cesiumToken || cesiumToken;
}

function toMapPluginOptions(options: LegacyInitOptions, initialCenter: LegacyMapCenter): Partial<MapPluginOptions> {
  const viewerOptions: Cesium.Viewer.ConstructorOptions = {
    ...(options.viewerOptions || {}),
    animation: options.animation as boolean | undefined,
    timeline: options.timeline as boolean | undefined,
    navigationHelpButton: options.navigationHelpButton as boolean | undefined,
    fullscreenButton: options.fullscreenButton as boolean | undefined,
    geocoder: options.geocoder as boolean | undefined,
    homeButton: options.homeButton as boolean | undefined,
    infoBox: options.infoBox as boolean | undefined,
    sceneModePicker: options.sceneModePicker as boolean | undefined,
    baseLayerPicker: options.baseLayerPicker as boolean | undefined,
    selectionIndicator: options.selectionIndicator as boolean | undefined,
  };

  const mapType = options.mapType === 'tiandi' || options.tdtMapTypeId ? 'tdt' : undefined;

  return {
    viewerOptions,
    cesiumToken: options.cesiumToken,
    camera: {
      center: [initialCenter.longitude, initialCenter.latitude, initialCenter.height],
      pitch: initialCenter.pitch ?? -45,
      heading: initialCenter.heading ?? 0,
    },
    layers: mapType ? {
      type: 'tdt',
      tdt: {
        mapTypeId: (options.tdtMapTypeId as 'vec' | 'img' | 'ter' | undefined) || 'img',
        token: options.token || '',
        showLabel: true,
      },
    } : undefined,
  };
}

/**
 * initCesium 兼容适配器。
 * 旧函数签名保持不变，内部切换到 MapPlugin。
 */
export async function initCesium(
  containerId: string,
  options: LegacyInitOptions = {},
  mapCenterOrCesiumToken?: LegacyMapCenter | string,
  cesiumToken?: string,
): Promise<LegacyInitResult> {
  const initialCenter = resolveInitialCenter(options, mapCenterOrCesiumToken);
  const resolvedCesiumToken = resolveCesiumToken(options, mapCenterOrCesiumToken, cesiumToken);
  const mapPlugin = createMapPlugin(containerId, {
    ...toMapPluginOptions(options, initialCenter),
    cesiumToken: resolvedCesiumToken,
  });
  const viewer = await mapPlugin.initialize();

  if (options.isFly) {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(initialCenter.longitude, initialCenter.latitude, initialCenter.height),
      orientation: {
        heading: Cesium.Math.toRadians(initialCenter.heading || 0),
        pitch: Cesium.Math.toRadians(initialCenter.pitch || -45),
      },
      duration: options.flyDuration || 3,
      complete: options.success,
      cancel: options.cancel,
    });
  }

  (viewer as Viewer & { __vmapMapPlugin?: MapPlugin }).__vmapMapPlugin = mapPlugin;

  return {
    viewer,
    initialCenter,
    mapPlugin,
  };
}