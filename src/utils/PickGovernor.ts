export type PickGovernorKind = 'hover' | 'click' | 'cluster' | 'draw' | 'edit';

export interface PickGovernorProfile {
  minIntervalMs: number;
  minMovePx: number;
}

export interface PickGovernorOptions {
  profiles?: Partial<Record<PickGovernorKind, Partial<PickGovernorProfile>>>;
}

const DEFAULT_PROFILE_NON_MAC: Record<PickGovernorKind, PickGovernorProfile> = {
  hover: { minIntervalMs: 66, minMovePx: 2 },
  click: { minIntervalMs: 120, minMovePx: 0 },
  cluster: { minIntervalMs: 120, minMovePx: 0 },
  draw: { minIntervalMs: 120, minMovePx: 0 },
  edit: { minIntervalMs: 80, minMovePx: 0 },
};

const DEFAULT_PROFILE_MAC: Record<PickGovernorKind, PickGovernorProfile> = {
  hover: { minIntervalMs: 100, minMovePx: 6 },
  click: { minIntervalMs: 140, minMovePx: 0 },
  cluster: { minIntervalMs: 140, minMovePx: 0 },
  draw: { minIntervalMs: 140, minMovePx: 0 },
  edit: { minIntervalMs: 100, minMovePx: 0 },
};

type PointLike = { x: number; y: number };

export function isMacPlatform(): boolean {
  try {
    const nav = globalThis.navigator;
    if (!nav || typeof nav.platform !== 'string') return false;
    return /mac/i.test(nav.platform);
  } catch {
    return false;
  }
}

export class PickGovernor {
  private readonly profiles: Record<PickGovernorKind, PickGovernorProfile>;
  private readonly lastByKind = new Map<PickGovernorKind, { t: number; x: number; y: number }>();
  private suspendUntil = 0;

  constructor(options: PickGovernorOptions = {}) {
    const isMac = isMacPlatform();
    const defaults = isMac ? DEFAULT_PROFILE_MAC : DEFAULT_PROFILE_NON_MAC;

    this.profiles = {
      hover: { ...defaults.hover, ...(options.profiles?.hover ?? {}) },
      click: { ...defaults.click, ...(options.profiles?.click ?? {}) },
      cluster: { ...defaults.cluster, ...(options.profiles?.cluster ?? {}) },
      draw: { ...defaults.draw, ...(options.profiles?.draw ?? {}) },
      edit: { ...defaults.edit, ...(options.profiles?.edit ?? {}) },
    };
  }

  public shouldPick(kind: PickGovernorKind, point: PointLike, nowMs: number = Date.now()): boolean {
    if (!this.isFinitePoint(point)) return false;
    if (nowMs < this.suspendUntil) return false;

    const profile = this.profiles[kind];
    const last = this.lastByKind.get(kind);
    if (last) {
      if (nowMs - last.t < profile.minIntervalMs) {
        return false;
      }
      if (profile.minMovePx > 0) {
        const dx = point.x - last.x;
        const dy = point.y - last.y;
        if ((dx * dx + dy * dy) < (profile.minMovePx * profile.minMovePx)) {
          return false;
        }
      }
    }

    this.lastByKind.set(kind, { t: nowMs, x: point.x, y: point.y });
    return true;
  }

  public suspend(ms: number): void {
    if (!Number.isFinite(ms) || ms <= 0) return;
    const now = Date.now();
    this.suspendUntil = Math.max(this.suspendUntil, now + ms);
  }

  private isFinitePoint(point: PointLike): boolean {
    return Number.isFinite(point?.x) && Number.isFinite(point?.y);
  }
}
