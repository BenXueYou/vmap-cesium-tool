import { describe, expect, it } from 'vitest';
import { baseMapRegistry, buildDefaultBaseMap } from '../src/core/mapProviders/registry';
import zhCN from '../src/i18n/zh-CN';
import enUS from '../src/i18n/en-US';

function getNestedValue(source: Record<string, any>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

describe('base map type i18n contract', () => {
  it('provides nameKey for built-in toolbar map types', () => {
    const providers = ['tdt', 'gaode', 'tencent', 'baidu'] as const;

    providers.forEach((provider) => {
      const mapTypes = baseMapRegistry.getMapTypes(buildDefaultBaseMap(provider));
      expect(mapTypes.length).toBeGreaterThan(0);

      mapTypes.forEach((mapType) => {
        expect(mapType.nameKey, `${provider}:${mapType.id} should expose nameKey for locale switching`).toBeTruthy();
      });
    });
  });

  it('has zh-CN and en-US translations for built-in toolbar map types', () => {
    const keys = [
      'map.types.vec',
      'map.types.img',
      'map.types.ter',
      'map.types.tdt3d',
      'map.types.gaode_vector',
      'map.types.gaode_satellite',
      'map.types.tencent_vector',
      'map.types.tencent_satellite',
      'map.types.baidu_vector',
      'map.types.baidu_satellite',
    ];

    keys.forEach((key) => {
      expect(getNestedValue(zhCN as any, key), `zh-CN missing ${key}`).toBeTruthy();
      expect(getNestedValue(enUS as any, key), `en-US missing ${key}`).toBeTruthy();
    });
  });
});
