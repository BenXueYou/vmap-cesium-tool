import CryptoJS from 'crypto-js';
import { coordinateService } from './coordinates/CoordinateService';
import type {
  BaseMapConfig,
  BaseMapProviderId,
  MapAuthConfig,
  MapServiceValidationCode,
} from './types';
import type { ProviderSearchOptions, SearchResult } from '../types';
import {
  normalizeMapAuth,
  type ResolvedMapService,
  resolveLegacyMapService,
} from './mapService';

const DEFAULT_ENDPOINTS: Partial<Record<BaseMapProviderId, string>> = {
  tdt: 'https://api.tianditu.gov.cn/v2/search',
  gaode: 'https://restapi.amap.com/v3/place/text',
  tencent: 'https://apis.map.qq.com/ws/place/v1/search',
  baidu: 'https://api.map.baidu.com/place/v2/search',
  google: 'https://places.googleapis.com/v1/places:searchText',
};

const GOOGLE_PLACES_FIELD_MASK = [
  'places.displayName',
  'places.formattedAddress',
  'places.location',
].join(',');

const clean = (value?: string) => (value || '').trim();

const PROXY_HTTP_STATUSES = new Set([404, 407, 502, 503, 504]);
const CLIENT_RESTRICTION_PATTERNS = [
  'referer',
  'referrer',
  'referer restrictions',
  'referrer restrictions',
  'domain',
  'ip',
  'white list',
  'whitelist',
  'not allowed',
  'forbidden',
  'blocked',
  'billing',
  'api has not been used',
  'has not been used in project',
  'is not enabled',
  '限制',
  '白名单',
];
const INVALID_CREDENTIAL_PATTERNS = [
  'invalid key',
  'invalid api key',
  'invalid ak',
  'ak有误',
  'ak不存在',
  'key有误',
  'key invalid',
  'key error',
  'api key not valid',
  'unregistered callers',
  'request denied',
  'invalid credential',
  'auth failed',
  'permission denied',
  'signature',
  'sig',
  'sn',
  'token',
  '鉴权',
  '密钥',
];
const PROXY_PATTERNS = [
  'proxy',
  'gateway',
  'upstream',
  'bad gateway',
  'nginx',
  '代理',
];
const NETWORK_PATTERNS = [
  'network',
  'timeout',
  'timed out',
  'failed to fetch',
  'fetch failed',
  'econn',
  'socket',
  'connection',
  'aborted',
  '超时',
  '网络',
];

export class ProviderSearchError extends Error {
  readonly provider: BaseMapProviderId;
  readonly code: MapServiceValidationCode;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    provider: BaseMapProviderId,
    code: MapServiceValidationCode,
    message: string,
    options: {
      status?: number;
      retryable?: boolean;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'ProviderSearchError';
    this.provider = provider;
    this.code = code;
    this.status = options.status;
    this.retryable = options.retryable ?? (code === 'NETWORK_ERROR' || code === 'SERVICE_UNAVAILABLE');
    if ('cause' in options) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function createAmapSignature(params: Record<string, string>, securityKey: string): string {
  const source = Object.keys(params).sort().map((name) => `${name}=${params[name]}`).join('&');
  return CryptoJS.MD5(CryptoJS.enc.Utf8.parse(source + clean(securityKey))).toString();
}

function point(longitude: number, latitude: number, source: 'WGS84' | 'GCJ02' | 'BD09') {
  return source === 'WGS84'
    ? { longitude, latitude }
    : coordinateService.toWGS84({ longitude, latitude }, source);
}

function includesPattern(message: string, patterns: string[]): boolean {
  const normalized = message.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern));
}

function mapMessageToCode(message: string): MapServiceValidationCode {
  if (includesPattern(message, PROXY_PATTERNS)) {
    return 'PROXY_REQUIRED';
  }
  if (includesPattern(message, CLIENT_RESTRICTION_PATTERNS)) {
    return 'CLIENT_RESTRICTION';
  }
  if (includesPattern(message, INVALID_CREDENTIAL_PATTERNS)) {
    return 'INVALID_CREDENTIALS';
  }
  if (includesPattern(message, NETWORK_PATTERNS)) {
    return 'NETWORK_ERROR';
  }
  return 'SERVICE_UNAVAILABLE';
}

