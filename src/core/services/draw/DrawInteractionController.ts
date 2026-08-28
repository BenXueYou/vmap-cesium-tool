import * as Cesium from 'cesium';
import type { Cartesian3, Viewer } from 'cesium';

import { isValidCartesian3 } from './geometry/drawPosition';

/**
 * 绘图交互控制器类，用于处理地球场景中的用户交互事件
 */
export class DrawInteractionController {
  /**
   * 屏幕空间事件处理器，用于捕获和处理用户输入事件
   */
  private screenSpaceEventHandler: Cesium.ScreenSpaceEventHandler | null = null;

  /**
   * 构造函数
   * @param viewer Cesium三维场景查看器
   */
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

  /**
   * 根据窗口坐标获取地球表面的位置
   * @param windowPosition 窗口坐标，包含x和y属性
   * @returns 返回地球表面的Cartesian3坐标，如果无法确定位置则返回null
   */
  pickGlobePosition(windowPosition: Cesium.Cartesian2): Cartesian3 | null {
    // 将输入参数转换为包含可选x和y属性的对象，并检查其有效性
    const anyPosition = windowPosition as { x?: number; y?: number } | null;
    // 检查坐标是否存在且为有效数字
    if (!anyPosition || !Number.isFinite(anyPosition.x) || !Number.isFinite(anyPosition.y)) {
      return null;
    }

    try {
      // 尝试获取相机拾射线
      const ray = this.viewer.camera.getPickRay(windowPosition);
      if (ray) {
        // 使用射线拾取地球表面位置
        const position = this.viewer.scene.globe.pick(ray, this.viewer.scene);
        // 检查位置是否有效
        if (isValidCartesian3(position)) {
          // 返回位置的克隆以避免引用问题
          return position.clone();
        }
      }

      // 如果射线拾取失败，尝试直接拾取椭球面位置
      const ellipsoidPosition = this.viewer.camera.pickEllipsoid(
        windowPosition,
        this.viewer.scene.globe.ellipsoid,
      );
      // 检查椭球面位置是否有效
      if (isValidCartesian3(ellipsoidPosition)) {
        // 返回位置的克隆以避免引用问题
        return ellipsoidPosition.clone();
      }
    } catch {
      // 捕获任何可能的异常并返回null
      return null;
    }

    // 如果所有尝试都失败，返回null
    return null;
  }

  destroy(): void {
    this.deactivate();
  }
}