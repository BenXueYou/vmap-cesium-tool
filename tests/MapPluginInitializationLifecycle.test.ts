import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const runtime = vi.hoisted(() => ({
  viewers: [] as any[],
  load: Promise.resolve(),
  fail: false,
}));
vi.mock('cesium', async (original) => ({
  ...await original<typeof import('cesium')>(),
  Viewer: function (container: HTMLElement) {
    let destroyed = false;
    const viewer = {
      container,
      canvas: {},
      scene: {
        globe: {},
        postProcessStages: { fxaa: {} },
        screenSpaceCameraController: {},
        morphComplete: { addEventListener: vi.fn(() => vi.fn()) },
        requestRender: vi.fn(),
      },
      camera: { setView: vi.fn() },
      imageryLayers: {
        length: 0,
        removeAll: vi.fn(),
        addImageryProvider: vi.fn(),
      },
      dataSources: { remove: vi.fn() },
      isDestroyed: () => destroyed,
      destroy: vi.fn(() => { destroyed = true; }),
    };
    runtime.viewers.push(viewer);
    return viewer;
  },
}));
vi.mock('../src/core/mapProviders/registry', async (original) => ({
  ...await original<typeof import('../src/core/mapProviders/registry')>(),
  baseMapRegistry: {
    getMapTypes: () => [],
    getMapTypeById: () => ({
      id: 'gaode-satellite',
      provider: async () => {
        await runtime.load;
        if (runtime.fail) throw new Error('layer failed');
        return [];
      },
    }),
  },
}));
import { MapPlugin } from '../src/core/MapPlugin';

function plugin() {
  vi.stubGlobal('document', { getElementById: () => ({}) });
  const result = new MapPlugin('map', {
    baseMap: { provider: 'gaode', type: 'satellite' },
    services: { toolbar: false, overlay: false, draw: false },
  });
  // Credit DOM is outside this seam; keep real initialization and layer awaits.
  vi.spyOn(result as any, 'syncCreditDisplay').mockImplementation(() => {});
  return result;
}
afterEach(() => {
  runtime.load = Promise.resolve();
  runtime.fail = false;
  runtime.viewers.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('public MapPlugin initialization lifecycle', () => {
  it('releases the partially constructed viewer when layer loading fails', async () => {
    runtime.fail = true;
    const instance = plugin();
    await expect(instance.initialize()).rejects.toThrow('layer failed');
    expect(runtime.viewers[0].destroy).toHaveBeenCalledOnce();
    expect(instance.getViewer()).toBeNull();
    expect(instance.isReady()).toBe(false);
  });

  it('rejects stale initialization after destroy while layers are loading', async () => {
    let finish!: () => void;
    runtime.load = new Promise<void>((resolve) => { finish = resolve; });
    const instance = plugin();
    const pending = instance.initialize();
    instance.destroy();
    finish();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(instance.isReady()).toBe(false);
    expect(runtime.viewers[0].destroy).toHaveBeenCalledOnce();
  });

  it('does not destroy a viewer twice if its owner already destroyed it', async () => {
    const instance = plugin();
    const viewer = await instance.initialize();
    viewer.destroy();
    instance.destroy();
    expect(runtime.viewers[0].destroy).toHaveBeenCalledOnce();
  });

  it('aborts a pending viewer immediately without affecting a reopened instance', async () => {
    let finish!: () => void;
    runtime.load = new Promise<void>((resolve) => { finish = resolve; });
    const controller = new AbortController();
    const instance = plugin();
    const pending = instance.initialize(controller.signal);
    controller.abort();
    expect(runtime.viewers[0].destroy).toHaveBeenCalledOnce();
    runtime.load = Promise.resolve();
    const reopened = await instance.initialize();
    finish();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(instance.getViewer()).toBe(reopened);
    expect(instance.isReady()).toBe(true);
    expect(reopened.destroy).not.toHaveBeenCalled();
    instance.destroy();
  });

  it('does not create a viewer for an already aborted request', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(plugin().initialize(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(runtime.viewers).toHaveLength(0);
  });

  it('shares concurrent initialization for the same request without leaking a viewer', async () => {
    let finish!: () => void;
    runtime.load = new Promise<void>((resolve) => { finish = resolve; });
    const instance = plugin();
    const first = instance.initialize();
    const second = instance.initialize();
    expect(second).toBe(first);
    expect(runtime.viewers).toHaveLength(1);
    finish();
    expect(await first).toBe(await second);
    instance.destroy();
    expect(runtime.viewers[0].destroy).toHaveBeenCalledOnce();
  });
});
