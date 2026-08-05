import { describe, expect, it, vi } from 'vitest';
import { OverlayServiceAdapter } from '../src/adapters/OverlayServiceAdapter';
import { MapMarkAdapter } from '../src/adapters/MapMarkAdapter';
import { CesiumOverlayService } from '../src/libs/CesiumOverlayService';

describe('editing compat adapters', () => {
  it('merges default and session edit options before forwarding legacy overlay edit entrypoints', () => {
    const overlayService = {
      setOverlayEditMode: vi.fn(),
      startOverlayEdit: vi.fn(() => true),
      stopOverlayEdit: vi.fn(),
    };

    const adapter = Object.create(OverlayServiceAdapter.prototype) as OverlayServiceAdapter & Record<string, any>;
    adapter.overlayService = overlayService;
    adapter.hoverEnabled = true;
    adapter.bulkUpdateDepth = 0;
    adapter.overlayEditOptions = {
      vertex: { pixelSize: 10 },
    };
    adapter.resolveOverlayEntity = vi.fn((entity: unknown) => entity);
    adapter.applyHoverState = vi.fn();

    expect(adapter.startOverlayEdit('overlay-1', {
      mid: { pixelSize: 9 },
    })).toBe(true);

    expect(overlayService.setOverlayEditMode).toHaveBeenCalledWith(true, {
      vertex: { pixelSize: 10 },
      mid: { pixelSize: 9 },
    });
    expect(overlayService.startOverlayEdit).toHaveBeenCalledWith('overlay-1', {
      vertex: { pixelSize: 10 },
      mid: { pixelSize: 9 },
    });

    adapter.stopOverlayEdit();
    expect(overlayService.stopOverlayEdit).toHaveBeenCalledTimes(1);
  });

  it('keeps the legacy CesiumOverlayService class on the same overlay edit bridge', () => {
    const overlayService = {
      setOverlayEditMode: vi.fn(),
      startOverlayEdit: vi.fn(() => true),
    };

    const legacy = Object.create(CesiumOverlayService.prototype) as CesiumOverlayService & Record<string, any>;
    legacy.overlayService = overlayService;
    legacy.hoverEnabled = true;
    legacy.bulkUpdateDepth = 0;
    legacy.overlayEditOptions = {
      vertex: { pixelSize: 10 },
    };
    legacy.resolveOverlayEntity = vi.fn((entity: unknown) => entity);
    legacy.applyHoverState = vi.fn();

    expect(legacy.startOverlayEdit('overlay-2', {
      move: { pixelSize: 11 },
    })).toBe(true);

    expect(overlayService.setOverlayEditMode).toHaveBeenCalledWith(true, {
      vertex: { pixelSize: 10 },
      move: { pixelSize: 11 },
    });
    expect(overlayService.startOverlayEdit).toHaveBeenCalledWith('overlay-2', {
      vertex: { pixelSize: 10 },
      move: { pixelSize: 11 },
    });
  });

  it('forwards mark edit start/stop results through the legacy map mark entrypoint', () => {
    const finalResult = {
      id: 'mark-1',
      type: 'point',
    };
    const service = {
      startEdit: vi.fn(() => true),
      stopEdit: vi.fn(() => finalResult),
    };

    const adapter = Object.create(MapMarkAdapter.prototype) as MapMarkAdapter & Record<string, any>;
    adapter.service = service;

    expect(adapter.startEdit('mark-1')).toBe(true);
    expect(adapter.stopEdit()).toBe(finalResult);
    expect(service.startEdit).toHaveBeenCalledWith('mark-1');
    expect(service.stopEdit).toHaveBeenCalledTimes(1);
  });
});