function mapHttpStatusToCode(
  status: number,
  usedCustomEndpoint: boolean,
  message = '',
): MapServiceValidationCode {
  if (status === 401 || status === 403) {
    const messageCode = message ? mapMessageToCode(message) : null;
    if (messageCode && messageCode !== 'SERVICE_UNAVAILABLE') {
      return messageCode;
    }
    return 'INVALID_CREDENTIALS';
  }
  if (status === 429) {
    return 'CLIENT_RESTRICTION';
  }
  if (usedCustomEndpoint && PROXY_HTTP_STATUSES.has(status)) {
    return 'PROXY_REQUIRED';
  }
  if (status === 407) {
    return 'PROXY_REQUIRED';
  }
  return 'SERVICE_UNAVAILABLE';
}

function normalizeThrownError(
  provider: BaseMapProviderId,
  error: unknown,
): ProviderSearchError {
  if (error instanceof ProviderSearchError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const code = mapMessageToCode(message);
  return new ProviderSearchError(provider, code, message, {
    cause: error,
    retryable: code === 'NETWORK_ERROR' || code === 'SERVICE_UNAVAILABLE' || code === 'PROXY_REQUIRED',
  });
}

function providerError(
  provider: BaseMapProviderId,
  message: string,
): ProviderSearchError {
  const code = mapMessageToCode(message);
  return new ProviderSearchError(provider, code, message, {
    retryable: code === 'NETWORK_ERROR' || code === 'SERVICE_UNAVAILABLE' || code === 'PROXY_REQUIRED',
  });
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
    const nested = [
      payload.error?.message,
      payload.error_message,
      payload.message,
      payload.info,
      payload.statusMessage,
    ].find((value) => typeof value === 'string' && value.trim());
    if (nested) {
      return nested.trim();
    }
  }
  return fallback;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  if (typeof response.text !== 'function') {
    return fallback;
  }
  const text = await response.text();
  if (!text.trim()) {
    return fallback;
  }

  const payload = parseJsonText(text);
  return extractErrorMessage(payload ?? text, fallback);
}

interface RequestDescriptor {
  input: string;
  init: RequestInit;
}

export class ProviderSearchService {
  constructor(private options: ProviderSearchOptions = {}) {}

  async search(query: string, service: ResolvedMapService): Promise<SearchResult[]>;
  async search(query: string, baseMap: BaseMapConfig, mapAuth?: MapAuthConfig): Promise<SearchResult[]>;
  async search(
    query: string,
    baseMapOrService: BaseMapConfig | ResolvedMapService,
    mapAuth?: MapAuthConfig,
  ): Promise<SearchResult[]> {
    const keyword = query.trim();
    const service = this.resolveService(baseMapOrService, mapAuth);
    const provider = service.provider;
    if (!keyword || provider === 'custom') return [];
    const endpoint = this.options.endpoints?.[provider] || DEFAULT_ENDPOINTS[provider];
    if (!endpoint) return [];
    const region = this.options.defaultRegion || '全国';
    const requestDescriptor = this.buildRequest(endpoint, keyword, region, service);
    const requester = this.options.request || ((_provider, input, init) => fetch(input, init));
    const usedCustomEndpoint = clean(endpoint) !== clean(DEFAULT_ENDPOINTS[provider]);

    try {
      const response = await requester(provider, requestDescriptor.input, requestDescriptor.init);
      if (!response.ok) {
        const message = await readErrorMessage(response, `HTTP ${response.status}`);
        throw new ProviderSearchError(
          provider,
          mapHttpStatusToCode(response.status, usedCustomEndpoint, message),
          message,
          {
            status: response.status,
            retryable: response.status >= 500 || response.status === 404 || response.status === 407,
          },
        );
      }

      const data = await response.json();
      return this.normalizeResults(provider, keyword, data);
    } catch (error) {
      throw normalizeThrownError(provider, error);
    }
  }

