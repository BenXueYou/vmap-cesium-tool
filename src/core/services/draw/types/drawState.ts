import type { Cartesian3, Entity } from 'cesium';

import type { DrawMode, DrawOptions, DrawResult, ResolvedMeasurementTheme } from './drawTypes';

export interface DrawSessionState {
  isDrawing: boolean;
  drawMode: DrawMode;
  options: DrawOptions | null;
  tempPositions: Cartesian3[];
  tempEntities: Entity[];
  finishedEntities: Entity[];
  finishedAuxEntities: Entity[];
  hintEntity: Entity | null;
  currentPreviewPosition: Cartesian3 | null;
}

export interface DrawCallbacks {
  onDrawStart?: () => void;
  onDrawEnd?: (result: DrawResult | null) => void;
  onEntityRemoved?: (entity: Entity) => void;
}

export interface FinishedDrawRecord {
  primary: Entity;
  auxiliary: Entity[];
}

export interface PreviewRenderContext {
  mode: DrawMode;
  positions: Cartesian3[];
  previewPoint?: Cartesian3;
  theme: ResolvedMeasurementTheme;
}

export interface FinalRenderContext {
  mode: Exclude<DrawMode, null>;
  positions: Cartesian3[];
  theme: ResolvedMeasurementTheme;
}

export interface EntityGroupRecord {
  primary: Entity;
  auxiliary: Entity[];
}