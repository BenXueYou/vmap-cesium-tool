import type {
  MapServiceConfig,
  MapServiceProvider,
  MapServiceValidationCode,
  MapServiceValidationOptions,
  MapServiceValidationResult,
} from './types';
import {
  MapServiceConfigError,
  normalizeMapServiceConfig,
} from './mapService';

const DEFAULT_TDT_VALIDATION_URL = 'https://t0.tianditu.gov.cn/img_w/wmts';
const DEFAULT_GOOGLE_VALIDATION_URL = 'https://tile.googleapis.com/v1/createSession';
const ONLINE_PROVIDERS: MapServiceProvider[] = ['tdt', 'gaode', 'tencent', 'baidu', 'google', 'private'];

const SEARCH_CAPABILITY_BY_PROVIDER: Record<MapServiceProvider, MapServiceValidationResult['capabilities']['search']> = {
  tdt: {
    status: 'notChecked',
    requiresEnablement: true,
    requiredProduct: '天地图搜索服务',
    setupUrl: 'https://lbs.tianditu.gov.cn/server/search.html',
    message: '底图校验不包含地点搜索；使用工具栏搜索前请确认已开通天地图搜索服务。',
  },
  gaode: {
    status: 'notChecked',
    requiresEnablement: true,
    requiredProduct: '高德 Web 服务 API / 搜索 POI',
    setupUrl: 'https://lbs.amap.com/api/webservice/guide/api/search',
    message: '底图校验不包含地点搜索；使用工具栏搜索前请确认已开通高德 Web 服务搜索能力。',
  },
  tencent: {
    status: 'notChecked',
    requiresEnablement: true,
    requiredProduct: '腾讯位置服务 WebService / 地点搜索',
    setupUrl: 'https://lbs.qq.com/service/webService/webServiceGuide/webServiceSearch',
    message: '底图校验不包含地点搜索；使用工具栏搜索前请确认已开通腾讯地点搜索能力。',
  },
  baidu: {
    status: 'notChecked',
    requiresEnablement: true,
    requiredProduct: '百度 Place API / 地点检索',
    setupUrl: 'https://lbsyun.baidu.com/index.php?title=webapi/guide/webservice-placeapi',
    message: '底图校验不包含地点搜索；使用工具栏搜索前请确认已开通百度地点检索能力。',
  },
  google: {
    status: 'notChecked',
    requiresEnablement: true,
    requiredProduct: 'Google Places API (New) / Text Search',
    setupUrl: 'https://developers.google.com/maps/documentation/places/web-service/text-search',
    message: '底图校验不包含地点搜索；使用工具栏搜索前请确认已启用 Google Places API (New)。',
  },
  private: {
    status: 'unavailable',
    requiresEnablement: false,
    message: '私有地图服务不提供厂商地点搜索能力。',
  },
};

function cloneSearchCapability(provider: MapServiceProvider): MapServiceValidationResult['capabilities']['search'] {
  return { ...SEARCH_CAPABILITY_BY_PROVIDER[provider] };
}

export function getDefaultMapServiceSearchCapability(
  provider: MapServiceProvider,
): MapServiceValidationResult['capabilities']['search'] {
  return cloneSearchCapability(provider);
}

type ValidationResultOverrides = Partial<Omit<MapServiceValidationResult, 'capabilities' | 'provider'>> & {
  capabilities?: {
    basemap?: Partial<MapServiceValidationResult['capabilities']['basemap']>;
    search?: Partial<MapServiceValidationResult['capabilities']['search']>;
  };
};

function createResult(
  provider: MapServiceProvider,
  overrides: ValidationResultOverrides,
): MapServiceValidationResult {
  return {
    ok: overrides.ok ?? false,
    provider,
    code: overrides.code,
    capabilities: {
      basemap: {
        status: 'unknown',
        ...overrides.capabilities?.basemap,
      },
      search: {
        ...cloneSearchCapability(provider),
        ...overrides.capabilities?.search,
      },
    },
  };
}

function resolveProvider(input: MapServiceConfig): MapServiceProvider {
  const provider = (input as { provider?: string }).provider;
  return ONLINE_PROVIDERS.includes(provider as MapServiceProvider)
    ? provider as MapServiceProvider
    : 'tdt';
}

function createTdtValidationUrl(serviceKey: string, secureKey?: string, endpoint = DEFAULT_TDT_VALIDATION_URL): string {
  const params = new URLSearchParams({
    SERVICE: 'WMTS',
    REQUEST: 'GetTile',
    VERSION: '1.0.0',
    LAYER: 'img',
    STYLE: 'default',
    TILEMATRIXSET: 'w',
    FORMAT: 'tiles',
    TILEMATRIX: '0',
    TILEROW: '0',
    TILECOL: '0',
    tk: serviceKey,
  });

  if (secureKey) {
    params.set('sk', secureKey);
  }

  return `${endpoint}?${params.toString()}`;
}

function createPrivateProbeUrl(
  offlineMapUrl: string,
  coordinates: NonNullable<MapServiceValidationOptions['privateProbeCoordinates']>,
): string {
  return offlineMapUrl
    .replace(/\{z\}/gi, String(coordinates.z))
    .replace(/\{x\}/gi, String(coordinates.x))
    .replace(/\{y\}/gi, String(coordinates.y))
    .replace(/\{reverseY\}/gi, String(coordinates.y));
}

function createGoogleValidationUrl(
  serviceKey: string,
  endpoint = DEFAULT_GOOGLE_VALIDATION_URL,
): string {
  const url = new URL(endpoint);
  url.searchParams.set('key', serviceKey);
  return url.toString();
}