  private resolveService(
    baseMapOrService: BaseMapConfig | ResolvedMapService,
    mapAuth?: MapAuthConfig,
  ): ResolvedMapService {
    if ('baseMap' in baseMapOrService && 'credentials' in baseMapOrService) {
      return baseMapOrService;
    }

    return resolveLegacyMapService({
      baseMap: baseMapOrService,
      mapAuth: normalizeMapAuth(mapAuth),
    });
  }

  private buildRequest(
    endpoint: string,
    query: string,
    region: string,
    service: ResolvedMapService,
  ): RequestDescriptor {
    const provider = service.provider;
    let params: Record<string, string>;
    if (provider === 'tdt') {
      const payload = { start: 0, count: 10, queryType: 7, keyWord: query, mapBound: '73.5577,18.1597,135.0882,53.5609', level: 15 };
      params = { postStr: JSON.stringify(payload), type: 'query', tk: service.credentials.serviceKey };
      if (service.credentials.secureKey) params.sk = service.credentials.secureKey;
    } else if (provider === 'gaode') {
      params = { city: region, key: service.credentials.serviceKey, keywords: query };
      if (service.credentials.secureKey) {
        params.sig = createAmapSignature(params, service.credentials.secureKey);
      }
    } else if (provider === 'baidu') {
      params = { query, region, output: 'json', ak: service.credentials.serviceKey };
    } else if (provider === 'tencent') {
      params = { boundary: `region(${region},0)`, keyword: query, key: service.credentials.serviceKey };
    } else {
      return {
        input: endpoint,
        init: {
          method: 'POST',
          mode: 'cors',
          credentials: 'omit',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': service.credentials.serviceKey,
            'X-Goog-FieldMask': GOOGLE_PLACES_FIELD_MASK,
          },
          body: JSON.stringify({
            textQuery: query,
            languageCode: 'zh-CN',
            regionCode: 'CN',
            maxResultCount: 10,
          }),
        },
      };
    }
    return {
      input: `${endpoint}?${new URLSearchParams(params).toString()}`,
      init: {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
      },
    };
  }

  private normalizeResults(provider: BaseMapProviderId, query: string, data: any): SearchResult[] {
    if (provider === 'tdt') return (data?.data?.pois || data?.pois || []).map((item: any) => {
      const [longitude, latitude] = String(item.lonlat || '').split(',').map(Number);
      return { name: item.name || query, address: item.address || '', longitude, latitude, height: 1000, coordSystem: 'WGS84' as const };
    }).filter(valid);
    if (provider === 'gaode') {
      if (String(data?.status) !== '1') throw providerError(provider, data?.info || 'Gaode search failed');
      return (data.pois || []).map((item: any) => {
        const [longitude, latitude] = String(item.location || '').split(',').map(Number);
        return { name: item.name || query, address: item.address || '', ...point(longitude, latitude, 'GCJ02'), height: 1000, coordSystem: 'WGS84' as const };
      }).filter(valid);
    }
    if (provider === 'baidu') {
      if (Number(data?.status) !== 0) throw providerError(provider, data?.message || 'Baidu search failed');
      return (data.results || []).map((item: any) => ({ name: item.name || query, address: item.address || '', ...point(Number(item.location?.lng), Number(item.location?.lat), 'BD09'), height: 1000, coordSystem: 'WGS84' as const })).filter(valid);
    }
    if (provider === 'tencent') {
      if (Number(data?.status) !== 0) throw providerError(provider, data?.message || 'Tencent search failed');
      return (data.data || []).map((item: any) => ({ name: item.title || query, address: item.address || '', ...point(Number(item.location?.lng), Number(item.location?.lat), 'GCJ02'), height: 1000, coordSystem: 'WGS84' as const })).filter(valid);
    }
    if (data?.error) throw providerError(provider, extractErrorMessage(data, 'Google search failed'));
    return (data?.places || []).map((item: any) => ({
      name: item.displayName?.text || query,
      address: item.formattedAddress || '',
      longitude: Number(item.location?.longitude),
      latitude: Number(item.location?.latitude),
      height: 1000,
      coordSystem: 'WGS84' as const,
    })).filter(valid);
  }
}

function valid(item: SearchResult) {
  return Number.isFinite(item.longitude) && Number.isFinite(item.latitude);
}

export { normalizeMapAuth };
