import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const { viewerConstructor, viewerBoundary } = vi.hoisted(() => ({
  viewerConstructor: vi.fn(),
  viewerBoundary: new Error('Viewer construction boundary'),
}));

vi.mock('cesium', async (importOriginal) => ({
  ...await importOriginal<typeof import('cesium')>(),
  Viewer: function (container: HTMLElement) {
    viewerConstructor(container);
    throw viewerBoundary;
  },
}));
// The public barrel creates a style singleton on import. It is unrelated to
// container resolution and requires a browser even before any map is created.
vi.mock('../src/styles', () => ({ initStyleSystem: vi.fn() }));

import {
  MapPlugin,
  createMapPlugin,
  createVMap,
  initCesium,
} from '../src/index';

function htmlElement(ownerDocument: object, id = ''): HTMLElement {
  return {
    nodeType: 1,
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    ownerDocument,
    id,
    appendChild: vi.fn(),
  } as unknown as HTMLElement;
}

const entries = {
  constructor: (container: string | HTMLElement) =>
    new MapPlugin(container).initialize(),
  factory: (container: string | HTMLElement) =>
    createMapPlugin(container).initialize(),
  convenience: (container: string | HTMLElement) =>
    createVMap(container).initialize(),
  legacy: (container: string | HTMLElement) =>
    initCesium(container),
};

describe.each(Object.entries(entries))('%s public container input', (_, create) => {
  let currentDocument: { getElementById: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    currentDocument = { getElementById: vi.fn() };
    vi.stubGlobal('document', currentDocument);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    viewerConstructor.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('resolves strings only in the execution document', async () => {
    const target = htmlElement(currentDocument, 'map');
    currentDocument.getElementById.mockReturnValue(target);
    await expect(create('map')).rejects.toBe(viewerBoundary);
    expect(currentDocument.getElementById).toHaveBeenCalledExactlyOnceWith('map');
    expect(viewerConstructor).toHaveBeenCalledExactlyOnceWith(target);
  });

  it.each(['', 'duplicate'])('passes the exact current document element (%s)', async (id) => {
    const target = htmlElement(currentDocument, id);
    currentDocument.getElementById.mockReturnValue(htmlElement(currentDocument, id));
    await expect(create(target)).rejects.toBe(viewerBoundary);
    expect(viewerConstructor).toHaveBeenCalledExactlyOnceWith(target);
    expect(currentDocument.getElementById).not.toHaveBeenCalled();
  });

  it.each(['', 'duplicate'])('passes a foreign document element without looking up its ID (%s)', async (id) => {
    const foreignDocument = { getElementById: vi.fn() };
    const target = htmlElement(foreignDocument, id);
    currentDocument.getElementById.mockReturnValue(htmlElement(currentDocument, id));
    await expect(create(target)).rejects.toBe(viewerBoundary);
    expect(viewerConstructor).toHaveBeenCalledExactlyOnceWith(target);
    expect(currentDocument.getElementById).not.toHaveBeenCalled();
    expect(foreignDocument.getElementById).not.toHaveBeenCalled();
  });

  it('does not search another document for a missing string ID', async () => {
    currentDocument.getElementById.mockReturnValue(null);
    await expect(create('foreign-only')).rejects.toThrow('找不到 ID 为"foreign-only"的容器元素');
    expect(viewerConstructor).not.toHaveBeenCalled();
  });

  it.each([
    null,
    {},
    { nodeType: 3 },
    {
      nodeType: 1,
      namespaceURI: 'http://www.w3.org/2000/svg',
      ownerDocument: {},
      appendChild: vi.fn(),
    },
  ])('rejects non HTML container input before constructing Viewer: %j', async (input) => {
    await expect(create(input as HTMLElement)).rejects.toThrow('地图容器必须是字符串 ID 或 HTML 元素');
    expect(viewerConstructor).not.toHaveBeenCalled();
  });
});
