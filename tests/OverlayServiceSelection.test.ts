import { describe, expect, it, vi } from 'vitest';
import { OverlayService } from '../src/core/services/overlay/OverlayService';

interface FakeRoot extends Record<string, any> {
  id: string;
  show: boolean;
  _onClick?: (entity: FakeRoot) => void;
}

function createRoot(id: string): FakeRoot {
  const root: FakeRoot = {
    id,
    show: true,
  };
  root._highlightEntities = [root];
  root._selectable = true;
  return root;
}

function createService(roots: FakeRoot[]) {
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

  service.viewer = { scene: {} };
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
  return service as OverlayService & Record<string, any>;
}

describe('OverlayService selection flow', () => {
  it('commits selection before emitting the event and running the overlay callback', () => {
    const marker = createRoot('marker');
    const service = createService([marker]);
    const order: string[] = [];
    const snapshots: string[] = [];
    const events: Array<Record<string, unknown>> = [];

    service.onSelectionChange((event: Record<string, unknown>) => {
      order.push('selection');
      snapshots.push(service.getSelectedOverlayId());
      events.push(event);
    });

    marker._onClick = () => {
      order.push('callback');
      snapshots.push(service.getSelectedOverlayId());
    };

    service.handlePointerSelectionClick(marker);

    expect(service.getSelectedOverlayId()).toBe('marker');
    expect(order).toEqual(['selection', 'callback']);
    expect(snapshots).toEqual(['marker', 'marker']);
    expect(events).toHaveLength(1);
    expect(events[0].current).toBe(marker);
    expect(events[0].previous).toBeNull();
    expect(events[0].currentId).toBe("marker");
    expect(events[0].previousId).toBeNull();
    expect(events[0].reason).toBe("pointer-select");
  });

  it('toggles off on repeated pointer click and clears on empty click only when needed', () => {
    const marker = createRoot('marker');
    const service = createService([marker]);
    const reasons: string[] = [];

    service.onSelectionChange((event: Record<string, any>) => {
      reasons.push(event.reason);
    });

    service.handlePointerSelectionClick(marker);
    service.handlePointerSelectionClick(marker);
    service.handlePointerSelectionClick(null);

    expect(reasons).toEqual(['pointer-select', 'pointer-toggle-off']);
    expect(service.getSelectedOverlayId()).toBeNull();

    service.handlePointerSelectionClick(marker);
    service.handlePointerSelectionClick(null);

    expect(reasons).toEqual(['pointer-select', 'pointer-toggle-off', 'pointer-select', 'empty-click']);
    expect(service.getSelectedOverlayId()).toBeNull();
  });

  it('keeps API selection idempotent and preserves state on invalid targets', () => {
    const marker = createRoot('marker');
    const service = createService([marker]);
    const reasons: string[] = [];

    service.onSelectionChange((event: Record<string, any>) => {
      reasons.push(event.reason);
    });

    expect(service.selectOverlay('marker')).toBe(true);
    expect(service.selectOverlay('marker')).toBe(true);
    expect(service.selectOverlay('missing')).toBe(false);
    expect(service.getSelectedOverlayId()).toBe('marker');
    expect(reasons).toEqual(['api-select']);

    expect(service.clearSelection()).toBe(true);
    expect(service.clearSelection()).toBe(false);
    expect(reasons).toEqual(['api-select', 'api-clear']);
  });

  it('isolates listener and callback exceptions without rolling selection state back', () => {
    const marker = createRoot('marker');
    const service = createService([marker]);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const callbackStates: Array<string | null> = [];

    service.onSelectionChange(() => {
      throw new Error('listener failed');
    });

    marker._onClick = () => {
      callbackStates.push(service.getSelectedOverlayId());
      throw new Error('callback failed');
    };

    service.handlePointerSelectionClick(marker);

    expect(service.getSelectedOverlayId()).toBe('marker');
    expect(callbackStates).toEqual(['marker']);
    expect(warnSpy).toHaveBeenCalledTimes(2);

    warnSpy.mockRestore();
  });

  it('emits hidden and removed reasons, but destroys the whole service silently', () => {
    const marker = createRoot('marker');
    const service = createService([marker]);
    const events: Array<Record<string, unknown>> = [];
    const order: string[] = [];

    service.onSelectionChange((event: Record<string, unknown>) => {
      order.push(String(event.reason));
      events.push(event);
    });

    expect(service.selectOverlay('marker')).toBe(true);
    expect(service.setOverlayVisible('marker', false)).toBe(true);
    expect(service.getSelectedOverlayId()).toBeNull();
    expect(order).toEqual(['api-select', 'hidden']);
    expect(events[1]).toMatchObject({
      current: null,
      currentId: null,
      previous: marker,
      previousId: 'marker',
      reason: 'hidden',
    });

    marker.show = true;
    expect(service.selectOverlay('marker')).toBe(true);

    const overlayRecord = service.overlays.get('marker');
    overlayRecord.remove.mockImplementation(() => {
      order.push('remove');
    });

    expect(service.removeOverlay('marker')).toBe(true);
    expect(service.getSelectedOverlayId()).toBeNull();
    expect(order).toEqual(['api-select', 'hidden', 'api-select', 'removed', 'remove']);
    expect(events[3]).toMatchObject({
      current: null,
      currentId: null,
      previous: marker,
      previousId: 'marker',
      reason: 'removed',
    });

    const destroyMarker = createRoot('destroy-marker');
    const destroyService = createService([destroyMarker]);
    const destroyEvents: string[] = [];
    destroyService.onSelectionChange((event: Record<string, any>) => {
      destroyEvents.push(event.reason);
    });

    expect(destroyService.selectOverlay('destroy-marker')).toBe(true);
    destroyService.destroy();
    expect(destroyService.getSelectedOverlayId()).toBeNull();
    expect(destroyEvents).toEqual(['api-select']);
  });

  it('rejects duplicate root IDs without corrupting selection identity or pick-id normalization', () => {
    const original = createRoot('duplicate');
    const replacement = createRoot('duplicate');
    const service = createService([]);
    const firstOverlay = {
      getEntity: () => original,
      remove: vi.fn(),
    };
    const secondOverlay = {
      getEntity: () => replacement,
      remove: vi.fn(),
    };

    service.registerOverlay('duplicate', firstOverlay);
    expect(service.selectOverlay('duplicate')).toBe(true);
    expect(service.resolveOverlayByPickId('duplicate__fill')).toBe(original);

    expect(() => service.registerOverlay('duplicate', secondOverlay)).toThrowError(
      '[OverlayService] duplicate overlay id: duplicate',
    );

    expect(service.getOverlay('duplicate')).toBe(firstOverlay);
    expect(service.getSelectedOverlay()).toBe(original);
    expect(service.resolveOverlayByPickId('duplicate__fill')).toBe(original);
  });
});
