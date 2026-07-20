import * as Cesium from 'cesium';
import type { Viewer, Entity, Color, MaterialProperty, HeightReference } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';
export interface PolygonOptions extends BaseOverlayOptions {
    positions: OverlayPosition[];
    material?: MaterialProperty | Color | string;
    outline?: boolean;
    outlineColor?: Color | string;
    outlineWidth?: number;
    clampToGround?: boolean;
    groundHeightEpsilon?: number;
    heightReference?: HeightReference;
    extrudedHeight?: number;
    renderMode?: 'auto' | 'entity' | 'primitive';
}
export declare class Polygon extends BaseOverlay {
    private static primitiveManagers;
    private polygonOptions;
    private borderEntity?;
    private primitiveMode;
    private primitiveManager;
    constructor(viewer: Viewer, options: PolygonOptions);
    private static getPrimitiveManager;
    private canUsePrimitive;
    private initPrimitivePolygon;
    private createPolygonGraphics;
    private createBorderPolyline;
    private resolveColorOrNull;
    private resolveColor;
    private resolveMaterial;
    private resolveMaterialColor;
    private elevatePositions;
    private getPrimitiveRoot;
    private refreshPrimitiveGeometry;
    update(options: Partial<PolygonOptions>): void;
    setPositions(positions: OverlayPosition[]): void;
    getPositions(): [number, number][];
    getStyle(): Partial<PolygonOptions>;
    applyPrimitiveHighlight(entity: Entity, highlightColor: Cesium.Color, _fillAlpha: number): void;
    restorePrimitiveHighlight(entity: Entity): void;
    setVisible(show: boolean): void;
    remove(): void;
}
