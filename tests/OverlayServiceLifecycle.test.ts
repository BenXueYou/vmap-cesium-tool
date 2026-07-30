import { describe, expect, it, vi } from 'vitest';
import { OverlayService } from '../src/core/services/overlay/OverlayService';

interface FakeRoot extends Record<string, any> {
  id: string;
  show: boolean;
}

function createRoot(
  id: string,
  options: {
    hoverHighlight?: boolean;
    selectable?: boolean;
    selectableInferred?: boolean;
  } = {},
): FakeRoot {
  const root: FakeRoot = {
    id,
    show: true,
  };

  root._hoverHighlight = options.hoverHighlight ?? true;
  root._selectable = options.selectable;
  root._selectableInferred = options.selectableInferred ?? false;
  root._highlightEntities = [root];
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

  service.viewer = { scene: {}, camera: {} };
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
  service.hoverEnabled = true;
  service.selectionEnabled = true;
  service.selectedOverlayId = null;
  service.selectionListeners = new Set();
  service.highlightCache = new WeakMap();
  service.pickGovernor = {
    shouldPick: vi.fn(() => true),
  };
  service.drawInteractionActive = false;
  service.cameraHoverSuspended = false;
  service.overlayEditEnabled = false;
  service.overlayEditState = null;
  service.pendingHoverRaf = null;
  service.pendingHoverPosition = null;
  service.lastHoverPosition = null;
  return service as OverlayService & Record<string, any>;
}

describe('OverlayService interaction lifecycle coordination', () => {
  it('clears hover on camera move start and refreshes once at the last pointer position on move end', () => {
    const marker = createRoot('marker');
    const service = createService([marker]);
    const updateHoverAtPosition = vi.fn(() => true);

    service.lastHoverPosition = { x: 12, y: 18 };
    service.hoverHighlightTargets = [marker];
    service.updateHoverAtPosition = updateHoverAtPosition;

    service.handleCameraMoveStart();

    expect(service.cameraHoverSuspended).toBe(true);
    expect(service.hoverHighlightTargets).toEqual([]);
    expect(service.lastHoverPosition).toEqual({ x: 12, y: 18 });

    service.handleCameraMoveEnd();

    expect(service.cameraHoverSuspended).toBe(false);
    expect(updateHoverAtPosition).toHaveBeenCalledTimes(1);
    expect(updateHoverAtPosition).toHaveBeenCalledWith({ x: 12, y: 18 }, false);
  });

  it('forgets the reusable hover position on canvas leave', () => {
    const marker = createRoot('marker');
    const service = createService([marker]);

    service.pendingHoverPosition = { x: 4, y: 6 };
    service.lastHoverPosition = { x: 7, y: 9 };
    service.hoverHighlightTargets = [marker];

    service.handleCanvasPointerLeave();

    expect(service.hoverHighlightTargets).toEqual([]);
    expect(service.pendingHoverPosition).toBeNull();
    expect(service.lastHoverPosition).toBeNull();
  });

  it('suspends hover and pointer selection while drawing, then restores hover at the latest position', () => {
    const marker = createRoot('marker', { selectable: true });
    const service = createService([marker]);
    const updateHoverAtPosition = vi.fn(() => true);

    service.lastHoverPosition = { x: 30, y: 45 };
    service.hoverHighlightTargets = [marker];
    service.updateHoverAtPosition = updateHoverAtPosition;

    service.setDrawInteractionActive(true);

    expect(service.hoverHighlightTargets).toEqual([]);
    expect(service.isPointerSelectionInteractionAvailable()).toBe(false);
    expect(service.refreshHover()).toBe(false);

    service.setDrawInteractionActive(false);

    expect(service.isPointerSelectionInteractionAvailable()).toBe(true);
    expect(updateHoverAtPosition).toHaveBeenCalledTimes(1);
    expect(updateHoverAtPosition).toHaveBeenCalledWith({ x: 30, y: 45 }, false);
  });

  it('forces edit targets into selected with edit-start even when they are normally non-selectable', () => {
    const marker = createRoot('marker', { selectable: false });
    const service = createService([marker]);
    const reasons: string[] = [];

    service.onSelectionChange((event: Record<string, any>) => {
      reasons.push(event.reason);
    });

    service.activateSelectionForOverlayEdit(marker);

    expect(service.getSelectedOverlayId()).toBe('marker');
    expect(reasons).toEqual(['edit-start']);
  });

  it('ends editing before programmatic selection or clear, and only emits the final selection transition', () => {
    const editTarget = createRoot('edit-target', { selectable: false });
    const nextTarget = createRoot('next-target', { selectable: true });
    const selectionService = createService([editTarget, nextTarget]);
    const selectionReasons: string[] = [];
    const selectionStopSpy = vi.fn(() => {
      selectionService.overlayEditState = null;
      selectionService.overlayEditEnabled = false;
      return editTarget;
    });

    selectionService.selectedOverlayId = 'edit-target';
    selectionService.overlayEditState = { entity: editTarget };
    selectionService.stopOverlayEdit = selectionStopSpy;
    selectionService.onSelectionChange((event: Record<string, any>) => {
      selectionReasons.push(event.reason);
    });

    expect(selectionService.selectOverlay('next-target')).toBe(true);
    expect(selectionStopSpy).toHaveBeenCalledTimes(1);
    expect(selectionService.getSelectedOverlayId()).toBe('next-target');
    expect(selectionReasons).toEqual(['api-select']);

    const clearService = createService([editTarget]);
    const clearReasons: string[] = [];
    const clearStopSpy = vi.fn(() => {
      clearService.overlayEditState = null;
      clearService.overlayEditEnabled = false;
      return editTarget;
    });

    clearService.selectedOverlayId = 'edit-target';
    clearService.overlayEditState = { entity: editTarget };
    clearService.stopOverlayEdit = clearStopSpy;
    clearService.onSelectionChange((event: Record<string, any>) => {
      clearReasons.push(event.reason);
    });

    expect(clearService.clearSelection()).toBe(true);
    expect(clearStopSpy).toHaveBeenCalledTimes(1);
    expect(clearService.getSelectedOverlayId()).toBeNull();
    expect(clearReasons).toEqual(['api-clear']);
  });
});
