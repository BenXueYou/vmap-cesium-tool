import { describe, expect, it } from 'vitest';
import { MapPlugin } from '../src/core/MapPlugin';
import { buildPlaygroundToolbarLayersMenu } from '../playground/toolbarMapTypes';
import type { MapPluginOptions } from '../src/core/types';

describe('MapPlugin toolbar map types wiring', () => {
  it('preserves published layers configuration and updateLayers behavior', () => {
    const plugin = new MapPlugin('legacy-map', {
      layers: {
        type: 'gaode',
        gaode: {
          mapTypeId: 'vector',
          token: 'legacy-key',
          showLabel: false,
        },
      },
    });
    expect(plugin.getConfig().baseMap).toMatchObject({
      provider: 'gaode',
      type: 'vector',
      key: 'legacy-key',
      showLabel: false,
    });
    expect(plugin.getConfig().layers?.gaode?.token).toBe('legacy-key');
    plugin.updateLayers({
      type: 'custom',
      custom: {
        providers: [],
        type: 'xyz',
        urlTemplate: '/tiles/{z}/{x}/{y}.png',
      },
    });
    expect(plugin.getConfig().baseMap).toMatchObject({
      provider: 'custom',
      type: 'xyz',
      urlTemplate: '/tiles/{z}/{x}/{y}.png',
    });
    expect(plugin.getConfig().layers?.custom?.urlTemplate).toBe('/tiles/{z}/{x}/{y}.png');
  });

  it('preserves the baseMap override and rejects layers in mapService mode', () => {
    const plugin = new MapPlugin('legacy-map', {
      layers: { type: 'gaode' },
      baseMap: { provider: 'tdt', type: 'vec' },
    });
    expect(plugin.getConfig().baseMap?.provider).toBe('tdt');
    expect(() => new MapPlugin('map', {
      layers: { type: 'tdt' },
      mapService: { provider: 'tdt', serviceKey: 'test-token' },
    })).toThrow('mapService');
    const servicePlugin = new MapPlugin('map', {
      mapService: { provider: 'tdt', serviceKey: 'test-token' },
    });
    expect(() => servicePlugin.updateLayers({ type: 'tdt' })).toThrow('updateLayers');
  });

  it('keeps nameKey on toolbar map types when playground-style layersMenu is provided', () => {
    const options: Partial<MapPluginOptions> = {
      baseMap: {
        provider: 'tdt',
        type: 'img',
        showLabel: true,
      },
      mapAuth: {
        tdt: { token: 'test-token' },
      },
      services: {
        toolbar: {
          enabled: true,
          layersMenu: {
            defaultPlaceNameChecked: true,
          },
        },
      },
    };

    const pluginOptions: Partial<MapPluginOptions> = {
      ...options,
      services: {
        ...options.services,
        toolbar: {
          ...(typeof options.services?.toolbar === 'object' ? options.services.toolbar : {}),
          layersMenu: buildPlaygroundToolbarLayersMenu(options),
        },
      },
    };

    const plugin = new MapPlugin('map', pluginOptions);
    const toolbarMapTypes = (plugin as any).toolbarMapTypes;

    expect(toolbarMapTypes.length).toBeGreaterThan(0);
    toolbarMapTypes.forEach((mapType: any) => {
      expect(mapType.nameKey, `${mapType.id} should retain nameKey inside MapPlugin`).toBeTruthy();
    });
  });
});
