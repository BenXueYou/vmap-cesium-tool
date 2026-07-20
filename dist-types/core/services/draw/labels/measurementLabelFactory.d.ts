import type { Cartesian3, Entity, Viewer } from 'cesium';
import type { I18nLike } from '../../../../i18n';
import type { ResolvedMeasurementLabelStyle, ResolvedMeasurementTheme } from '../types/drawTypes';
export interface MeasurementLabelFactoryOptions {
    i18n?: I18nLike;
    useI18n?: boolean;
}
export declare class MeasurementLabelFactory {
    private readonly viewer;
    private readonly i18n?;
    private readonly useI18n;
    constructor(viewer: Viewer, options?: MeasurementLabelFactoryOptions);
    private t;
    createVertexMarkerEntities(positions: Cartesian3[], theme: ResolvedMeasurementTheme): Entity[];
    createMeasurementBillboardEntity(position: Cartesian3, text: string, style: ResolvedMeasurementLabelStyle): Entity;
    createDistanceLabelEntities(positions: Cartesian3[], theme: ResolvedMeasurementTheme): Entity[];
    createAreaLabelEntity(positions: Cartesian3[], area: number, variant: 'preview' | 'final', theme: ResolvedMeasurementTheme): Entity | null;
}
