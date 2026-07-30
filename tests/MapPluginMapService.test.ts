import { describe, expect, it, vi } from 'vitest';
import { MapPlugin } from '../src/core/MapPlugin';
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
});
