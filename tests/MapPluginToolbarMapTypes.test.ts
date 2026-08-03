import { describe, expect, it } from 'vitest';
import { MapPlugin } from '../src/core/MapPlugin';
import { buildPlaygroundToolbarLayersMenu } from '../playground/toolbarMapTypes';
import type { MapPluginOptions } from '../src/core/types';

describe('MapPlugin toolbar map types wiring', () => {
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
