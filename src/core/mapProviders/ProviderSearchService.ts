import CryptoJS from 'crypto-js';
import { coordinateService } from './coordinates/CoordinateService';
import type { BaseMapConfig, BaseMapProviderId, MapAuthConfig } from './types';
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
  google: 'https://maps.googleapis.com/maps/api/geocode/json',
};

const clean = (value?: string) => (value || '').trim();

export function createAmapSignature(params: Record<string, string>, securityKey: string): string {
  const source = Object.keys(params).sort().map((name) => `${name}=${params[name]}`).join('&');
  return CryptoJS.MD5(CryptoJS.enc.Utf8.parse(source + clean(securityKey))).toString();
}

function point(longitude: number, latitude: number, source: 'WGS84' | 'GCJ02' | 'BD09') {
  return source === 'WGS84'
    ? { longitude, latitude }
    : coordinateService.toWGS84({ longitude, latitude }, source);
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
    const url = this.buildUrl(endpoint, keyword, region, service);
    const requester = this.options.request || ((_provider, input, init) => fetch(input, init));
    const response = await requester(provider, url, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return this.normalizeResults(provider, keyword, data);
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

  private buildUrl(endpoint: string, query: string, region: string, service: ResolvedMapService) {
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
      params = { address: query, key: service.credentials.serviceKey };
    }
    return `${endpoint}?${new URLSearchParams(params).toString()}`;
  }

  private normalizeResults(provider: BaseMapProviderId, query: string, data: any): SearchResult[] {
    if (provider === 'tdt') return (data?.data?.pois || data?.pois || []).map((item: any) => {
      const [longitude, latitude] = String(item.lonlat || '').split(',').map(Number);
      return { name: item.name || query, address: item.address || '', longitude, latitude, height: 1000, coordSystem: 'WGS84' as const };
    }).filter(valid);
    if (provider === 'gaode') {
      if (String(data?.status) !== '1') throw new Error(data?.info || 'Gaode search failed');
      return (data.pois || []).map((item: any) => {
        const [longitude, latitude] = String(item.location || '').split(',').map(Number);
        return { name: item.name || query, address: item.address || '', ...point(longitude, latitude, 'GCJ02'), height: 1000, coordSystem: 'WGS84' as const };
      }).filter(valid);
    }
    if (provider === 'baidu') {
      if (Number(data?.status) !== 0) throw new Error(data?.message || 'Baidu search failed');
      return (data.results || []).map((item: any) => ({ name: item.name || query, address: item.address || '', ...point(Number(item.location?.lng), Number(item.location?.lat), 'BD09'), height: 1000, coordSystem: 'WGS84' as const })).filter(valid);
    }
    if (provider === 'tencent') {
      if (Number(data?.status) !== 0) throw new Error(data?.message || 'Tencent search failed');
      return (data.data || []).map((item: any) => ({ name: item.title || query, address: item.address || '', ...point(Number(item.location?.lng), Number(item.location?.lat), 'GCJ02'), height: 1000, coordSystem: 'WGS84' as const })).filter(valid);
    }
    if (data?.status !== 'OK') throw new Error(data?.error_message || 'Google search failed');
    return (data.results || []).map((item: any) => ({ name: item.formatted_address || query, address: item.formatted_address || '', longitude: Number(item.geometry?.location?.lng), latitude: Number(item.geometry?.location?.lat), height: 1000, coordSystem: 'WGS84' as const })).filter(valid);
  }
}

function valid(item: SearchResult) {
  return Number.isFinite(item.longitude) && Number.isFinite(item.latitude);
}

export { normalizeMapAuth };
