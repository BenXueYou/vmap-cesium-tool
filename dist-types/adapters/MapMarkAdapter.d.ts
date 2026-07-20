import type * as Cesium from 'cesium';
import type { MarkCallbacks, MarkDrawOptions, MarkDrawResult, MarkDrawType, MarkExportItem, MarkServiceOptions, MarkWorkAreaKind, MarkWorkAreaType } from '../core/services/mark';
export interface CesiumMapMarkOptions extends MarkServiceOptions {
    callbacks?: MarkCallbacks;
}
export declare class MapMarkAdapter {
    private readonly service;
    constructor(viewer: Cesium.Viewer, options?: CesiumMapMarkOptions);
    startDrawing(type: MarkDrawType, options?: MarkDrawOptions): void;
    drawPoint(options?: MarkDrawOptions): void;
    drawPolyline(options?: MarkDrawOptions): void;
    drawPolygon(options?: MarkDrawOptions): void;
    drawRectangle(options?: MarkDrawOptions): void;
    drawCircle(options?: MarkDrawOptions): void;
    startWorkAreaDraw(type: MarkWorkAreaType, kind?: MarkWorkAreaKind, options?: MarkDrawOptions): void;
    stopDraw(): void;
    cancelDrawing(): void;
    clearAll(): void;
    deleteEntity(entity: Cesium.Entity | string): void;
    enableEdit(): void;
    disableEdit(): MarkDrawResult | null;
    startEdit(entity: Cesium.Entity | string): boolean;
    stopEdit(): MarkDrawResult | null;
    setColor(type: MarkDrawType, color: string): void;
    getColor(type: MarkDrawType): string;
    getEntities(): Cesium.Entity[];
    exportData(): MarkExportItem[];
    destroy(): void;
}
