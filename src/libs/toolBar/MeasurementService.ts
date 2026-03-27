import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';
import type { MeasurementCallback } from '../CesiumMapModel';
import { calculatePolygonArea } from '../../utils/calc';
import { calculateTotalDistance } from '../../core/services/draw/geometry/drawGeometry';
import type { MeasurementCompleteEvent } from '../../core/services/toolbar/types';

export type MeasureMode = 'none' | 'distance' | 'area';

/**
 * 测量服务 - 存根实现
 * 为了保持向后兼容性
 */
export class MeasurementService {
  private drawHelper: any;
  private measurementCallback?: MeasurementCallback;
  private currentMode: MeasureMode = 'none';
  private completionListeners = new Set<(event: MeasurementCompleteEvent) => void>();
  private clearListeners = new Set<() => void>();

  constructor(viewer: Viewer, drawHelper: any, measurementCallback?: MeasurementCallback) {
    this.drawHelper = drawHelper;
    this.measurementCallback = measurementCallback;
    void viewer;
  }

  getMeasureMode(): MeasureMode {
    if (this.currentMode !== 'none' && typeof this.drawHelper?.isDrawing === 'function' && !this.drawHelper.isDrawing()) {
      this.currentMode = 'none';
    }

    return this.currentMode;
  }

  setupDrawHelperCallbacks(): void {
    if (typeof this.drawHelper?.onMeasureComplete === 'function') {
      this.drawHelper.onMeasureComplete((result: { type?: 'line' | 'polygon' | 'rectangle' | 'circle'; positions?: Cesium.Cartesian3[] } | null) => {
        if (!result || !Array.isArray(result.positions)) {
          return;
        }

        if (result.type === 'line') {
          this.emitMeasurementComplete({
            type: 'distance',
            positions: result.positions,
            value: calculateTotalDistance(result.positions),
          });
          return;
        }

        if (result.type === 'polygon' || result.type === 'rectangle' || result.type === 'circle') {
          this.emitMeasurementComplete({
            type: 'area',
            positions: result.positions,
            value: calculatePolygonArea(result.positions),
          });
        }
      });
      return;
    }

    if (typeof this.drawHelper?.onDrawEnd === 'function') {
      this.drawHelper.onDrawEnd((result: { positions?: Cesium.Cartesian3[] } | null) => {
        if (!result || !Array.isArray(result.positions) || this.currentMode === 'none') {
          return;
        }

        if (this.currentMode === 'distance') {
          this.emitMeasurementComplete({
            type: 'distance',
            positions: result.positions,
            value: calculateTotalDistance(result.positions),
          });
          return;
        }

        this.emitMeasurementComplete({
          type: 'area',
          positions: result.positions,
          value: calculatePolygonArea(result.positions),
        });
      });
    }
  }

  onMeasurementComplete(callback: (event: MeasurementCompleteEvent) => void): void {
    this.completionListeners.add(callback);
  }

  onClearComplete(callback: () => void): void {
    this.clearListeners.add(callback);
  }

  startDistanceMeasurement(_drawOptions?: any): void {
    this.currentMode = 'distance';
    this.measurementCallback?.onMeasurementStart?.();

    if (typeof this.drawHelper?.startDrawingLine === 'function') {
      this.drawHelper.startDrawingLine();
      return;
    }

    this.drawHelper?.startDrawing?.('line');
  }

  startAreaMeasurement(_drawOptions?: any): void {
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
    this.clearListeners.forEach((listener) => listener());
  }

  private emitMeasurementComplete(event: MeasurementCompleteEvent): void {
    this.currentMode = 'none';
    this.completionListeners.forEach((listener) => listener(event));
  }
}
