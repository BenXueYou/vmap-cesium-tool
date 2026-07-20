import type * as Cesium from 'cesium';
export declare function createRoundedLabelCanvas(text: string, options: {
    font: string;
    textColor: Cesium.Color;
    backgroundColor: Cesium.Color;
    borderRadius: number;
}): HTMLCanvasElement;
export declare function drawRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void;
