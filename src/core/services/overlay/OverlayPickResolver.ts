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

export function sortOverlayPickCandidates<TRawPick, TRoot>(
  candidates: readonly OverlayPickCandidate<TRawPick, TRoot>[],
): OverlayPickCandidate<TRawPick, TRoot>[] {
  return [...candidates].sort((left, right) =>
    right.pickPriority - left.pickPriority
    || left.visualRank - right.visualRank
    || left.creationOrder - right.creationOrder
    || left.overlayId.localeCompare(right.overlayId),
  );
}

export function resolveOverlayPickCandidates<TRawPick, TRoot>(
  rawPicks: readonly TRawPick[],
  options: OverlayPickResolverOptions<TRawPick, TRoot>,
): OverlayPickCandidate<TRawPick, TRoot>[] {
  const candidatesById = new Map<string, OverlayPickCandidate<TRawPick, TRoot>>();

  rawPicks.forEach((rawPick, visualRank) => {
    const resolved = options.resolveRoot(rawPick);
    if (!resolved || !options.isEligible(resolved, options.reason)) {
      return;
    }

    const existing = candidatesById.get(resolved.overlayId);
    if (existing) {
      existing.rawPicks.push(rawPick);
      return;
    }

    candidatesById.set(resolved.overlayId, {
      ...resolved,
      visualRank,
      rawPicks: [rawPick],
    });
  });

  return sortOverlayPickCandidates(Array.from(candidatesById.values()));
}
