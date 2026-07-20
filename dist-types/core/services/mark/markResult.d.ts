import * as Cesium from 'cesium';
import type { CoordSystem } from '../../mapProviders/coordinates/types';
import type { MarkDrawResult, MarkExportItem } from './markTypes';
export declare function buildMarkDrawResult(entity: Cesium.Entity, outputCoordSystem?: CoordSystem): MarkDrawResult | null;
export declare function exportMarkEntity(entity: Cesium.Entity, outputCoordSystem?: CoordSystem): MarkExportItem | null;
