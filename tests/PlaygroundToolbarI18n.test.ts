import { describe, expect, it } from 'vitest';
import { buildPlaygroundToolbarLayersMenu } from '../playground/toolbarMapTypes';
import type { MapPluginOptions } from '../src/core/types';

describe('playground toolbar layers menu i18n contract', () => {
  it('injects localized mapTypes for the selected base map provider', () => {
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

    const layersMenu = buildPlaygroundToolbarLayersMenu(options);

    expect(layersMenu.mapTypes?.length).toBeGreaterThan(0);
    layersMenu.mapTypes?.forEach((mapType) => {
      expect(mapType.nameKey, `${mapType.id} should keep nameKey in playground config`).toBeTruthy();
    });
  });
});
