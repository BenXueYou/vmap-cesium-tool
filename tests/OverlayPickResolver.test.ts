import { describe, expect, it } from 'vitest';
import {
  resolveOverlayPickCandidates,
  sortOverlayPickCandidates,
  type OverlayPickCandidate,
} from '../src/core/services/overlay/OverlayPickResolver';

interface TestRoot {
  id: string;
}

interface TestRawPick {
  overlayId: string;
  part: 'fill' | 'border' | 'root';
}

describe('resolveOverlayPickCandidates', () => {
  it('collapses composite hits into one root candidate at the foremost visual rank', () => {
    const alarm: TestRoot = { id: 'alarm' };
    const normal: TestRoot = { id: 'normal' };
    const rawPicks: TestRawPick[] = [
      { overlayId: 'alarm', part: 'border' },
      { overlayId: 'normal', part: 'root' },
      { overlayId: 'alarm', part: 'fill' },
    ];

    const candidates = resolveOverlayPickCandidates(rawPicks, {
      reason: 'hover',
      resolveRoot: (rawPick) => ({
        overlayId: rawPick.overlayId,
        root: rawPick.overlayId === alarm.id ? alarm : normal,
        pickPriority: 0,
        creationOrder: rawPick.overlayId === alarm.id ? 20 : 1,
      }),
      isEligible: () => true,
    });

    expect(candidates).toEqual([
      {
        overlayId: 'alarm',
        root: alarm,
        pickPriority: 0,
        creationOrder: 20,
        visualRank: 0,
        rawPicks: [rawPicks[0], rawPicks[2]],
      },
      {
        overlayId: 'normal',
        root: normal,
        pickPriority: 0,
        creationOrder: 1,
        visualRank: 1,
        rawPicks: [rawPicks[1]],
      },
    ]);
  });

  it('places higher business priority ahead of visual order', () => {
    const normal: TestRoot = { id: 'normal' };
    const alarm: TestRoot = { id: 'alarm' };
    const rawPicks: TestRawPick[] = [
      { overlayId: 'normal', part: 'root' },
      { overlayId: 'alarm', part: 'root' },
    ];

    const candidates = resolveOverlayPickCandidates(rawPicks, {
      reason: 'hover',
      resolveRoot: (rawPick) => ({
        overlayId: rawPick.overlayId,
        root: rawPick.overlayId === alarm.id ? alarm : normal,
        pickPriority: rawPick.overlayId === alarm.id ? 100 : 0,
        creationOrder: rawPick.overlayId === alarm.id ? 2 : 1,
      }),
      isEligible: () => true,
    });

    expect(candidates.map((candidate) => candidate.overlayId)).toEqual(['alarm', 'normal']);
  });

  it('uses creation order and root id to stabilize otherwise equal candidates', () => {
    const candidates: OverlayPickCandidate<TestRawPick, TestRoot>[] = [
      {
        overlayId: 'zulu',
        root: { id: 'zulu' },
        pickPriority: 0,
        creationOrder: 2,
        visualRank: 4,
        rawPicks: [],
      },
      {
        overlayId: 'beta',
        root: { id: 'beta' },
        pickPriority: 0,
        creationOrder: 1,
        visualRank: 4,
        rawPicks: [],
      },
      {
        overlayId: 'alpha',
        root: { id: 'alpha' },
        pickPriority: 0,
        creationOrder: 1,
        visualRank: 4,
        rawPicks: [],
      },
    ];

    expect(sortOverlayPickCandidates(candidates).map((candidate) => candidate.overlayId)).toEqual([
      'alpha',
      'beta',
      'zulu',
    ]);
  });

  it('excludes unresolved and reason-ineligible roots', () => {
    const rawPicks = ['hover-only', 'missing', 'clickable'] as const;

    const candidates = resolveOverlayPickCandidates(rawPicks, {
      reason: 'click',
      resolveRoot: (overlayId) => overlayId === 'missing'
        ? null
        : {
            overlayId,
            root: { id: overlayId },
            pickPriority: 0,
            creationOrder: overlayId === 'hover-only' ? 1 : 2,
          },
      isEligible: (resolved, reason) => reason === 'click' && resolved.overlayId === 'clickable',
    });

    expect(candidates.map((candidate) => candidate.overlayId)).toEqual(['clickable']);
  });

  it('deduplicates entity and primitive pick shapes through the root resolver seam', () => {
    type RawShape =
      | { id: { entityId: string } }
      | { id: string | number }
      | { primitive: { id: string | number } };

    const rawPicks: RawShape[] = [
      { id: { entityId: 'area' } },
      { primitive: { id: 'area__fill' } },
      { id: 42 },
    ];

    const candidates = resolveOverlayPickCandidates(rawPicks, {
      reason: 'hover',
      resolveRoot: (rawPick) => {
        const rawId = 'primitive' in rawPick
          ? rawPick.primitive.id
          : typeof rawPick.id === 'object'
            ? rawPick.id.entityId
            : rawPick.id;
        const overlayId = String(rawId).replace(/__fill$/, '');
        return {
          overlayId,
          root: { id: overlayId },
          pickPriority: 0,
          creationOrder: overlayId === 'area' ? 1 : 2,
        };
      },
      isEligible: () => true,
    });

    expect(candidates.map((candidate) => ({
      overlayId: candidate.overlayId,
      hitCount: candidate.rawPicks.length,
    }))).toEqual([
      { overlayId: 'area', hitCount: 2 },
      { overlayId: '42', hitCount: 1 },
    ]);
  });
});
