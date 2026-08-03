import { baseMapRegistry } from '../src/core/mapProviders/registry';
import type { BaseMapConfig, MapPluginOptions } from '../src/core/types';

export function resolvePlaygroundBaseMap(options: Partial<MapPluginOptions>): BaseMapConfig {
  if (options.baseMap) {
    return options.baseMap as BaseMapConfig;
  }

  switch (options.layers?.type) {
    case 'gaode':
      return {
        provider: 'gaode',
        type: options.layers.gaode?.mapTypeId || 'satellite',
        key: options.layers.gaode?.token,
        sk: options.layers.gaode?.sk,
        showLabel: options.layers.gaode?.showLabel ?? true,
      };
    case 'tencent':
      return {
        provider: 'tencent',
        type: options.layers.tencent?.mapTypeId || 'satellite',
        key: options.layers.tencent?.key || options.layers.tencent?.token,
        showLabel: options.layers.tencent?.showLabel ?? true,
      };
    case 'baidu':
      return {
        provider: 'baidu',
        type: options.layers.baidu?.mapTypeId || 'satellite',
        ak: options.layers.baidu?.token,
        sk: options.layers.baidu?.sk,
        showLabel: options.layers.baidu?.showLabel ?? true,
      };
    default:
      return {
        provider: 'tdt',
        type: options.layers?.tdt?.mapTypeId || 'img',
        token: options.layers?.tdt?.token,
        sk: options.layers?.tdt?.sk,
        showLabel: options.layers?.tdt?.showLabel ?? true,
      };
  }
}

export function buildPlaygroundToolbarLayersMenu(options: Partial<MapPluginOptions>) {
  const baseMap = resolvePlaygroundBaseMap(options);
  const mapTypes = baseMapRegistry.getMapTypes(baseMap, options.mapAuth);
  const toolbarOptions = typeof options.services?.toolbar === 'object' ? options.services.toolbar : {};

  return {
    ...(toolbarOptions.layersMenu || {}),
    mapTypes,
  };
}
