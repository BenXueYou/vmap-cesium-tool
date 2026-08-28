import type { BaseMapConfig, MapPluginOptions, MapServiceConfig } from '../src/core/types';

export type PlaygroundMapProvider = 'tdt' | 'tencent' | 'gaode' | 'baidu';

const PLAYGROUND_MAP_SERVICES: Record<PlaygroundMapProvider, MapServiceConfig> = {
  tdt: {
    provider: 'tdt',
    serviceKey: '9bf1c44688768ee36bfbafa00e02bb40 ',
    secureKey: 'e5f627c86ca6ab33ce900ae479f04a2f',
  },
  tencent: {
    provider: 'tencent',
    serviceKey: '3Y3BZ-WXTLA-BV6KT-COBRB-4GXKO-7MFQC',
  },
  gaode: {
    provider: 'gaode',
    serviceKey: '083cf2fc37d04fc1d4f45b4ea2a5d1e8',
    secureKey: '85f329e4b2f551232cd24862c753055f',
  },
  baidu: {
    provider: 'baidu',
    serviceKey: 'EUkH01uiDGZJ015Ko3El9L4yfBIyj2Fl', // 服务端：EUkH01uiDGZJ015Ko3El9L4yfBIyj2Fl、浏览器端：8c4RjhGrynydOwm1NSTBW8gt1DTE1riA
  },
};

export function buildPlaygroundMapService(provider: PlaygroundMapProvider): MapServiceConfig {
  const mapService = PLAYGROUND_MAP_SERVICES[provider];
  return { ...mapService };
}

function mapServiceToBaseMap(mapService: MapServiceConfig): BaseMapConfig {
  switch (mapService.provider) {
    case 'gaode':
      return {
        provider: 'gaode',
        type: 'satellite',
        key: mapService.serviceKey,
        sk: mapService.secureKey,
        showLabel: true,
      };
    case 'tencent':
      return {
        provider: 'tencent',
        type: 'satellite',
        key: mapService.serviceKey,
        showLabel: true,
      };
    case 'baidu':
      return {
        provider: 'baidu',
        type: 'satellite',
        ak: mapService.serviceKey,
        showLabel: true,
      };
    case 'private':
      return {
        provider: 'custom',
        type: 'xyz',
        mode: 'offline',
        urlTemplate: mapService.offlineMapUrl,
        rectangle: mapService.rectangle,
        minimumLevel: mapService.minimumLevel,
        maximumLevel: mapService.maximumLevel,
        credit: mapService.credit,
        cameraBounds: mapService.cameraBounds,
        showLabel: false,
      };
    case 'tdt':
    default:
      return {
        provider: 'tdt',
        type: 'img',
        token: mapService.serviceKey,
        sk: mapService.secureKey,
        showLabel: true,
      };
  }
}

export function resolvePlaygroundBaseMap(options: Partial<MapPluginOptions>): BaseMapConfig {
  if (options.mapService) {
    return mapServiceToBaseMap(options.mapService);
  }

  if (options.baseMap) {
    return options.baseMap as BaseMapConfig;
  }

  switch (options.layers?.type) {
    case 'gaode':
      return {
        provider: 'gaode',
        type: options.layers.gaode?.mapTypeId || 'satellite',
        key: options.layers.gaode?.token,
        sk: options.layers.gaode?.sk,
        showLabel: options.layers.gaode?.showLabel ?? true,
      };
    case 'tencent':
      return {
        provider: 'tencent',
        type: options.layers.tencent?.mapTypeId || 'satellite',
        key: options.layers.tencent?.key || options.layers.tencent?.token,
        showLabel: options.layers.tencent?.showLabel ?? true,
      };
    case 'baidu':
      return {
        provider: 'baidu',
        type: options.layers.baidu?.mapTypeId || 'satellite',
        ak: options.layers.baidu?.token,
        sk: options.layers.baidu?.sk,
        showLabel: options.layers.baidu?.showLabel ?? true,
      };
    default:
      return {
        provider: 'tdt',
        type: options.layers?.tdt?.mapTypeId || 'img',
        token: options.layers?.tdt?.token,
        sk: options.layers?.tdt?.sk,
        showLabel: options.layers?.tdt?.showLabel ?? true,
      };
  }
}
