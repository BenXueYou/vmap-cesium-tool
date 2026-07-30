import { describe, expect, it, vi } from 'vitest';
import { coordinateService } from '../src/core/mapProviders/coordinates/CoordinateService';
import {
  createAmapSignature,
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
});
