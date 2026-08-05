import type * as Cesium from 'cesium';
import type { CoordSystem, LngLat } from '../../mapProviders/coordinates/types';
import type { OverlayEditOptions } from '../overlay';

export type MarkDrawType = 'point' | 'polyline' | 'polygon' | 'rectangle' | 'circle';
export type MarkWorkAreaType = 'polygon' | 'circle' | 'rectangle';
export type MarkWorkAreaKind = 'work' | 'noFly';

export interface MarkCallbacks {
  onDrawStart?: (type: MarkDrawType) => void;
  onDrawEnd?: (result: MarkDrawResult | null) => void;
  onWorkAreaDrawEnd?: (result: MarkDrawResult | null) => void;
  onEditChange?: (result: MarkDrawResult | null) => void;
  onEditEnd?: (result: MarkDrawResult | null) => void;
  onColorChange?: (color: string, drawType?: MarkDrawType) => void;
  onDelete?: (entity: Cesium.Entity) => void;
  onClear?: () => void;
}

export interface MarkDrawOptions {
  color?: string;
  coordSystem?: CoordSystem;
  outputCoordSystem?: CoordSystem;
  clampToGround?: boolean;
  workAreaKind?: MarkWorkAreaKind;
  onComplete?: (result: MarkDrawResult | null) => void;
}

export interface MarkEditOptions extends OverlayEditOptions {
  outputCoordSystem?: CoordSystem;
}

export interface MarkExportItem {
  id: string;
  type: MarkDrawType;
  position?: LngLat;
  positions: LngLat[];
  cartesian3Positions?: Cesium.Cartesian3[];
  length?: number;
  area?: number;
  radius?: number;
  color?: string;
  kind?: MarkWorkAreaKind;
}

export interface MarkDrawResult {
  id: string;
  type: MarkDrawType;
  entity: Cesium.Entity;
  position?: LngLat;
  positions: LngLat[];
  cartesian3Positions: Cesium.Cartesian3[];
  length?: number;
  area?: number;
  radius?: number;
  color?: string;
  outputCoordSystem: CoordSystem;
  kind?: MarkWorkAreaKind;
}

export interface MarkServiceOptions {
  showToolbar?: boolean;
  toolbarPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  buttonSize?: number;
  buttonSpacing?: number;
  zIndex?: number;
  buttons?: MarkDrawType[];
  continuous?: boolean;
  defaultColor?: string;
  colors?: Partial<Record<MarkDrawType, string>>;
  callbacks?: MarkCallbacks;
}

export interface MarkEntityMetadata {
  type: MarkDrawType;
  controlPoints: Cesium.Cartesian3[];
  radius?: number;
  color?: string;
  kind?: MarkWorkAreaKind;
}
