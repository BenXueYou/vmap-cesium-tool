import { describe, expect, it, vi } from 'vitest';
import { MapPlugin } from '../src/core/MapPlugin';
import { zoomLevelToHeight } from '../src/utils/common';

function applyZoomConstraints(plugin: MapPlugin): Record<string, number> {
  const controller: Record<string, number> = {};
  (plugin as any).viewer = {
    scene: {
      screenSpaceCameraController: controller,
    },
  };
  (plugin as any).applyCameraZoomConstraints();
  return controller;
}

describe('MapPlugin camera zoom constraints', () => {
  it('limits user interaction to logical zoom levels 1 through 20 by default', () => {
    const controller = applyZoomConstraints(new MapPlugin('map'));

    expect(controller.minimumZoomDistance).toBe(zoomLevelToHeight(20));
    expect(controller.maximumZoomDistance).toBe(zoomLevelToHeight(1));
  });

  it('uses caller-provided logical zoom levels', () => {
    const controller = applyZoomConstraints(new MapPlugin('map', {
      camera: {
        center: [116.3974, 39.9093, 1000],
        minZoomLevel: 4,
        maxZoomLevel: 16,
      },
    }));

    expect(controller.minimumZoomDistance).toBe(zoomLevelToHeight(16));
    expect(controller.maximumZoomDistance).toBe(zoomLevelToHeight(4));
  });

  it('rejects an inverted logical zoom range', () => {
    expect(() => new MapPlugin('map', {
      camera: {
        center: [116.3974, 39.9093, 1000],
        minZoomLevel: 20,
        maxZoomLevel: 1,
      },
    })).toThrow(RangeError);
  });

  it('keeps the component toolbar within the configured distance range', () => {
    const zoomOut = vi.fn();
    const plugin = new MapPlugin('map');
    (plugin as any).viewer = {
      camera: {
        positionCartographic: { height: zoomLevelToHeight(1) },
        zoomOut,
      },
      scene: {
        screenSpaceCameraController: {
          minimumZoomDistance: zoomLevelToHeight(20),
          maximumZoomDistance: zoomLevelToHeight(1),
        },
      },
    };

    (plugin as any).getToolbarController().zoomOut();

    expect(zoomOut).toHaveBeenCalledWith(0);
  });
});