function createGoogleValidationInit(): RequestInit {
  return {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mapType: 'satellite',
      language: 'zh-CN',
      region: 'CN',
    }),
  };
}

function mapHttpStatusToCode(status: number, provider: MapServiceProvider): MapServiceValidationCode {
  if (status === 401 || status === 403) {
    return provider === 'private' ? 'CLIENT_RESTRICTION' : 'INVALID_CREDENTIALS';
  }
  if (status === 407) {
    return 'PROXY_REQUIRED';
  }
  if (status === 429) {
    return 'CLIENT_RESTRICTION';
  }
  return 'SERVICE_UNAVAILABLE';
}

function mapThrownErrorToCode(error: unknown): MapServiceValidationCode {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes('proxy')) {
    return 'PROXY_REQUIRED';
  }
  if (message.includes('cors') || message.includes('forbidden') || message.includes('blocked')) {
    return 'CLIENT_RESTRICTION';
  }
  return 'NETWORK_ERROR';
}

function parseJsonText(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function extractErrorMessage(payload: any, fallback: string): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim();
  }
  if (payload && typeof payload === 'object') {
    const message = [
      payload.error?.message,
      payload.error_message,
      payload.message,
      payload.info,
    ].find((value) => typeof value === 'string' && value.trim());
    if (message) {
      return message.trim();
    }
  }
  return fallback;
}

function mapGoogleMessageToCode(message: string): MapServiceValidationCode {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('referer')
    || normalized.includes('referrer')
    || normalized.includes('billing')
    || normalized.includes('not enabled')
    || normalized.includes('has not been used')
  ) {
    return 'CLIENT_RESTRICTION';
  }
  if (
    normalized.includes('api key')
    || normalized.includes('unregistered callers')
    || normalized.includes('permission denied')
  ) {
    return 'INVALID_CREDENTIALS';
  }
  return 'SERVICE_UNAVAILABLE';
}

async function validateWithRequest(
  provider: MapServiceProvider,
  url: string,
  options: MapServiceValidationOptions,
  init?: RequestInit,
): Promise<MapServiceValidationResult> {
  const request = options.request || ((_provider: MapServiceProvider, input: string, init?: RequestInit) => fetch(input, init));

  try {
    const response = await request(provider, url, init || {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
    });

    if (response.ok) {
      const payload = provider === 'google' ? await response.json().catch(() => ({})) : undefined;
      if (provider === 'google' && !payload?.session) {
        return createResult(provider, {
          ok: false,
          code: 'SERVICE_UNAVAILABLE',
          capabilities: {
            basemap: {
              status: 'unavailable',
              credentialVerified: true,
              message: 'Google session 返回缺少 session',
            },
          },
        });
      }

      return createResult(provider, {
        ok: true,
        capabilities: {
          basemap: {
            status: 'available',
            credentialVerified: provider === 'tdt' || provider === 'google' ? true : undefined,
          },
        },
      });
    }

    const message = await response.text().then((text) => {
      const payload = parseJsonText(text);
      return extractErrorMessage(payload ?? text, `底图校验请求返回 HTTP ${response.status}`);
    });
    const code = provider === 'google'
      ? mapGoogleMessageToCode(message)
      : mapHttpStatusToCode(response.status, provider);
    return createResult(provider, {
      ok: false,
      code,
      capabilities: {
        basemap: {
          status: 'unavailable',
          credentialVerified: provider === 'tdt' || provider === 'google' ? true : undefined,
          message,
        },
      },
    });
  } catch (error) {
    return createResult(provider, {
      ok: false,
      code: mapThrownErrorToCode(error),
      capabilities: {
        basemap: {
          status: 'unavailable',
          credentialVerified: undefined,
          message: error instanceof Error ? error.message : String(error),
        },
      },
    });
  }
}

export async function validateMapService(
  mapService: MapServiceConfig,
  options: MapServiceValidationOptions = {},
): Promise<MapServiceValidationResult> {
  const provider = resolveProvider(mapService);

  try {
    const normalized = normalizeMapServiceConfig(mapService);

    if (normalized.provider === 'private') {
      const privateProbeCoordinates = options.privateProbeCoordinates || { z: 0, x: 0, y: 0 };
      return await validateWithRequest(
        'private',
        createPrivateProbeUrl(normalized.offlineMapUrl, privateProbeCoordinates),
        options,
      );
    }

    if (normalized.provider === 'tdt') {
      return await validateWithRequest(
        'tdt',
        createTdtValidationUrl(
          normalized.serviceKey,
          normalized.secureKey,
          options.tdtValidationUrl,
        ),
        options,
      );
    }

    if (normalized.provider === 'google') {
      return await validateWithRequest(
        'google',
        createGoogleValidationUrl(
          normalized.serviceKey,
          options.googleValidationUrl,
        ),
        options,
        createGoogleValidationInit(),
      );
    }

    return createResult(normalized.provider, {
      ok: false,
      code: 'SERVICE_UNAVAILABLE',
      capabilities: {
        basemap: {
          status: 'unknown',
          message: `validateMapService 暂未覆盖 ${normalized.provider} 底图校验。`,
        },
      },
    });
  } catch (error) {
    if (error instanceof MapServiceConfigError) {
      return createResult(provider, {
        ok: false,
        code: 'INVALID_CONFIG',
        capabilities: {
          basemap: {
            status: 'unavailable',
            message: error.message,
          },
        },
      });
    }

    return createResult(provider, {
      ok: false,
      code: 'SERVICE_UNAVAILABLE',
      capabilities: {
        basemap: {
          status: 'unavailable',
          message: error instanceof Error ? error.message : String(error),
        },
      },
    });
  }
}
