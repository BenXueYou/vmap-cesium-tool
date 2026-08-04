import { baseMapRegistry } from '../src/core/mapProviders/registry';
import type { MapPluginOptions } from '../src/core/types';
import { resolvePlaygroundBaseMap } from './mapServiceConfig';

export function buildPlaygroundToolbarLayersMenu(options: Partial<MapPluginOptions>) {
  const baseMap = resolvePlaygroundBaseMap(options);
  const mapTypes = baseMapRegistry.getMapTypes(baseMap, options.mapAuth);
  const toolbarOptions = typeof options.services?.toolbar === 'object' ? options.services.toolbar : {};

  return {
    ...(toolbarOptions.layersMenu || {}),
    mapTypes,
  };
}
