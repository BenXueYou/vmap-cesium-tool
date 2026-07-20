import * as Cesium from 'cesium';
import type { Viewer, Entity } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';
export interface InfoWindowOptions extends BaseOverlayOptions {
    content: string | HTMLElement;
    width?: number;
    height?: number;
    pixelOffset?: Cesium.Cartesian2;
    show?: boolean;
    closable?: boolean;
    onClose?: (entity: Entity) => void;
    backgroundColor?: string;
    color?: string;
    font?: string;
    className?: string;
    style?: Partial<CSSStyleDeclaration>;
    showArrow?: boolean;
    arrowSize?: number;
    positionOffset?: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'left-top' | 'left-bottom' | 'right-top' | 'right-bottom';
    hideWhenOutOfView?: boolean;
    anchorHeight?: number;
    anchorPixel?: number;
    tailGap?: number;
    updateInterval?: number;
}
export declare class InfoWindow extends BaseOverlay {
    private static nextZIndex;
    private infoOptions;
    private readonly container;
    private internalData?;
    private isCameraMoving;
    private cameraMoveStartListener?;
    private cameraMoveEndListener?;
    constructor(viewer: Viewer, options: InfoWindowOptions, container?: HTMLElement);
    private mergeOptions;
    private createDomElement;
    private getContainerPixelPosition;
    private updateDomPosition;
    private bringToFront;
    update(options: Partial<InfoWindowOptions>): void;
    setPosition(position: OverlayPosition): void;
    setContent(content: string | HTMLElement): void;
    setVisible(show: boolean): void;
    show(): void;
    hide(): void;
    remove(): void;
    getPosition(): [number, number] | null;
}
