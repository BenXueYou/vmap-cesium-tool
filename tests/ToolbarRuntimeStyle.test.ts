import { describe, expect, it, vi } from 'vitest';
import { MapPlugin } from '../src/core/MapPlugin';
import { ToolbarAdapter } from '../src/adapters/ToolbarAdapter';
import { ToolbarService } from '../src/core/services/toolbar/ToolbarService';

describe('Toolbar runtime style APIs', () => {
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
