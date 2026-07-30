import * as Cesium from 'cesium';
import { describe, expect, it, vi } from 'vitest';
import { MapPlugin } from '../src/core/MapPlugin';
import { coordinateService } from '../src/core/mapProviders/coordinates/CoordinateService';
import { MapServiceConfigError } from '../src/core/mapProviders/mapService';

describe('MapPlugin mapService contract', () => {
  it('rejects mixed new and legacy map configuration at construction time', () => {
    expect(() => new MapPlugin('map', {
      mapService: {
        provider: 'tdt',
        serviceKey: 'token-value',
      },
      baseMap: {
        provider: 'tdt',
        type: 'img',
      },
    })).toThrow(MapServiceConfigError);
  });

  it('switches between online and private mapService modes and updates toolbar search visibility', async () => {
    const plugin = new MapPlugin('map', {
      mapService: {
        provider: 'tdt',
        serviceKey: ' token-value ',
        secureKey: ' secure-value ',
      },
    });

    const refreshSpy = vi.spyOn(plugin as any, 'refreshLayersAndGeoWTFS').mockResolvedValue(undefined);
    const updateToolbarLayerStateSpy = vi.spyOn(plugin as any, 'updateToolbarLayerState').mockImplementation(() => {});
    const toolbarService = {
      hideButton: vi.fn(),
      showButton: vi.fn(),
      setLayersService: vi.fn(),
      getButtonHandler: vi.fn(() => null),
    };

    (plugin as any).toolbarService = toolbarService;
    (plugin as any).isInitialized = true;

    expect(plugin.getConfig().mapService).toEqual({
      provider: 'tdt',
      serviceKey: 'token-value',
      secureKey: 'secure-value',
    });
    expect(plugin.getConfig().baseMap).toBeUndefined();

    await plugin.setMapService({
      provider: 'private',
      offlineMapUrl: ' /tiles/{z}/{x}/{y}.png ',
    });

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(updateToolbarLayerStateSpy).toHaveBeenCalledTimes(1);
    expect(toolbarService.hideButton).toHaveBeenCalledWith('search');
    expect(plugin.getConfig().mapService).toEqual({
      provider: 'private',
      offlineMapUrl: '/tiles/{z}/{x}/{y}.png',
    });

    await plugin.setMapService({
      provider: 'tdt',
      serviceKey: ' next-token ',
      secureKey: ' next-secure ',
    });

    expect(refreshSpy).toHaveBeenCalledTimes(2);
    expect(updateToolbarLayerStateSpy).toHaveBeenCalledTimes(2);
    expect(toolbarService.showButton).toHaveBeenCalledWith('search');
    expect(plugin.getConfig().mapService).toEqual({
      provider: 'tdt',
      serviceKey: 'next-token',
      secureKey: 'next-secure',
    });
  });

  it('rejects legacy mutation APIs after entering mapService mode', () => {
    const plugin = new MapPlugin('map', {
      mapService: {
        provider: 'tdt',
        serviceKey: 'token-value',
      },
    });

    expect(() => plugin.updateBaseMap({ type: 'vec' })).toThrow(MapServiceConfigError);
    expect(() => plugin.updateMapAuth({
      tdt: {
        token: 'token-value',
      },
    })).toThrow(MapServiceConfigError);
  });

  it('uses component-owned tdt search in mapService mode and rejects legacy search overrides', async () => {
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
    const plugin = new MapPlugin('map', {
      mapService: {
        provider: 'tdt',
        serviceKey: 'token-value',
        secureKey: 'secure-value',
      },
      providerSearch: {
        request,
      },
    });

    expect(() => (plugin as any).buildToolbarCallbacks({
      onSearch: vi.fn(),
    })).toThrow(MapServiceConfigError);

    const callbacks = (plugin as any).buildToolbarCallbacks({});
    const results = await callbacks.onSearch('首都机场');

    expect(request).toHaveBeenCalledTimes(1);
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

  it('uses component-owned gaode search selection to preserve camera height and emit WGS-84 results', () => {
    const onSearchResultSelected = vi.fn();
    const plugin = new MapPlugin('map', {
      mapService: {
        provider: 'gaode',
        serviceKey: 'token-value',
        secureKey: 'secure-value',
      },
      onSearchResultSelected,
    });

    const flyTo = vi.fn();
    (plugin as any).viewer = {
      camera: {
        positionCartographic: {
          height: 4800,
        },
        heading: 0.25,
        pitch: -0.75,
        roll: 0.05,
        flyTo,
      },
    };

    const fromDegreesSpy = vi.spyOn(Cesium.Cartesian3, 'fromDegrees').mockReturnValue({} as Cesium.Cartesian3);
    const selected = (plugin as any).handleMapServiceSearchSelection({
      name: '西湖',
      address: '杭州',
      longitude: 120.15507,
      latitude: 30.274085,
      coordSystem: 'GCJ02',
    });

    const expectedPoint = coordinateService.toWGS84(
      {
        longitude: 120.15507,
        latitude: 30.274085,
      },
      'GCJ02',
    );

    expect(fromDegreesSpy).toHaveBeenCalledWith(
      expect.closeTo(expectedPoint.longitude, 6),
      expect.closeTo(expectedPoint.latitude, 6),
      4800,
    );
    expect(flyTo).toHaveBeenCalledTimes(1);
    expect(flyTo).toHaveBeenCalledWith(expect.objectContaining({
      orientation: {
        heading: 0.25,
        pitch: -0.75,
        roll: 0.05,
      },
      duration: 1.2,
    }));
    expect(selected).toEqual({
      provider: 'gaode',
      name: '西湖',
      address: '杭州',
      longitude: expect.closeTo(expectedPoint.longitude, 6),
      latitude: expect.closeTo(expectedPoint.latitude, 6),
      height: 4800,
      coordSystem: 'WGS84',
    });
    expect(onSearchResultSelected).toHaveBeenCalledWith({
      provider: 'gaode',
      name: '西湖',
      address: '杭州',
      longitude: expect.closeTo(expectedPoint.longitude, 6),
      latitude: expect.closeTo(expectedPoint.latitude, 6),
      height: 4800,
      coordSystem: 'WGS84',
    });

    fromDegreesSpy.mockRestore();
  });

  it('uses component-owned tencent search in mapService mode', async () => {
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
    const plugin = new MapPlugin('map', {
      mapService: {
        provider: 'tencent',
        serviceKey: 'tencent-key',
      },
      providerSearch: {
        request,
      },
    });

    const callbacks = (plugin as any).buildToolbarCallbacks({});
    const results = await callbacks.onSearch('滨江公园');

    expect(request).toHaveBeenCalledTimes(1);
    expect(results).toEqual([
      expect.objectContaining({
        name: '滨江公园',
        address: '杭州',
        coordSystem: 'WGS84',
      }),
    ]);
  });

  it('uses component-owned google places search in mapService mode and emits standardized selection results', async () => {
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
    const onSearchResultSelected = vi.fn();
    const legacyOnSelect = vi.fn();
    const plugin = new MapPlugin('map', {
      mapService: {
        provider: 'google',
        serviceKey: 'google-key',
      },
      providerSearch: {
        request,
      },
      onSearchResultSelected,
    });

    const callbacks = (plugin as any).buildToolbarCallbacks({
      onSelect: legacyOnSelect,
    });
    const results = await callbacks.onSearch('杭州西湖');

    expect(request).toHaveBeenCalledTimes(1);
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

    const flyTo = vi.fn();
    (plugin as any).viewer = {
      camera: {
        positionCartographic: {
          height: 5200,
        },
        heading: 0.4,
        pitch: -0.8,
        roll: 0.03,
        flyTo,
      },
    };

    const fromDegreesSpy = vi.spyOn(Cesium.Cartesian3, 'fromDegrees').mockReturnValue({} as Cesium.Cartesian3);
    await callbacks.onResultSelect?.(results[0]);

    expect(fromDegreesSpy).toHaveBeenCalledWith(120.153576, 30.243382, 5200);
    expect(flyTo).toHaveBeenCalledTimes(1);
    expect(legacyOnSelect).toHaveBeenCalledWith({
      provider: 'google',
      name: '杭州西湖',
      address: '中国浙江省杭州市西湖区',
      longitude: 120.153576,
      latitude: 30.243382,
      height: 5200,
      coordSystem: 'WGS84',
    });
    expect(onSearchResultSelected).toHaveBeenCalledWith({
      provider: 'google',
      name: '杭州西湖',
      address: '中国浙江省杭州市西湖区',
      longitude: 120.153576,
      latitude: 30.243382,
      height: 5200,
      coordSystem: 'WGS84',
    });

    fromDegreesSpy.mockRestore();
  });

  it('uses component-owned baidu search selection to preserve camera height and emit WGS-84 results', () => {
    const onSearchResultSelected = vi.fn();
    const plugin = new MapPlugin('map', {
      mapService: {
        provider: 'baidu',
        serviceKey: 'baidu-ak',
      },
      onSearchResultSelected,
    });

    const flyTo = vi.fn();
    (plugin as any).viewer = {
      camera: {
        positionCartographic: {
          height: 3600,
        },
        heading: 0.1,
        pitch: -0.5,
        roll: 0.02,
        flyTo,
      },
    };

    const fromDegreesSpy = vi.spyOn(Cesium.Cartesian3, 'fromDegrees').mockReturnValue({} as Cesium.Cartesian3);
    const selected = (plugin as any).handleMapServiceSearchSelection({
      name: '东方明珠',
      address: '上海',
      longitude: 121.499809,
      latitude: 31.239666,
      coordSystem: 'BD09',
    });

    const expectedPoint = coordinateService.toWGS84(
      {
        longitude: 121.499809,
        latitude: 31.239666,
      },
      'BD09',
    );

    expect(fromDegreesSpy).toHaveBeenCalledWith(
      expect.closeTo(expectedPoint.longitude, 6),
      expect.closeTo(expectedPoint.latitude, 6),
      3600,
    );
    expect(flyTo).toHaveBeenCalledTimes(1);
    expect(selected).toEqual({
      provider: 'baidu',
      name: '东方明珠',
      address: '上海',
      longitude: expect.closeTo(expectedPoint.longitude, 6),
      latitude: expect.closeTo(expectedPoint.latitude, 6),
      height: 3600,
      coordSystem: 'WGS84',
    });
    expect(onSearchResultSelected).toHaveBeenCalledWith({
      provider: 'baidu',
      name: '东方明珠',
      address: '上海',
      longitude: expect.closeTo(expectedPoint.longitude, 6),
      latitude: expect.closeTo(expectedPoint.latitude, 6),
      height: 3600,
      coordSystem: 'WGS84',
    });

    fromDegreesSpy.mockRestore();
  });
});
