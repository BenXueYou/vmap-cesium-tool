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
});
