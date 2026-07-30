import { describe, expect, it, vi } from 'vitest';
import { coordinateService } from '../src/core/mapProviders/coordinates/CoordinateService';
import {
  createAmapSignature,
  ProviderSearchError,
  ProviderSearchService,
} from '../src/core/mapProviders/ProviderSearchService';
import { baseMapRegistry } from '../src/core/mapProviders/registry';
import {
  MapServiceConfigError,
  resolveConfiguredMapService,
  resolveLegacyMapService,
} from '../src/core/mapProviders/mapService';

describe('legacy map service normalization seam', () => {
  it('normalizes legacy online provider inputs into one resolved service shape', () => {
    const service = resolveLegacyMapService({
      baseMap: {
        provider: 'amap' as any,
        type: 'satellite',
        key: ' base-key ',
        sk: ' base-secure ',
      },
      mapAuth: {
        gaode: {
          key: ' auth-key ',
          securityKey: ' auth-secure ',
        },
      },
    });

    expect(service.provider).toBe('gaode');
    expect(service.baseMap).toMatchObject({
      provider: 'gaode',
      type: 'satellite',
      key: 'base-key',
      sk: 'base-secure',
      showLabel: true,
    });
    expect(service.auth).toEqual({
      gaode: {
        key: 'auth-key',
        securityKey: 'auth-secure',
      },
    });
    expect(service.credentials).toEqual({
      serviceKey: 'base-key',
      secureKey: 'base-secure',
      mapId: '',
    });
    expect(service.isOffline).toBe(false);
  });

  it('normalizes private legacy maps into the same service seam used by the registry', () => {
    const service = resolveLegacyMapService({
      baseMap: {
        provider: 'private' as any,
        mode: 'offline',
        urlTemplate: ' /tiles/{z}/{x}/{y}.png ',
        rectangle: {
          west: 120,
          south: 30,
          east: 121,
          north: 31,
        },
      },
    });

    expect(service.provider).toBe('custom');
    expect(service.baseMap).toMatchObject({
      provider: 'custom',
      type: 'xyz',
      mode: 'offline',
      urlTemplate: '/tiles/{z}/{x}/{y}.png',
      showLabel: false,
    });
    expect(service.isOffline).toBe(true);

    const mapTypes = baseMapRegistry.getMapTypes(service.baseMap, service.auth);
    expect(mapTypes.map((item) => item.id)).toEqual(['custom-xyz']);
    expect(mapTypes[0]?.name).toBe('离线地图');
  });
});

describe('new mapService normalization seam', () => {
  it('normalizes tdt mapService config into the shared resolved service shape', () => {
    const service = resolveConfiguredMapService({
      provider: 'tdt',
      serviceKey: ' token-value ',
      secureKey: ' secure-value ',
    });

    expect(service.provider).toBe('tdt');
    expect(service.baseMap).toMatchObject({
      provider: 'tdt',
      type: 'img',
      token: 'token-value',
      sk: 'secure-value',
      showLabel: true,
    });
    expect(service.auth).toEqual({
      tdt: {
        token: 'token-value',
        sk: 'secure-value',
      },
    });
    expect(service.isOffline).toBe(false);
  });

  it('normalizes private mapService config into offline custom imagery without requiring rectangle', () => {
    const service = resolveConfiguredMapService({
      provider: 'private',
      offlineMapUrl: ' /tiles/{z}/{x}/{y}.png ',
    });

    expect(service.provider).toBe('custom');
    expect(service.baseMap).toMatchObject({
      provider: 'custom',
      type: 'xyz',
      mode: 'offline',
      urlTemplate: '/tiles/{z}/{x}/{y}.png',
      showLabel: false,
    });
    expect(service.isOffline).toBe(true);

    const mapTypes = baseMapRegistry.getMapTypes(service.baseMap, service.auth);
    expect(mapTypes.map((item) => item.id)).toEqual(['custom-xyz']);
    expect(() => mapTypes[0]?.provider({} as any)).not.toThrow();
  });

  it('rejects unsupported new mapService providers instead of silently falling back', () => {
    expect(() => resolveConfiguredMapService({
      provider: 'osm' as any,
      serviceKey: 'token',
    })).toThrow(MapServiceConfigError);
  });
});

