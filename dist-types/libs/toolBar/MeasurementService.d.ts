import type { Viewer } from 'cesium';
import type { MeasurementCallback } from '../CesiumMapModel';
import type { MeasurementCompleteEvent } from '../../core/services/toolbar/types';
export type MeasureMode = 'none' | 'distance' | 'area';
/**
 * 测量服务 - 存根实现
 * 为了保持向后兼容性
 */
export declare class MeasurementService {
    private drawHelper;
    private measurementCallback?;
    private currentMode;
    private completionListeners;
    private clearListeners;
    constructor(viewer: Viewer, drawHelper: any, measurementCallback?: MeasurementCallback);
    getMeasureMode(): MeasureMode;
    setupDrawHelperCallbacks(): void;
    onMeasurementComplete(callback: (event: MeasurementCompleteEvent) => void): void;
    onClearComplete(callback: () => void): void;
    startDistanceMeasurement(_drawOptions?: any): void;
    startAreaMeasurement(_drawOptions?: any): void;
    clearMeasurements(): void;
    private emitMeasurementComplete;
}
