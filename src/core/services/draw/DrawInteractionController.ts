import * as Cesium from 'cesium';
import type { Cartesian3, Viewer } from 'cesium';

import { isValidCartesian3 } from './geometry/drawPosition';

export class DrawInteractionController {
  private screenSpaceEventHandler: Cesium.ScreenSpaceEventHandler | null = null;

  constructor(private readonly viewer: Viewer) {}

  activate(handlers: {
    onLeftClick(position: Cartesian3): void;
    onRightClick(): void;
    onMouseMove(position: Cartesian3): void;
    onDoubleClick(position: Cartesian3): void;
  }): void {
    this.deactivate();

    this.screenSpaceEventHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    this.screenSpaceEventHandler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const cartesian = this.pickGlobePosition(click.position);
      if (cartesian) {
        handlers.onLeftClick(cartesian);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    this.screenSpaceEventHandler.setInputAction(() => {
      handlers.onRightClick();
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    this.screenSpaceEventHandler.setInputAction((move: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      const cartesian = this.pickGlobePosition(move.endPosition);
      if (cartesian) {
        handlers.onMouseMove(cartesian);
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    this.screenSpaceEventHandler.setInputAction((dblClick: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const cartesian = this.pickGlobePosition(dblClick.position);
      if (cartesian) {
        handlers.onDoubleClick(cartesian);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  }

  deactivate(): void {
    if (this.screenSpaceEventHandler) {
      this.screenSpaceEventHandler.destroy();
      this.screenSpaceEventHandler = null;
    }
  }

  pickGlobePosition(windowPosition: Cesium.Cartesian2): Cartesian3 | null {
    const anyPosition = windowPosition as { x?: number; y?: number } | null;
    if (!anyPosition || !Number.isFinite(anyPosition.x) || !Number.isFinite(anyPosition.y)) {
      return null;
    }

    try {
      const ray = this.viewer.camera.getPickRay(windowPosition);
      if (ray) {
        const position = this.viewer.scene.globe.pick(ray, this.viewer.scene);
        if (isValidCartesian3(position)) {
          return position.clone();
        }
      }

      const ellipsoidPosition = this.viewer.camera.pickEllipsoid(
        windowPosition,
        this.viewer.scene.globe.ellipsoid,
      );
      if (isValidCartesian3(ellipsoidPosition)) {
        return ellipsoidPosition.clone();
      }
    } catch {
      return null;
    }

    return null;
  }

  destroy(): void {
    this.deactivate();
  }
}