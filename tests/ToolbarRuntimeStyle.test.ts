import { describe, expect, it, vi } from 'vitest';
import { MapPlugin } from '../src/core/MapPlugin';
import { ToolbarAdapter } from '../src/adapters/ToolbarAdapter';
import { ToolbarService } from '../src/core/services/toolbar/ToolbarService';
import { i18n } from '../src/i18n';

describe('Toolbar runtime style APIs', () => {
  const collectInitializedButtonIds = (service: ToolbarService): string[] => {
    const addedIds: string[] = [];
    const configs = (service as any).buttonConfigs as Array<{ id: string }>;

    (service as any).toolbar = {
      addButton: vi.fn((config: { id: string }) => addedIds.push(config.id)),
      getButton: vi.fn(() => undefined),
    };
    (service as any).buttonHandlers = new Map(
      configs.map(({ id }) => [id, { handleClick: vi.fn() }]),
    );
    (service as any).initializeButtons();

    return addedIds;
  };

  it('sorts initialized buttons by sort and treats sort zero as the first position', () => {
    const service = new ToolbarService(
      {
        viewer: {},
        container: {} as HTMLElement,
      },
      {
        buttonConfigs: [
          { id: 'measure', icon: false, sort: 1 },
          { id: 'search', icon: false, sort: 0 },
        ],
      },
    );

    expect(collectInitializedButtonIds(service)).toEqual(['search', 'measure']);
  });

  it('initializes and displays buttons in buttonConfigs order when buttonOrder is input', () => {
    const service = new ToolbarService(
      {
        viewer: {},
        container: {} as HTMLElement,
      },
      {
        buttonOrder: 'input',
        buttonConfigs: [
          { id: 'fullscreen', icon: false },
          { id: 'search', icon: false },
          { id: 'layers', icon: false },
        ],
      },
    );

    expect(collectInitializedButtonIds(service)).toEqual(['fullscreen', 'search', 'layers']);
    expect((service as any).buttonConfigs.map((config: { sort?: number }) => config.sort)).toEqual([0, 1, 2]);
  });

  it('passes custom measurement menu items to the measure handler', () => {
    const customItems = [
      {
        id: 'measure-distance',
        text: 'Custom distance',
        icon: 'custom-distance.svg',
      },
    ];
    const service = new ToolbarService(
      {
        viewer: {},
        container: {} as HTMLElement,
      },
      {
        measureMenu: { items: customItems },
      },
    );

    (service as any).registerDefaultButtonHandlers();

    expect((service.getButtonHandler('measure') as any).options.menuItems).toBe(customItems);
  });

  it('uses the built-in i18n instance when no custom instance is provided', () => {
    const service = new ToolbarService({
      viewer: {},
      container: {} as HTMLElement,
    });

    expect((service as any).i18n).toBe(i18n);
    expect((service as any).i18n.t('layers.map_type.place_name')).toBe('路网');
  });

  it('updates MapPlugin toolbar style state and forwards runtime patches', () => {
    const plugin = new MapPlugin('map', {
      services: {
        toolbar: {
          enabled: true,
          config: {
            position: 'bottom-right',
            buttonSize: 40,
          },
        },
      },
    });

    const toolbarService = {
      updateToolbarStyle: vi.fn(),
      getToolbarStyle: vi.fn(() => ({
        position: 'top-left',
        buttonSize: 48,
        offsetTop: 20,
      })),
    };

    (plugin as any).toolbarService = toolbarService;

    plugin.updateToolbarStyle({
      position: 'top-left',
      buttonSize: 48,
      offsetTop: 20,
    });

    expect(toolbarService.updateToolbarStyle).toHaveBeenCalledWith({
      position: 'top-left',
      buttonSize: 48,
      offsetTop: 20,
    });
    expect((plugin.getConfig().services as any).toolbar.config).toEqual(expect.objectContaining({
      position: 'top-left',
      buttonSize: 48,
      offsetTop: 20,
    }));
    expect(plugin.getToolbarConfig()).toEqual({
      position: 'top-left',
      buttonSize: 48,
      offsetTop: 20,
    });
  });

  it('updates MapPlugin toolbar position without recreating the map', () => {
    const plugin = new MapPlugin('map');
    const toolbarService = {
      updateToolbarStyle: vi.fn(),
      getToolbarStyle: vi.fn(() => ({
        position: 'bottom-left',
        offsetBottom: 18,
        offsetLeft: 12,
      })),
    };

    (plugin as any).toolbarService = toolbarService;

    plugin.setToolbarPosition('bottom-left', {
      offsetBottom: 18,
      offsetLeft: 12,
    });

    expect(toolbarService.updateToolbarStyle).toHaveBeenCalledWith({
      position: 'bottom-left',
      offsetBottom: 18,
      offsetLeft: 12,
    });
    expect(plugin.getToolbarConfig()).toEqual({
      position: 'bottom-left',
      offsetBottom: 18,
      offsetLeft: 12,
    });
  });

  it('exposes the same runtime style controls on ToolbarAdapter', () => {
    const adapter = Object.create(ToolbarAdapter.prototype) as ToolbarAdapter & Record<string, any>;
    adapter.config = {
      position: 'bottom-right',
      buttonSize: 36,
    };
    adapter.toolbarService = {
      updateToolbarStyle: vi.fn(),
      getToolbarStyle: vi.fn(() => ({
        position: 'top-right',
        offsetTop: 16,
        offsetRight: 10,
      })),
    };

    adapter.updateToolbarStyle({
      direction: 'row',
      buttonSpacing: 12,
    });
    adapter.setToolbarPosition('top-right', {
      offsetTop: 16,
      offsetRight: 10,
    });

    expect(adapter.toolbarService.updateToolbarStyle).toHaveBeenNthCalledWith(1, {
      direction: 'row',
      buttonSpacing: 12,
    });
    expect(adapter.toolbarService.updateToolbarStyle).toHaveBeenNthCalledWith(2, {
      position: 'top-right',
      offsetTop: 16,
      offsetRight: 10,
    });
    expect(adapter.config).toEqual(expect.objectContaining({
      position: 'top-right',
      direction: 'row',
      buttonSpacing: 12,
      offsetTop: 16,
      offsetRight: 10,
    }));
    expect(adapter.getToolbarStyle()).toEqual({
      position: 'top-right',
      offsetTop: 16,
      offsetRight: 10,
    });
  });

  it('lets ToolbarService manage position patches and expose the latest style snapshot', () => {
    const service = Object.create(ToolbarService.prototype) as ToolbarService & Record<string, any>;
    service.options = {
      toolbarStyle: {
        position: 'bottom-right',
      },
    };
    service.toolbar = {
      updateConfig: vi.fn(),
      getConfig: vi.fn(() => ({
        position: 'top-left',
        offsetTop: 24,
        offsetLeft: 18,
      })),
    };

    service.setToolbarPosition('top-left', {
      offsetTop: 24,
      offsetLeft: 18,
    });

    expect(service.toolbar.updateConfig).toHaveBeenCalledWith({
      position: 'top-left',
      offsetTop: 24,
      offsetLeft: 18,
    });
    expect(service.getToolbarStyle()).toEqual({
      position: 'top-left',
      offsetTop: 24,
      offsetLeft: 18,
    });
  });
});
