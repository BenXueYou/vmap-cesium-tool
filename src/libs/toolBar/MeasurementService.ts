import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';
import type { MeasurementCallback } from '../CesiumMapModel';

export type MeasureMode = 'none' | 'distance' | 'area';

/**
 * 测量服务 - 存根实现
 * 为了保持向后兼容性
 */
export class MeasurementService {
  private viewer: Viewer;
  private drawHelper: any;
  private measurementCallback?: MeasurementCallback;
  private currentMode: MeasureMode = 'none';

  constructor(viewer: Viewer, drawHelper: any, measurementCallback?: MeasurementCallback) {
    this.viewer = viewer;
    this.drawHelper = drawHelper;
    this.measurementCallback = measurementCallback;
  }

  getMeasureMode(): MeasureMode {
    if (this.currentMode !== 'none' && typeof this.drawHelper?.isDrawing === 'function' && !this.drawHelper.isDrawing()) {
      this.currentMode = 'none';
    }

    return this.currentMode;
  }

  setupDrawHelperCallbacks(): void {
    // 兼容旧接口：MeasurementService 只负责驱动绘制模式，回调转发继续交给外层工具栏。
  }

  startDistanceMeasurement(): void {
    this.currentMode = 'distance';
    this.measurementCallback?.onMeasurementStart?.();

    if (typeof this.drawHelper?.startDrawingLine === 'function') {
      this.drawHelper.startDrawingLine();
      return;
    }

    this.drawHelper?.startDrawing?.('line');
  }

  startAreaMeasurement(): void {
    this.currentMode = 'area';
    this.measurementCallback?.onMeasurementStart?.();

    if (typeof this.drawHelper?.startDrawingPolygon === 'function') {
      this.drawHelper.startDrawingPolygon();
      return;
    }

    this.drawHelper?.startDrawing?.('polygon');
  }

  clearMeasurements(): void {
    this.currentMode = 'none';
    if (typeof this.drawHelper?.clearAll === 'function') {
      this.drawHelper.clearAll();
    } else if (typeof this.drawHelper?.clear === 'function') {
      this.drawHelper.clear();
    }

    this.measurementCallback?.onClear?.();
  }
}
