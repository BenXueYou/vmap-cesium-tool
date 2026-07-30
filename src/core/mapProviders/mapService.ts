import type { BaseMapConfig, BaseMapProviderId, MapAuthConfig } from './types';

const clean = (value?: string) => (value || '').trim();

export interface ResolvedMapService {
  provider: BaseMapProviderId;
  baseMap: BaseMapConfig;
  auth?: MapAuthConfig;
  credentials: {
    serviceKey: string;
    secureKey: string;
    mapId: string;
  };
  isOffline: boolean;
}

export function normalizeProviderId(provider?: string): BaseMapProviderId {
  if (provider === 'tiandi') {
    return 'tdt';
  }
  if (provider === 'amap') {
    return 'gaode';
  }
  // 系统地图配置接口使用 private 表示离线地图，组件内部统一使用 custom。
  if (provider === 'private') {
    return 'custom';
  }
  if (
    provider === 'tencent'
    || provider === 'baidu'
    || provider === 'google'
    || provider === 'custom'
    || provider === 'gaode'
  ) {
    return provider;
  }
  return 'tdt';
}

export function buildDefaultBaseMap(provider: BaseMapProviderId = 'tdt'): BaseMapConfig {
  switch (provider) {
    case 'gaode':
      return { provider, type: 'satellite', showLabel: true };
    case 'tencent':
      return { provider, type: 'satellite', showLabel: true };
    case 'baidu':
      return { provider, type: 'satellite', showLabel: true };
    case 'google':
      return { provider, type: 'satellite', showLabel: true };
    case 'custom':
      return { provider, type: 'xyz', showLabel: false };
    default:
      return { provider: 'tdt', type: 'img', showLabel: true };
  }
}

export function normalizeMapAuth(mapAuth?: MapAuthConfig): MapAuthConfig | undefined {
  if (!mapAuth) {
    return undefined;
  }

  return {
    tdt: mapAuth.tdt ? { token: clean(mapAuth.tdt.token), sk: clean(mapAuth.tdt.sk) } : undefined,
    gaode: mapAuth.gaode
      ? { key: clean(mapAuth.gaode.key), securityKey: clean(mapAuth.gaode.securityKey) }
      : undefined,
    tencent: mapAuth.tencent ? { key: clean(mapAuth.tencent.key) } : undefined,
    baidu: mapAuth.baidu ? { ak: clean(mapAuth.baidu.ak) } : undefined,
    google: mapAuth.google
      ? { apiKey: clean(mapAuth.google.apiKey), mapId: clean(mapAuth.google.mapId) }
      : undefined,
  };
}

export function normalizeBaseMapConfig(baseMap: BaseMapConfig): BaseMapConfig {
  const provider = normalizeProviderId(baseMap.provider);
  return {
    ...buildDefaultBaseMap(provider),
    ...baseMap,
    provider,
    key: clean(baseMap.key),
    token: clean(baseMap.token),
    ak: clean(baseMap.ak),
    sk: clean(baseMap.sk),
    style: clean(baseMap.style),
    customUrl: clean(baseMap.customUrl),
    urlTemplate: clean(baseMap.urlTemplate),
    credit: clean(baseMap.credit),
    wmtsLayer: clean(baseMap.wmtsLayer),
    wmtsStyle: clean(baseMap.wmtsStyle),
    wmtsFormat: clean(baseMap.wmtsFormat),
    tileMatrixSetId: clean(baseMap.tileMatrixSetId),
  };
}

export function resolveServiceKey(
  baseMap: BaseMapConfig,
  auth: MapAuthConfig | undefined,
  provider: BaseMapProviderId,
): string {
  switch (provider) {
    case 'tdt':
      return clean(baseMap.token || baseMap.key || auth?.tdt?.token);
    case 'gaode':
      return clean(baseMap.key || baseMap.token || auth?.gaode?.key);
    case 'tencent':
      return clean(baseMap.key || baseMap.token || auth?.tencent?.key);
    case 'baidu':
      return clean(baseMap.ak || baseMap.key || baseMap.token || auth?.baidu?.ak);
    case 'google':
      return clean(baseMap.key || baseMap.token || auth?.google?.apiKey);
    default:
      return clean(baseMap.key || baseMap.token);
  }
}

export function resolveSecureKey(
  baseMap: BaseMapConfig,
  auth: MapAuthConfig | undefined,
  provider: BaseMapProviderId,
): string {
  switch (provider) {
    case 'gaode':
      return clean(baseMap.sk || auth?.gaode?.securityKey);
    case 'tdt':
      return clean(baseMap.sk || auth?.tdt?.sk);
    default:
      return clean(baseMap.sk);
  }
}

export function resolveLegacyMapService(input: {
  baseMap: BaseMapConfig;
  mapAuth?: MapAuthConfig;
}): ResolvedMapService {
  const auth = normalizeMapAuth(input.mapAuth);
  const baseMap = normalizeBaseMapConfig(input.baseMap);
  const provider = baseMap.provider;

  return {
    provider,
    baseMap,
    auth,
    credentials: {
      serviceKey: resolveServiceKey(baseMap, auth, provider),
      secureKey: resolveSecureKey(baseMap, auth, provider),
      mapId: clean(auth?.google?.mapId),
    },
    isOffline: provider === 'custom' && baseMap.mode === 'offline',
  };
}
