import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';
import { createMapPlugin, type MapPlugin } from '../core/MapPlugin';
import type { BaseMapConfig, LayersConfig, MapAuthConfig, MapPluginOptions, TDTMapTypeId } from '../core/types';
import { buildDefaultBaseMap, normalizeProviderId } from '../core/mapProviders/registry';
import { lngLatToCartesian } from '../core/mapProviders/coordinates/cesium';

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
  return options.cesiumToken
    || (typeof mapCenterOrCesiumToken === 'string' ? mapCenterOrCesiumToken : undefined)
    || cesiumToken;
}

function resolveTdtToken(options: LegacyInitOptions): string {
  return options.token || options.TD_Token || '';
}

function resolveTdtSk(options: LegacyInitOptions): string | undefined {
  return options.sk || options.TD_SK || undefined;
}

function resolveBaseMapFromLegacyMapType(mapType: string, options: LegacyInitOptions): BaseMapConfig | undefined {
  switch (normalizeProviderId(mapType)) {
    case 'gaode':
      return { provider: 'gaode', type: 'satellite', showLabel: true };
    case 'tencent':
      return { provider: 'tencent', type: 'satellite', showLabel: true };
    case 'baidu':
      return { provider: 'baidu', type: 'satellite', showLabel: true };
    case 'google':
      return { provider: 'google', type: 'satellite', showLabel: false };
    case 'custom':
      return options.mapType === 'private'
        ? {
          provider: 'custom',
          type: 'xyz',
          mode: 'offline',
          urlTemplate: options.baseMap?.urlTemplate,
          rectangle: options.baseMap?.rectangle,
          minimumLevel: options.baseMap?.minimumLevel,
          maximumLevel: options.baseMap?.maximumLevel,
          credit: options.baseMap?.credit,
          cameraBounds: options.baseMap?.cameraBounds,
          showLabel: false,
        }
        : {
          provider: 'custom',
          type: 'xyz',
          showLabel: false,
        };
    default:
      return undefined;
  }
}

function buildViewerOptions(options: LegacyInitOptions): Cesium.Viewer.ConstructorOptions {
  const viewerOptions = options.viewerOptions as (Cesium.Viewer.ConstructorOptions & Record<string, any>) | undefined;
  const defaultContextOptions = {
    webgl: {
      preserveDrawingBuffer: true,
    },
  } as Cesium.ContextOptions;

  const mergedContextOptions = {
    ...defaultContextOptions,
    ...(options.viewerOptions?.contextOptions || {}),
    ...(options.contextOptions || {}),
    webgl: {
      ...defaultContextOptions.webgl,
      ...(options.viewerOptions?.contextOptions?.webgl || {}),
      ...(options.contextOptions?.webgl || {}),
    },
  } as Cesium.ContextOptions;

  return {
    ...(viewerOptions || {}),
    animation: options.animation ?? viewerOptions?.animation,
    timeline: options.timeline ?? viewerOptions?.timeline,
    navigationHelpButton: options.navigationHelpButton ?? viewerOptions?.navigationHelpButton,
    fullscreenButton: options.fullscreenButton ?? viewerOptions?.fullscreenButton,
    geocoder: options.geocoder ?? viewerOptions?.geocoder,
    homeButton: options.homeButton ?? viewerOptions?.homeButton,
    infoBox: options.infoBox ?? viewerOptions?.infoBox,
    sceneModePicker: options.sceneModePicker ?? viewerOptions?.sceneModePicker,
    baseLayerPicker: options.baseLayerPicker ?? viewerOptions?.baseLayerPicker,
    selectionIndicator: options.selectionIndicator ?? viewerOptions?.selectionIndicator,
    terrainProvider: options.terrainProvider ?? viewerOptions?.terrainProvider,
    requestRenderMode: options.requestRenderMode ?? viewerOptions?.requestRenderMode,
    maximumRenderTimeChange: options.maximumRenderTimeChange ?? viewerOptions?.maximumRenderTimeChange,
    showRenderLoopErrors: options.showRenderLoopErrors ?? viewerOptions?.showRenderLoopErrors,
    useBrowserRecommendedResolution: options.useBrowserRecommendedResolution ?? viewerOptions?.useBrowserRecommendedResolution,
    automaticallyTrackDataSourceClocks: options.automaticallyTrackDataSourceClocks ?? viewerOptions?.automaticallyTrackDataSourceClocks,
    resolutionScale: options.resolutionScale ?? viewerOptions?.resolutionScale,
    contextOptions: mergedContextOptions,
  } as Cesium.Viewer.ConstructorOptions;
}

