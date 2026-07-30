import { describe, expect, it, vi } from 'vitest';
import { validateMapService } from '../src/core/mapProviders/validation';

describe('validateMapService', () => {
  it('validates tdt basemap reachability and keeps search capability in notChecked state', async () => {
    const request = vi.fn(async () => new Response('', {
      status: 200,
      headers: {
        'content-type': 'image/png',
      },
    }));

    const result = await validateMapService(
      {
        provider: 'tdt',
        serviceKey: ' token-value ',
        secureKey: ' secure-value ',
      },
      {
        request,
      },
    );

    expect(request).toHaveBeenCalledTimes(1);
    const [provider, url] = request.mock.calls[0];
    const parsed = new URL(url);
    expect(provider).toBe('tdt');
    expect(`${parsed.origin}${parsed.pathname}`).toBe('https://t0.tianditu.gov.cn/img_w/wmts');
    expect(parsed.searchParams.get('tk')).toBe('token-value');
    expect(parsed.searchParams.get('sk')).toBe('secure-value');
    expect(result).toEqual({
      ok: true,
      provider: 'tdt',
      capabilities: {
        basemap: {
          status: 'available',
          credentialVerified: true,
        },
        search: {
          status: 'notChecked',
          requiresEnablement: true,
          requiredProduct: '天地图搜索服务',
          setupUrl: 'https://lbs.tianditu.gov.cn/server/search.html',
          message: '底图校验不包含地点搜索；使用工具栏搜索前请确认已开通天地图搜索服务。',
        },
      },
    });
  });

  it('returns invalid config for malformed tdt mapService without probing search', async () => {
    const request = vi.fn();

    const result = await validateMapService(
      {
        provider: 'tdt',
        serviceKey: '   ',
      },
      {
        request: request as any,
      },
    );

    expect(request).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      provider: 'tdt',
      code: 'INVALID_CONFIG',
      capabilities: {
        basemap: {
          status: 'unavailable',
          message: 'tdt mapService 缺少 serviceKey',
        },
        search: {
          status: 'notChecked',
          requiresEnablement: true,
          requiredProduct: '天地图搜索服务',
          setupUrl: 'https://lbs.tianditu.gov.cn/server/search.html',
          message: '底图校验不包含地点搜索；使用工具栏搜索前请确认已开通天地图搜索服务。',
        },
      },
    });
  });

  it('maps private offline probes to basemap availability and marks search unavailable', async () => {
    const request = vi.fn(async () => new Response('', { status: 200 }));

    const result = await validateMapService(
      {
        provider: 'private',
        offlineMapUrl: 'https://offline.example.com/tiles/{z}/{x}/{y}.png',
      },
      {
        request,
        privateProbeCoordinates: { z: 3, x: 4, y: 5 },
      },
    );

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0]).toBe('private');
    expect(request.mock.calls[0]?.[1]).toBe('https://offline.example.com/tiles/3/4/5.png');
    expect(result).toEqual({
      ok: true,
      provider: 'private',
      capabilities: {
        basemap: {
          status: 'available',
          credentialVerified: undefined,
        },
        search: {
          status: 'unavailable',
          requiresEnablement: false,
          message: '私有地图服务不提供厂商地点搜索能力。',
        },
      },
    });
  });

  it('returns unavailable for failing private probes and keeps the provider search disabled', async () => {
    const request = vi.fn(async () => new Response('', { status: 404 }));

    const result = await validateMapService(
      {
        provider: 'private',
        offlineMapUrl: 'https://offline.example.com/tiles/{z}/{x}/{y}.png',
      },
      {
        request,
      },
    );

    expect(result).toEqual({
      ok: false,
      provider: 'private',
      code: 'SERVICE_UNAVAILABLE',
      capabilities: {
        basemap: {
          status: 'unavailable',
          credentialVerified: undefined,
          message: '底图校验请求返回 HTTP 404',
        },
        search: {
          status: 'unavailable',
          requiresEnablement: false,
          message: '私有地图服务不提供厂商地点搜索能力。',
        },
      },
    });
  });
});
