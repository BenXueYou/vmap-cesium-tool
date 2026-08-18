import { shallowRef } from 'vue';
import * as Cesium from 'cesium';
import { getViteCesiumToken } from '../src/utils/common';
import {
  createMapPlugin,
  DrawService,
  MapPlugin,
  ToolbarService,
  type MapPluginOptions,
} from '../src/index';
import { i18n } from '../src/i18n';
import { toolbarLayersMenu, toolbarMeasureMenu, toolbarSearchMenu, toolbarButtonConfigs } from './z.const';
import { buildPlaygroundMapService } from './mapServiceConfig';
import { buildPlaygroundToolbarLayersMenu } from './toolbarMapTypes';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function mergeOptions<T>(base: T, overrides?: Partial<T>): T {
  if (!overrides) {
    return base;
  }

  const result: any = Array.isArray(base) ? [...(base as unknown[])] : { ...(base as Record<string, unknown>) };

  Object.entries(overrides as Record<string, unknown>).forEach(([key, overrideValue]) => {
    if (overrideValue === undefined) {
      return;
    }

    const baseValue = result[key];
    if (Array.isArray(overrideValue)) {
      result[key] = [...overrideValue];
      return;
    }

    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = mergeOptions(baseValue, overrideValue);
      return;
    }

    result[key] = overrideValue;
  });

  return result as T;
}

function createDefaultOptions(
  onSearchResultSelected?: MapPluginOptions['onSearchResultSelected'],
): Partial<MapPluginOptions> {
  const cesiumTokenValue = getViteCesiumToken();

  return {
    cesiumToken: cesiumTokenValue,
    viewerOptions: {
      animation: false,
      timeline: false,
      navigationHelpButton: false,
    },
    camera: {
      center: [116.3974, 39.9093, 1000] as [number, number, number],
      pitch: -45,
      heading: 0,
      roll: 0,
    },
    mapService: buildPlaygroundMapService('tdt'),
    onSearchResultSelected,
    noFlyZone: {
      autoLoad: true,
      visible: true,
      extrudedHeight: 10,
    },
    services: {
      overlay: true,
      draw: {
        enabled: true,
        i18n,
        useI18n: true,
      },
      toolbar: {
        enabled: true,
        config: {
          position: 'bottom-right',
          buttonSize: 36,
          buttonSpacing: 8,
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          zIndex: 1100,
          useI18n: true,
          i18n,
        },
        searchMenu: toolbarSearchMenu,
        measureMenu: toolbarMeasureMenu,
        layersMenu: toolbarLayersMenu,
        buttonConfigs: toolbarButtonConfigs,
      },
    },
  };
}

export function useMapInit(containerId = 'cesiumContainer') {
  const mapPlugin = shallowRef<MapPlugin | null>(null);
  const toolbarService = shallowRef<ToolbarService | null>(null);
  const drawService = shallowRef<DrawService | null>(null);
  const viewer = shallowRef<Cesium.Viewer | null>(null);
  const lastOverrides = shallowRef<Partial<MapPluginOptions>>({});

  const initMap = async (overrides: Partial<MapPluginOptions> = {}): Promise<Cesium.Viewer | null> => {
    if (viewer.value) {
      return viewer.value;
    }

    try {
      lastOverrides.value = overrides;
      const baseOptions = createDefaultOptions(overrides.onSearchResultSelected);
      const pluginOptions = mergeOptions(baseOptions, overrides);

      if (typeof pluginOptions.services?.toolbar === 'object') {
        pluginOptions.services.toolbar = {
          ...pluginOptions.services.toolbar,
          layersMenu: buildPlaygroundToolbarLayersMenu(pluginOptions),
        };
      }

      mapPlugin.value = createMapPlugin(containerId, pluginOptions);
      viewer.value = await mapPlugin.value.initialize();
      toolbarService.value = mapPlugin.value.getToolbarService();
      drawService.value = mapPlugin.value.getDrawService();

      return viewer.value;
    } catch (error) {
      console.error('地图初始化失败:', error);
      return null;
    }
  };

  const destroyMap = (): void => {
    mapPlugin.value?.destroy();
    mapPlugin.value = null;
    toolbarService.value = null;
    drawService.value = null;
    viewer.value = null;
  };

  const rebuildMap = async (overrides: Partial<MapPluginOptions> = lastOverrides.value): Promise<Cesium.Viewer | null> => {
    destroyMap();
    return initMap(overrides);
  };

  return {
    mapPlugin,
    toolbarService,
    drawService,
    viewer,
    initMap,
    rebuildMap,
    destroyMap,
  };
}