describe('ProviderSearchService legacy compatibility', () => {
  it('searches through the resolved service seam and normalizes gaode coordinates once', async () => {
    const request = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: '1',
        pois: [
          {
            name: '西湖',
            address: '杭州',
            location: '120.15507,30.274085',
          },
        ],
      }),
    })) as any;

    const service = resolveLegacyMapService({
      baseMap: {
        provider: 'gaode',
        key: ' base-key ',
      },
      mapAuth: {
        gaode: {
          key: ' auth-key ',
          securityKey: ' auth-secure ',
        },
      },
    });
    const searchService = new ProviderSearchService({
      endpoints: {
        gaode: 'https://proxy.example.com/amap-search',
      },
      request,
    });

    const results = await searchService.search('西湖', service);

    expect(request).toHaveBeenCalledTimes(1);
    const [provider, url] = request.mock.calls[0];
    const parsedUrl = new URL(url);
    expect(provider).toBe('gaode');
    expect(`${parsedUrl.origin}${parsedUrl.pathname}`).toBe('https://proxy.example.com/amap-search');
    expect(parsedUrl.searchParams.get('key')).toBe('base-key');
    expect(parsedUrl.searchParams.get('keywords')).toBe('西湖');
    expect(parsedUrl.searchParams.get('sig')).toBe(
      createAmapSignature(
        {
          city: '全国',
          key: 'base-key',
          keywords: '西湖',
        },
        'auth-secure',
      ),
    );

    const expectedPoint = coordinateService.toWGS84(
      {
        longitude: 120.15507,
        latitude: 30.274085,
      },
      'GCJ02',
    );

    expect(results).toEqual([
      expect.objectContaining({
        name: '西湖',
        address: '杭州',
        coordSystem: 'WGS84',
      }),
    ]);
    expect(results[0]?.longitude).toBeCloseTo(expectedPoint.longitude, 5);
    expect(results[0]?.latitude).toBeCloseTo(expectedPoint.latitude, 5);
  });

  it('keeps the legacy baseMap plus mapAuth search entrypoint working', async () => {
    const request = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          pois: [
            {
              name: '首都机场',
              address: '北京',
              lonlat: '116.4074,39.9042',
            },
          ],
        },
      }),
    })) as any;

    const searchService = new ProviderSearchService({
      endpoints: {
        tdt: 'https://proxy.example.com/tdt-search',
      },
      request,
    });

    const results = await searchService.search(
      '首都机场',
      {
        provider: 'tdt',
        type: 'img',
      },
      {
        tdt: {
          token: ' token-value ',
          sk: ' secure-value ',
        },
      },
    );

    expect(request).toHaveBeenCalledTimes(1);
    const [provider, url] = request.mock.calls[0];
    const parsedUrl = new URL(url);
    expect(provider).toBe('tdt');
    expect(`${parsedUrl.origin}${parsedUrl.pathname}`).toBe('https://proxy.example.com/tdt-search');
    expect(parsedUrl.searchParams.get('tk')).toBe('token-value');
    expect(parsedUrl.searchParams.get('sk')).toBe('secure-value');
    expect(results).toEqual([
      {
        name: '首都机场',
        address: '北京',
        longitude: 116.4074,
        latitude: 39.9042,
        height: 1000,
        coordSystem: 'WGS84',
      },
    ]);
  });

  it('normalizes baidu search results through injected proxy endpoints into WGS-84', async () => {
    const request = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 0,
        results: [
          {
            name: '东方明珠',
            address: '上海',
            location: {
              lng: 121.499809,
              lat: 31.239666,
            },
          },
        ],
      }),
    })) as any;
    const searchService = new ProviderSearchService({
      endpoints: {
        baidu: 'https://proxy.example.com/baidu-search',
      },
      request,
    });

    const results = await searchService.search('东方明珠', resolveConfiguredMapService({
      provider: 'baidu',
      serviceKey: ' baidu-ak ',
    }));

    expect(request).toHaveBeenCalledTimes(1);
    const [provider, url] = request.mock.calls[0];
    const parsedUrl = new URL(url);
    expect(provider).toBe('baidu');
    expect(`${parsedUrl.origin}${parsedUrl.pathname}`).toBe('https://proxy.example.com/baidu-search');
    expect(parsedUrl.searchParams.get('ak')).toBe('baidu-ak');
    expect(parsedUrl.searchParams.get('query')).toBe('东方明珠');

    const expectedPoint = coordinateService.toWGS84(
      {
        longitude: 121.499809,
        latitude: 31.239666,
      },
      'BD09',
    );
    expect(results).toEqual([
      expect.objectContaining({
        name: '东方明珠',
        address: '上海',
        coordSystem: 'WGS84',
      }),
    ]);
    expect(results[0]?.longitude).toBeCloseTo(expectedPoint.longitude, 5);
    expect(results[0]?.latitude).toBeCloseTo(expectedPoint.latitude, 5);
  });

  it('normalizes tencent search results through injected proxy endpoints into WGS-84', async () => {
    const request = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 0,
        data: [
          {
            title: '滨江公园',
            address: '杭州',
            location: {
              lng: 120.210792,
              lat: 30.206992,
            },
          },
        ],
      }),
    })) as any;
    const searchService = new ProviderSearchService({
      endpoints: {
        tencent: 'https://proxy.example.com/tencent-search',
      },
      request,
    });

    const results = await searchService.search('滨江公园', resolveConfiguredMapService({
      provider: 'tencent',
      serviceKey: ' tencent-key ',
    }));

    expect(request).toHaveBeenCalledTimes(1);
    const [provider, url] = request.mock.calls[0];
    const parsedUrl = new URL(url);
    expect(provider).toBe('tencent');
    expect(`${parsedUrl.origin}${parsedUrl.pathname}`).toBe('https://proxy.example.com/tencent-search');
    expect(parsedUrl.searchParams.get('key')).toBe('tencent-key');
    expect(parsedUrl.searchParams.get('keyword')).toBe('滨江公园');

    const expectedPoint = coordinateService.toWGS84(
      {
        longitude: 120.210792,
        latitude: 30.206992,
      },
      'GCJ02',
    );
    expect(results).toEqual([
      expect.objectContaining({
        name: '滨江公园',
        address: '杭州',
        coordSystem: 'WGS84',
      }),
    ]);
    expect(results[0]?.longitude).toBeCloseTo(expectedPoint.longitude, 5);
    expect(results[0]?.latitude).toBeCloseTo(expectedPoint.latitude, 5);
  });

  it('uses Google Places Text Search with POST and normalizes WGS-84 results', async () => {
    const request = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        places: [
          {
            displayName: {
              text: '杭州西湖',
            },
            formattedAddress: '中国浙江省杭州市西湖区',
            location: {
              longitude: 120.153576,
              latitude: 30.243382,
            },
          },
        ],
      }),
    })) as any;
    const searchService = new ProviderSearchService({
      endpoints: {
        google: 'https://proxy.example.com/google-places',
      },
      request,
    });

    const results = await searchService.search('杭州西湖', resolveConfiguredMapService({
      provider: 'google',
      serviceKey: ' google-key ',
    }));

    expect(request).toHaveBeenCalledTimes(1);
    const [provider, url, init] = request.mock.calls[0];
    expect(provider).toBe('google');
    expect(url).toBe('https://proxy.example.com/google-places');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': 'google-key',
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
      },
    });
    expect(JSON.parse(init.body)).toEqual({
      textQuery: '杭州西湖',
      languageCode: 'zh-CN',
      regionCode: 'CN',
      maxResultCount: 10,
    });
    expect(results).toEqual([
      {
        name: '杭州西湖',
        address: '中国浙江省杭州市西湖区',
        longitude: 120.153576,
        latitude: 30.243382,
        height: 1000,
        coordSystem: 'WGS84',
      },
    ]);
  });

  it('maps Google Places referrer restriction failures to client restriction errors', async () => {
    const searchService = new ProviderSearchService({
      request: vi.fn(async () => ({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({
          error: {
            message: 'API keys with referer restrictions cannot be used with this API.',
          },
        }),
      })) as any,
    });

    await expect(searchService.search('西湖', resolveConfiguredMapService({
      provider: 'google',
      serviceKey: 'google-key',
    }))).rejects.toMatchObject<Partial<ProviderSearchError>>({
      name: 'ProviderSearchError',
      provider: 'google',
      code: 'CLIENT_RESTRICTION',
      status: 403,
    });
  });

  it('maps baidu permission failures to invalid credentials errors', async () => {
    const searchService = new ProviderSearchService({
      request: vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: 302,
          message: 'AK有误请检查再重试',
        }),
      })) as any,
    });

    await expect(searchService.search('西湖', resolveConfiguredMapService({
      provider: 'baidu',
      serviceKey: 'ak',
    }))).rejects.toMatchObject<Partial<ProviderSearchError>>({
      name: 'ProviderSearchError',
      provider: 'baidu',
      code: 'INVALID_CREDENTIALS',
      retryable: false,
    });
  });

  it('maps tencent network failures to retryable network errors', async () => {
    const searchService = new ProviderSearchService({
      request: vi.fn(async () => {
        throw new Error('network timeout while requesting provider');
      }) as any,
    });

    await expect(searchService.search('西湖', resolveConfiguredMapService({
      provider: 'tencent',
      serviceKey: 'key',
    }))).rejects.toMatchObject<Partial<ProviderSearchError>>({
      name: 'ProviderSearchError',
      provider: 'tencent',
      code: 'NETWORK_ERROR',
      retryable: true,
    });
  });

  it('maps tencent proxy endpoint failures to proxy-required errors', async () => {
    const searchService = new ProviderSearchService({
      endpoints: {
        tencent: 'https://proxy.example.com/tencent-search',
      },
      request: vi.fn(async () => ({
        ok: false,
        status: 502,
      })) as any,
    });

    await expect(searchService.search('西湖', resolveConfiguredMapService({
      provider: 'tencent',
      serviceKey: 'key',
    }))).rejects.toMatchObject<Partial<ProviderSearchError>>({
      name: 'ProviderSearchError',
      provider: 'tencent',
      code: 'PROXY_REQUIRED',
      status: 502,
      retryable: true,
    });
  });
});
