import { describe, expect, it, vi } from 'vitest';
import { BaseOverlay, type BaseOverlayOptions } from '../src/core/entities/BaseOverlay';
import { OverlayService } from '../src/core/services/overlay/OverlayService';
import { OverlayServiceAdapter } from '../src/adapters/OverlayServiceAdapter';

interface FakeRoot extends Record<string, any> {
  id: string;
  show: boolean;
}

class TestOverlay extends BaseOverlay {
  update(_options: Partial<BaseOverlayOptions>): void {}
}

function createRoot(
  id: string,
  options: {
    selectable?: boolean;
    selectableInferred?: boolean;
    show?: boolean;
  } = {},
): FakeRoot {
  const root: FakeRoot = {
    id,
    show: options.show ?? true,
  };

  if (options.selectable !== undefined) {
    root._selectable = options.selectable;
  }
  if (options.selectableInferred !== undefined) {
    root._selectableInferred = options.selectableInferred;
  }

  root._highlightEntities = [root];
  return root;
}

function createService(roots: FakeRoot[], drillPick: any[] = []) {
  const service = Object.create(OverlayService.prototype) as OverlayService & Record<string, any>;
  const overlays = new Map(
    roots.map((root) => [
      root.id,
      {
        getEntity: () => root,
        remove: vi.fn(),
      },
    ]),
  );

  service.viewer = {
    scene: {
      drillPick: vi.fn(() => drillPick),
    },
  };
  service.overlays = overlays;
  service.entityOverlayMap = new Map();
  service.creationOrderById = new Map(roots.map((root, index) => [root.id, index + 1]));
  service.clickHighlightTargets = [];
  service.hoverHighlightTargets = [];
  service.picking = {
    enabled: true,
    hover: true,
    selection: true,
    pickWidth: 3,
    pickHeight: 3,
    drillLimit: 16,
    clickDebounceMs: 250,
  };
  service.selectionEnabled = true;
  service.selectedOverlayId = null;
  service.selectionListeners = new Set();
  service.highlightCache = new WeakMap();
  service.overlayEditState = null;
  return service as OverlayService & Record<string, any>;
}

function createAdapter(service: OverlayService) {
  const adapter = Object.create(OverlayServiceAdapter.prototype) as OverlayServiceAdapter & Record<string, any>;
  adapter.overlayService = service;
  return adapter;
}

describe('Overlay selectable metadata', () => {
  it('stores explicit selectable and legacy compatibility inference on root entities', () => {
    const explicit = new TestOverlay({} as any, {
      id: 'explicit',
      selectable: false,
    });
    const legacyClick = new TestOverlay({} as any, {
      id: 'legacy-click',
      clickHighlight: false,
    });
    const legacyCallback = new TestOverlay({} as any, {
      id: 'legacy-callback',
      onClick: vi.fn(),
    });
    const selectionOnly = new TestOverlay({} as any, {
      id: 'selection-only',
      selectionHighlight: true,
    });

    expect((explicit.getEntity() as any)._selectable).toBe(false);
    expect((explicit.getEntity() as any)._selectableInferred).toBe(false);
    expect((legacyClick.getEntity() as any)._selectable).toBeUndefined();
    expect((legacyClick.getEntity() as any)._selectableInferred).toBe(true);
    expect((legacyCallback.getEntity() as any)._selectableInferred).toBe(true);
    expect((selectionOnly.getEntity() as any)._selectableInferred).toBe(false);
  });
});

describe('OverlayService selectable flow', () => {
  it('skips non-selectable click candidates and keeps invalid API targets from disturbing state', () => {
    const nonSelectable = createRoot('top', { selectable: false });
    const selectable = createRoot('bottom', { selectable: true });
    const service = createService(
      [nonSelectable, selectable],
      [{ id: 'top' }, { id: 'bottom' }],
    );

    expect(service.selectOverlay('bottom')).toBe(true);
    expect(service.selectOverlay('top')).toBe(false);
    expect(service.getSelectedOverlayId()).toBe('bottom');

    selectable.show = false;
    expect(service.selectOverlay('bottom')).toBe(false);
    expect(service.getSelectedOverlayId()).toBe('bottom');

    selectable.show = true;
    expect(service.pickOverlayEntity({} as any, 'click')).toBe(selectable);
  });

  it('clears selected overlays with disabled reason when selectability is turned off', () => {
    const marker = createRoot('marker', { selectable: true });
    const service = createService([marker]);
    const reasons: string[] = [];

    service.onSelectionChange((event: Record<string, any>) => {
      reasons.push(event.reason);
    });

    expect(service.selectOverlay('marker')).toBe(true);
    expect(service.setOverlaySelectable('marker', false)).toBe(true);
    expect(service.getSelectedOverlayId()).toBeNull();
    expect(reasons).toEqual(['api-select', 'disabled']);

    expect(service.setOverlaySelectable('marker', true)).toBe(true);
    expect(service.selectOverlay('marker')).toBe(true);
    expect(service.getSelectedOverlayId()).toBe('marker');
  });
});

describe('OverlayServiceAdapter selectable bridge', () => {
  it('forwards runtime selection controls while preserving API selection access', () => {
    const marker = createRoot('marker', { selectable: true });
    const service = createService([marker]);
    const adapter = createAdapter(service);

    expect(adapter.selectOverlay('marker')).toBe(true);
    expect(service.getSelectedOverlayId()).toBe('marker');

    adapter.setSelectionEnabled(false);
    expect(service.selectionEnabled).toBe(false);
    expect(service.getSelectedOverlayId()).toBe('marker');

    expect(adapter.clearSelection()).toBe(true);
    expect(adapter.setOverlaySelectable('marker', false)).toBe(true);
    expect(adapter.selectOverlay('marker')).toBe(false);

    expect(adapter.setOverlaySelectable('marker', true)).toBe(true);
    expect(adapter.selectOverlay('marker')).toBe(true);
    expect(service.getSelectedOverlayId()).toBe('marker');
  });
});
