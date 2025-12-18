import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';
import DrawHelper from './CesiumMapHelper';
import type { MeasurementCallback } from '../CesiumMapModel';

export type MeasureMode = 'none' | 'distance' | 'area';

export class MeasurementService {
  private viewer: Viewer;
  private drawHelper: DrawHelper;
  private measurementCallback?: MeasurementCallback;
  private currentMode: MeasureMode = 'none';

  constructor(viewer: Viewer, drawHelper: DrawHelper, measurementCallback?: MeasurementCallback) {
    this.viewer = viewer;
    this.drawHelper = drawHelper;
    this.measurementCallback = measurementCallback;
  }

  public getMeasureMode(): MeasureMode {
    return this.currentMode;
  }

  public setupDrawHelperCallbacks(): void {
    this.drawHelper.onMeasureComplete((result) => {
      if (!this.measurementCallback) {
        return;
      }
      if (result.type === 'line' && this.measurementCallback.onDistanceComplete && typeof result.distance === 'number') {
        this.measurementCallback.onDistanceComplete(result.positions, result.distance);
      } else if (result.type === 'polygon' && this.measurementCallback.onAreaComplete && typeof result.areaKm2 === 'number') {
        this.measurementCallback.onAreaComplete(result.positions, result.areaKm2);
      }
    });

    this.drawHelper.onDrawStart(() => {
      console.log('开始绘制');
      if (this.measurementCallback?.onMeasurementStart) {
        this.measurementCallback.onMeasurementStart();
      }
    });

    this.drawHelper.onDrawEnd((entity) => {
      if (entity) {
        console.log('绘制完成', entity);
      }
      this.currentMode = 'none';
    });

    this.drawHelper.onEntityRemoved((entity) => {
      console.log('实体被移除', entity);
    });
  }

  public startAreaMeasurement(): void {
    this.currentMode = 'area';
    setTimeout(() => {
      this.drawHelper.startDrawingPolygon();
    }, 50);
  }

  public startDistanceMeasurement(): void {
    this.currentMode = 'distance';
    setTimeout(() => {
      this.drawHelper.startDrawingLine();
    }, 50);
  }

  public clearMeasurements(): void {
    this.currentMode = 'none';
    this.drawHelper.clearAll();
    if (this.measurementCallback?.onClear) {
      this.measurementCallback.onClear();
    }
  }
}
