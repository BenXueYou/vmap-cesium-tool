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
  private measurementCallback?: MeasurementCallback;
  private currentMode: MeasureMode = 'none';

  constructor(viewer: Viewer, drawHelper: any, measurementCallback?: MeasurementCallback) {
    this.viewer = viewer;
    this.measurementCallback = measurementCallback;
  }

  getMeasureMode(): MeasureMode {
    return this.currentMode;
  }

  setupDrawHelperCallbacks(): void {
    // 存根实现
  }

  startDistanceMeasurement(): void {
    this.currentMode = 'distance';
  }

  startAreaMeasurement(): void {
    this.currentMode = 'area';
  }

  clearMeasurements(): void {
    this.currentMode = 'none';
  }
}
