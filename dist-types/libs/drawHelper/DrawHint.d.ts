import type { Color } from 'cesium';
interface DrawHintOverrideConfig {
    text?: string | null;
    fillColor?: Color;
    outlineColor?: Color;
}
export declare class DrawHintHelper {
    constructor(...args: any[]);
    private overrideText;
    showHint(text: string): void;
    hideHint(): void;
    updateHint(position: any, text: string): void;
    clear(): void;
    refreshTextOnly(): void;
    updatePosition(position: any): void;
    handleSceneModeChanged(): void;
    setOverride(config?: DrawHintOverrideConfig, timeoutMs?: number): void;
    getDrawHintText(): string;
}
export {};
