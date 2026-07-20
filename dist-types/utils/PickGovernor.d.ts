export type PickGovernorKind = 'hover' | 'click' | 'cluster' | 'draw' | 'edit';
export interface PickGovernorProfile {
    minIntervalMs: number;
    minMovePx: number;
}
export interface PickGovernorOptions {
    profiles?: Partial<Record<PickGovernorKind, Partial<PickGovernorProfile>>>;
}
type PointLike = {
    x: number;
    y: number;
};
export declare function isMacPlatform(): boolean;
export declare class PickGovernor {
    private readonly profiles;
    private readonly lastByKind;
    private suspendUntil;
    constructor(options?: PickGovernorOptions);
    shouldPick(kind: PickGovernorKind, point: PointLike, nowMs?: number): boolean;
    suspend(ms: number): void;
    private isFinitePoint;
}
export {};
