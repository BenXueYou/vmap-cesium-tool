import type * as Cesium from 'cesium';
import { MarkService } from '../core/services/mark';
import type {
  MarkCallbacks,
  MarkDrawOptions,
  MarkDrawResult,
  MarkDrawType,
  MarkExportItem,
  MarkServiceOptions,
  MarkWorkAreaKind,
  MarkWorkAreaType,
} from '../core/services/mark';

export interface CesiumMapMarkOptions extends MarkServiceOptions {
  callbacks?: MarkCallbacks;
}

export class MapMarkAdapter {
  private readonly service: MarkService;

  constructor(
    viewer: Cesium.Viewer,
    options: CesiumMapMarkOptions = {},
  ) {
    this.service = new MarkService(viewer, options);
  }

  startDrawing(type: MarkDrawType, options?: MarkDrawOptions): void {
    this.service.startDrawing(type, options);
  }

  drawPoint(options?: MarkDrawOptions): void { this.service.drawPoint(options); }
  drawPolyline(options?: MarkDrawOptions): void { this.service.drawPolyline(options); }
  drawPolygon(options?: MarkDrawOptions): void { this.service.drawPolygon(options); }
  drawRectangle(options?: MarkDrawOptions): void { this.service.drawRectangle(options); }
  drawCircle(options?: MarkDrawOptions): void { this.service.drawCircle(options); }
  startWorkAreaDraw(type: MarkWorkAreaType, kind: MarkWorkAreaKind = 'work', options?: MarkDrawOptions): void {
    this.service.startWorkAreaDraw(type, kind, options);
  }

  stopDraw(): void { this.service.stopDraw(); }
  cancelDrawing(): void { this.service.cancelDrawing(); }
  clearAll(): void { this.service.clearAll(); }
  deleteEntity(entity: Cesium.Entity | string): void { this.service.deleteEntity(entity); }
  enableEdit(): void { this.service.enableEdit(); }
  disableEdit(): MarkDrawResult | null { return this.service.disableEdit(); }
  startEdit(entity: Cesium.Entity | string): boolean { return this.service.startEdit(entity); }
  stopEdit(): MarkDrawResult | null { return this.service.stopEdit(); }
  setColor(type: MarkDrawType, color: string): void { this.service.setColor(type, color); }
  getColor(type: MarkDrawType): string { return this.service.getColor(type); }
  getEntities(): Cesium.Entity[] { return this.service.getEntities(); }
  exportData(): MarkExportItem[] { return this.service.exportData(); }
  destroy(): void { this.service.destroy(); }
}
