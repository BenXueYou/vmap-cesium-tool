// 绘图辅助工具存根实现
// 为了保持向后兼容性

import type { Cartesian3, Color, Entity } from 'cesium';

export class BaseDraw {
  constructor(viewer: any, options?: any) {}
  startDrawing(options?: DrawOptions): void {}
  stopDrawing(): void {}
  clear(): void {}
  addPointForHelper(position: any): void {}
  updateDrawingEntity(position: any): void {}
  removeLastPointAndRedraw(): void {}
  finishDrawing(): DrawResult | null { return null; }
  clearTempEntitiesForHelper(): void {}
  clearTempPointEntitiesForHelper(): void {}
  getTempPositions(): any[] { return []; }
  getTempEntities(): any[] { return []; }
  getTempLabelEntities(): any[] { return []; }
  getFinishedPointEntities(): any[] { return []; }
}

export class DrawLine extends BaseDraw {}
export class DrawPolygon extends BaseDraw {}
export class DrawRectangle extends BaseDraw {}
export class DrawCircle extends BaseDraw {}

export interface DrawCallbacks {
  onDrawStart?: () => void;
  onDrawEnd?: (entity: any) => void;
  onDrawComplete?: (result: any) => void;
  onEntityRemoved?: (entity: any) => void;
  onMeasureComplete?: (result: DrawResult) => void;
}

export interface DrawOptions {
  material?: any;
  outlineMaterial?: any;
  fillColor?: any;
  strokeColor?: any;
  outlineColor?: any;
  outlineWidth?: number;
  strokeWidth?: number;
  showAreaLabel?: boolean;
  showDistanceLabel?: boolean;
  onClick?: (entity: any) => void;
  selected?: boolean;
  selfIntersectionEnabled?: boolean;
  selfIntersectionAllowTouch?: boolean;
  selfIntersectionAllowContinue?: boolean;
}

export type DrawEntity = Entity & {
  id: string;
  type: string;
  positions: any[];
  _drawType?: string;
  _drawOptions?: DrawOptions;
  _onClick?: (entity: any) => void;
  _groundPosition?: any;
  _groundPositions?: any[];
  _labelEntities?: Entity[];
};

export interface DrawResult {
  type: 'line' | 'polygon' | 'rectangle' | 'circle';
  positions: any[];
  distance?: number;
  areaKm2?: number;
  entity?: Entity;
}

export function toggleSelectedStyle(entity: any, selected: boolean = true): void {
  // 存根实现
}