function baseMapToLegacyLayers(baseMap: BaseMapConfig | undefined, options: LegacyInitOptions): LayersConfig | undefined {
  if (!baseMap) return undefined;

  const showLabel = baseMap.showLabel;
  switch (baseMap.provider) {
    case 'tdt':
      return {
        type: 'tdt',
        tdt: {
          mapTypeId: (baseMap.type as TDTMapTypeId | undefined) || 'img',
          token: baseMap.token || resolveTdtToken(options),
          sk: baseMap.sk || resolveTdtSk(options),
          showLabel: showLabel ?? true,
        },
      };
    case 'gaode':
      return {
        type: 'gaode',
        gaode: {
          mapTypeId: (baseMap.type as 'vector' | 'satellite' | 'terrain' | undefined) || 'satellite',
          token: baseMap.key || baseMap.token,
          sk: baseMap.sk,
          showLabel: showLabel ?? true,
        },
      };
    case 'tencent':
      return {
        type: 'tencent',
        tencent: {
          mapTypeId: (baseMap.type as 'vector' | 'satellite' | undefined) || 'satellite',
          key: baseMap.key,
          token: baseMap.token,
          showLabel: showLabel ?? true,
        },
      };
    case 'baidu':
      return {
        type: 'baidu',
        baidu: {
          mapTypeId: (baseMap.type as 'normal' | 'satellite' | 'terrain' | undefined) || 'satellite',
          token: baseMap.ak || baseMap.key || baseMap.token,
          sk: baseMap.sk,
          showLabel: showLabel ?? true,
        },
      };
    case 'google':
      return {
        type: 'google',
        google: {
          mapTypeId: (baseMap.type as 'roadmap' | 'satellite' | undefined) || 'roadmap',
          apiKey: baseMap.key || baseMap.token,
          showLabel: showLabel ?? false,
        },
      };
    case 'custom':
      return {
        type: 'custom',
        custom: {
          providers: baseMap.providers || [],
          type: baseMap.type as 'xyz' | 'wmts' | 'imageryProviders' | undefined,
          mode: baseMap.mode,
          customUrl: baseMap.customUrl,
          urlTemplate: baseMap.urlTemplate,
          rectangle: baseMap.rectangle,
          minimumLevel: baseMap.minimumLevel,
          maximumLevel: baseMap.maximumLevel,
          credit: baseMap.credit,
          cameraBounds: baseMap.cameraBounds,
          wmtsLayer: baseMap.wmtsLayer,
          wmtsStyle: baseMap.wmtsStyle,
          wmtsFormat: baseMap.wmtsFormat,
          tileMatrixSetId: baseMap.tileMatrixSetId,
        },
      };
  }
}

function buildMapPluginOptions(options: LegacyInitOptions, initialCenter: LegacyMapCenter): Partial<MapPluginOptions> {
  const mapType = options.mapType || (options.tdtMapTypeId ? 'tiandi' : '');
  const normalizedProvider = options.baseMap?.provider
    ? normalizeProviderId(options.baseMap.provider)
    : undefined;
  const inferredBaseMap = !options.baseMap && mapType
    ? resolveBaseMapFromLegacyMapType(mapType, options)
    : undefined;
  const baseMap = options.baseMap
    ? {
      ...buildDefaultBaseMap(normalizedProvider),
      ...options.baseMap,
      provider: normalizedProvider || 'tdt',
    }
    : inferredBaseMap;

  return {
    viewerOptions: buildViewerOptions(options),
    cesiumToken: options.cesiumToken,
    camera: {
      center: [initialCenter.longitude, initialCenter.latitude, initialCenter.height],
      pitch: initialCenter.pitch ?? -45,
      heading: initialCenter.heading ?? 0,
    },
    noFlyZone: typeof options.loadNoFlyZonesOnInit === 'boolean'
      ? {
        autoLoad: options.loadNoFlyZonesOnInit,
        visible: options.loadNoFlyZonesOnInit,
      }
      : undefined,
    baseMap,
    mapAuth: options.mapAuth,
    layers: baseMapToLegacyLayers(baseMap, options),
  };
}

function applyLegacyRuntimeOptions(viewer: Viewer, options: LegacyInitOptions): void {
  const scene = viewer.scene;
  const resolvedShowRenderLoopErrors = options.showRenderLoopErrors ?? options.viewerOptions?.showRenderLoopErrors ?? false;
  const resolvedUseBrowserRecommendedResolution = options.useBrowserRecommendedResolution ?? options.viewerOptions?.useBrowserRecommendedResolution ?? false;
  const resolvedAutomaticallyTrackDataSourceClocks = options.automaticallyTrackDataSourceClocks ?? options.viewerOptions?.automaticallyTrackDataSourceClocks ?? false;
  const resolvedDepthTestAgainstTerrain = options.depthTestAgainstTerrain ?? false;
  const resolvedFxaa = options.fxaa ?? true;

  if (options.maximumRenderTimeChange !== undefined) {
    scene.maximumRenderTimeChange = options.maximumRenderTimeChange;
  }

  if (options.requestRenderMode !== undefined) {
    scene.requestRenderMode = options.requestRenderMode;
  }

  (viewer as Viewer & { showRenderLoopErrors?: boolean }).showRenderLoopErrors = resolvedShowRenderLoopErrors;
  (viewer as Viewer & { useBrowserRecommendedResolution?: boolean }).useBrowserRecommendedResolution = resolvedUseBrowserRecommendedResolution;
  (viewer as Viewer & { automaticallyTrackDataSourceClocks?: boolean }).automaticallyTrackDataSourceClocks = resolvedAutomaticallyTrackDataSourceClocks;

  if (options.resolutionScale !== undefined) {
    (viewer as Viewer & { resolutionScale?: number }).resolutionScale = options.resolutionScale;
  }

  scene.globe.depthTestAgainstTerrain = resolvedDepthTestAgainstTerrain;

  scene.postProcessStages.fxaa.enabled = resolvedFxaa;
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
    ...buildMapPluginOptions(options, initialCenter),
    cesiumToken: resolvedCesiumToken,
  });

  const viewer = await mapPlugin.initialize();
  applyLegacyRuntimeOptions(viewer, options);

  if (options.isFly) {
    const legacySuccess = options.success;
    viewer.camera.flyTo({
      destination: lngLatToCartesian({
        longitude: initialCenter.longitude,
        latitude: initialCenter.latitude,
        height: initialCenter.height,
      }, initialCenter.coordSystem || 'WGS84'),
      orientation: {
        heading: Cesium.Math.toRadians(initialCenter.heading || 0),
        pitch: Cesium.Math.toRadians(initialCenter.pitch || -45),
      },
      duration: options.flyDuration || 3,
      complete: () => {
        if (typeof legacySuccess === 'function') {
          setTimeout(() => {
            legacySuccess();
          }, 0);
        }
      },
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
