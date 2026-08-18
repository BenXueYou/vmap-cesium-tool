import { describe, expect, it } from 'vitest';
import { MapPlugin } from '../src/core/MapPlugin';
import zhCN from '../src/i18n/zh-CN';
import enUS from '../src/i18n/en-US';

describe('MapPlugin map configuration hint', () => {
  it('shows the hint only when the TianDiTu tk is missing', () => {
    const missingTk = new MapPlugin('map', {
      baseMap: { provider: 'tdt', token: '', sk: 'optional-sk' },
    });
    const tkWithoutSk = new MapPlugin('map', {
      baseMap: { provider: 'tdt', token: 'configured-tk' },
    });
    const otherProvider = new MapPlugin('map', {
      baseMap: { provider: 'gaode', type: 'satellite' },
    });

    expect((missingTk as any).shouldShowMapConfigHint()).toBe(true);
    expect((tkWithoutSk as any).shouldShowMapConfigHint()).toBe(false);
    expect((otherProvider as any).shouldShowMapConfigHint()).toBe(false);
  });

  it('provides localized map configuration messages', () => {
    expect(zhCN.map.config_required).toBeTruthy();
    expect(enUS.map.config_required).toBeTruthy();
  });
});
