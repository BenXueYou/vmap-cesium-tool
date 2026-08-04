import * as Cesium from 'cesium';
import { describe, expect, it, vi } from 'vitest';
import { DrawService } from '../src/core/services/draw/DrawService';

type TestService = DrawService & Record<string, any>;

describe('DrawService self-intersection hint', () => {
  it('shows a localized red hint when polygon self-intersection is blocked', () => {
    const service = Object.create(DrawService.prototype) as TestService;
    const hintEntity = { id: 'hint' };
    const setHintEntity = vi.fn();
    const hintPosition = new Cesium.Cartesian3(1, 2, 3);
    const show = vi.fn(() => hintEntity);

    service.useI18n = true;
    service.i18n = {
      t: (key: string) => (key === 'draw.hint.polygon_no_intersection' ? '多边形不允许自相交' : key),
    };
    service.store = {
      isDrawing: () => true,
      getPreviewPosition: () => null,
      getTempPositions: () => [hintPosition],
      getHintEntity: () => null,
      setHintEntity,
    };
    service.hintController = {
      show,
      update: vi.fn(),
    };

    service.showPolygonNoIntersectionHint(undefined, {});

    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith(
      hintPosition,
      '多边形不允许自相交',
      expect.objectContaining({
        textColor: Cesium.Color.RED,
      }),
    );
    expect(setHintEntity).toHaveBeenCalledWith(hintEntity);
  });
});
