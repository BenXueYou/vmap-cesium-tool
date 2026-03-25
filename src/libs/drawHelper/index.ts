// 绘图辅助工具存根实现
// 为了保持向后兼容性

export class BaseDraw {
  constructor(viewer: any, options?: any) {}
  startDrawing(): void {}
  stopDrawing(): void {}
  clear(): void {}
}

export class DrawLine extends BaseDraw {}
export class DrawPolygon extends BaseDraw {}
export class DrawRectangle extends BaseDraw {}
export class DrawCircle extends BaseDraw {}

export interface DrawCallbacks {
  onDrawStart?: () => void;
  onDrawEnd?: (entity: any) => void;
  onDrawComplete?: (result: any) => void;
}

export interface DrawOptions {
  material?: any;
  outlineMaterial?: any;
}

export interface DrawEntity {
  id: string;
  type: string;
  positions: any[];
}

export function toggleSelectedStyle(entity: any, selected: boolean): void {
  // 存根实现
}