import { describe, expect, it, vi } from 'vitest';
import { PickGovernor } from '../src/utils/PickGovernor';
import { OverlayService } from '../src/core/services/overlay/OverlayService';
import { OverlayServiceAdapter } from '../src/adapters/OverlayServiceAdapter';

interface FakeRoot {
  id: string;
  show: boolean;
  _hoverHighlight?: boolean;
  _pickPriority?: number;
}

function createService(
  roots: FakeRoot[],
  pickedObjects: unknown[],
  drillPick = vi.fn(() => pickedObjects),
): { service: OverlayService & Record<string, any>; drillPick: typeof drillPick } {
  const service = Object.create(OverlayService.prototype) as OverlayService & Record<string, any>;
  service.viewer = { scene: { drillPick } };
  service.picking = {
    enabled: true,
    hover: true,
    selection: true,
    pickWidth: 3,
    pickHeight: 3,
    drillLimit: 16,
  };
  service.overlays = new Map(roots.map((root) => [root.id, { getEntity: () => root }]));
  service.entityOverlayMap = new Map();
  service.creationOrderById = new Map(roots.map((root, index) => [root.id, index + 1]));
  service.hoverHighlightTargets = [];
  service.highlightCache = new WeakMap();
  service.hoverEnabled = true;
  service.selectionEnabled = true;
  service.pickGovernor = {
    shouldPick: vi.fn(() => true),
  };
  return { service, drillPick };
}

function createAdapter(service: OverlayService) {
  const adapter = Object.create(OverlayServiceAdapter.prototype) as OverlayServiceAdapter & Record<string, any>;
  adapter.overlayService = service;
  return adapter;
}

describe('OverlayService deterministic hover picking', () => {
  it('uses one bounded 3x3 drill pick and lets priority beat visual order', () => {
    const lowPriority: FakeRoot = { id: 'low', show: true, _hoverHighlight: true, _pickPriority: 1 };
    const highPriority: FakeRoot = { id: 'high', show: true, _hoverHighlight: true, _pickPriority: 9 };
    const { service, drillPick } = createService(
      [lowPriority, highPriority],
      [{ id: 'low' }, { id: 'high' }],
    );

    const picked = service.pickOverlayEntity({ x: 100, y: 200 }, 'hover');

    expect(picked).toBe(highPriority);
    expect(drillPick).toHaveBeenCalledTimes(1);
    expect(drillPick).toHaveBeenCalledWith({ x: 100, y: 200 }, 16, 3, 3);
  });

  it('skips hidden and hover-ineligible roots before selecting the first eligible one', () => {
    const hidden: FakeRoot = { id: 'hidden', show: false, _hoverHighlight: true, _pickPriority: 100 };
    const clickOnly: FakeRoot = { id: 'click-only', show: true, _pickPriority: 90 };
    const visible: FakeRoot = { id: 'visible', show: true, _hoverHighlight: true, _pickPriority: 1 };
    const { service } = createService(
      [hidden, clickOnly, visible],
      [{ id: 'hidden' }, { id: 'click-only' }, { id: 'visible' }],
    );

    expect(service.pickOverlayEntity({ x: 0, y: 0 }, 'hover')).toBe(visible);
  });

  it('governs effective hover decisions without changing the resolver ordering', () => {
    const governor = new PickGovernor({
      profiles: { hover: { minIntervalMs: 100, minMovePx: 2 } },
    });

    expect(governor.shouldPick('hover', { x: 10, y: 10 }, 1000)).toBe(true);
    expect(governor.shouldPick('hover', { x: 11, y: 10 }, 1100)).toBe(false);
    expect(governor.shouldPick('hover', { x: 13, y: 10 }, 1101)).toBe(true);
  });

  it('recomputes hover immediately after runtime priority changes and manual refresh', () => {
    const lowPriority: FakeRoot = { id: 'low', show: true, _hoverHighlight: true, _pickPriority: 1, _selectable: true };
    const highPriority: FakeRoot = { id: 'high', show: true, _hoverHighlight: true, _pickPriority: 0, _selectable: true };
    lowPriority._highlightEntities = [lowPriority];
    highPriority._highlightEntities = [highPriority];

    const { service } = createService(
      [lowPriority, highPriority],
      [{ id: 'low' }, { id: 'high' }],
    );

    service.lastHoverPosition = { x: 24, y: 48 };

    expect(service.refreshHover()).toBe(true);
    expect(service.hoverHighlightTargets).toEqual([lowPriority]);
    expect(service.pickOverlayEntity({ x: 24, y: 48 }, 'click')).toBe(lowPriority);

    expect(service.setOverlayPickPriority('high', 9)).toBe(true);
    expect(highPriority._pickPriority).toBe(9);
    expect(service.hoverHighlightTargets).toEqual([highPriority]);
    expect(service.pickOverlayEntity({ x: 24, y: 48 }, 'click')).toBe(highPriority);

    lowPriority._pickPriority = 12;
    expect(service.refreshHover()).toBe(true);
    expect(service.hoverHighlightTargets).toEqual([lowPriority]);
  });
});

describe('OverlayServiceAdapter hover refresh bridge', () => {
  it('forwards runtime priority and hover refresh controls', () => {
    const base: FakeRoot = { id: 'base', show: true, _hoverHighlight: true, _pickPriority: 1 };
    const raised: FakeRoot = { id: 'raised', show: true, _hoverHighlight: true, _pickPriority: 0 };
    base._highlightEntities = [base];
    raised._highlightEntities = [raised];

    const { service } = createService(
      [base, raised],
      [{ id: 'base' }, { id: 'raised' }],
    );
    const adapter = createAdapter(service);

    service.lastHoverPosition = { x: 6, y: 9 };
    expect(adapter.refreshHover()).toBe(true);
    expect(service.hoverHighlightTargets).toEqual([base]);

    expect(adapter.setOverlayPickPriority('raised', 5)).toBe(true);
    expect(service.hoverHighlightTargets).toEqual([raised]);
  });
});
