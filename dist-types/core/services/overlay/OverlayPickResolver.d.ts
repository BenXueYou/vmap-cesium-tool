export type OverlayPickReason = 'hover' | 'click';
export interface OverlayPickRoot<TRoot> {
    overlayId: string;
    root: TRoot;
    pickPriority: number;
    creationOrder: number;
}
export interface OverlayPickCandidate<TRawPick, TRoot> extends OverlayPickRoot<TRoot> {
    visualRank: number;
    rawPicks: TRawPick[];
}
export interface OverlayPickResolverOptions<TRawPick, TRoot> {
    reason: OverlayPickReason;
    resolveRoot: (rawPick: TRawPick) => OverlayPickRoot<TRoot> | null;
    isEligible: (root: OverlayPickRoot<TRoot>, reason: OverlayPickReason) => boolean;
}
export declare function sortOverlayPickCandidates<TRawPick, TRoot>(candidates: readonly OverlayPickCandidate<TRawPick, TRoot>[]): OverlayPickCandidate<TRawPick, TRoot>[];
export declare function resolveOverlayPickCandidates<TRawPick, TRoot>(rawPicks: readonly TRawPick[], options: OverlayPickResolverOptions<TRawPick, TRoot>): OverlayPickCandidate<TRawPick, TRoot>[];
