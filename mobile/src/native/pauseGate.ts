import { NativeModules, Platform } from 'react-native';
import type { TrackedApp } from '../state/settings';
import type { Intensity } from '../state/intensity';

export type PauseDayStats = {
  date: string;
  shown: number;
  notNow: number;
  opened: number;
};

export type ServiceState = {
  /** Switched on in Android Settings. */
  enabled: boolean;
  /** Actually running. Enabled but not running = the phone stopped it. */
  running: boolean;
  /** Phone maker, e.g. "xiaomi" (Xiaomi, Redmi, POCO), lower case. */
  maker: string;
};

type NativeGate = {
  isServiceEnabled(): Promise<boolean>;
  getServiceState(): Promise<ServiceState>;
  openAutostartSettings(): Promise<boolean>;
  openAppSettings(): Promise<boolean>;
  openAccessibilitySettings(): Promise<boolean>;
  configure(
    enabled: boolean,
    packages: TrackedApp[],
    allowMinutes: number,
    plan: string,
  ): Promise<boolean>;
  getStats(dates: string[]): Promise<PauseDayStats[]>;
  clearStats(): Promise<boolean>;
  configureExtras(
    webEnabled: boolean,
    sites: string[],
    reelsEnabled: boolean,
    reelLimit: number,
    showPip: boolean,
  ): Promise<boolean>;
  getReelStats(dates: string[]): Promise<ReelDayStats[]>;
  configureIntensity(
    base: number,
    pendingLevel: number,
    pendingAt: number,
    strictUntil: number,
  ): Promise<boolean>;
};

export type ReelDayStats = {
  date: string;
  total: number;
  /** Package name -> reels counted that day. */
  byApp: Record<string, number>;
};

/** Apps whose short-video pager RECLAIM can recognise. Facebook and Snapchat can't be read. */
export const REEL_APPS: { packageName: string; label: string }[] = [
  { packageName: 'com.google.android.youtube', label: 'YouTube Shorts' },
  { packageName: 'com.instagram.android', label: 'Instagram Reels' },
];

function cleanReelStats(raw: unknown): ReelDayStats[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) {
      return [];
    }
    const r = item as Record<string, unknown>;
    if (typeof r.date !== 'string') {
      return [];
    }
    const byApp: Record<string, number> = {};
    if (typeof r.byApp === 'object' && r.byApp !== null) {
      for (const [k, v] of Object.entries(r.byApp as Record<string, unknown>)) {
        if (typeof v === 'number' && v >= 0) {
          byApp[k] = Math.round(v);
        }
      }
    }
    const total = Object.values(byApp).reduce((a, b) => a + b, 0);
    return [{ date: r.date, total, byApp }];
  });
}

function native(): NativeGate | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  return (NativeModules.ReclaimPauseGate as NativeGate | undefined) ?? null;
}

/** Thin, safe wrapper: every call degrades gracefully when the native side is missing. */
export const pauseGate = {
  isAvailable: () => native() !== null,
  /** Phone maker, known at start-up ("xiaomi" for Xiaomi/Redmi/POCO), or ''. */
  maker(): string {
    const m = (native() as unknown as { maker?: unknown } | null)?.maker;
    return typeof m === 'string' ? m : '';
  },
  async isServiceEnabled(): Promise<boolean> {
    try {
      return (await native()?.isServiceEnabled()) ?? false;
    } catch {
      return false;
    }
  },
  async getServiceState(): Promise<ServiceState> {
    try {
      const n = native();
      if (n?.getServiceState) {
        return await n.getServiceState();
      }
      const enabled = (await n?.isServiceEnabled()) ?? false;
      return { enabled, running: enabled, maker: '' };
    } catch {
      return { enabled: false, running: false, maker: '' };
    }
  },
  async openAutostartSettings(): Promise<void> {
    try {
      await native()?.openAutostartSettings();
    } catch {
      // ignore
    }
  },
  async openAppSettings(): Promise<void> {
    try {
      await native()?.openAppSettings();
    } catch {
      // ignore
    }
  },
  async openSettings(): Promise<void> {
    const n = native();
    if (!n) {
      throw new Error('The pause works only in the Android app.');
    }
    await n.openAccessibilitySettings();
  },
  async configure(
    enabled: boolean,
    packages: TrackedApp[],
    allowMinutes: number,
    plan: string,
  ): Promise<void> {
    try {
      await native()?.configure(enabled, packages, allowMinutes, plan);
    } catch {
      // Configuration is retried on the next change.
    }
  },
  async getStats(dates: string[]): Promise<PauseDayStats[]> {
    try {
      return (await native()?.getStats(dates)) ?? [];
    } catch {
      return [];
    }
  },
  async configureExtras(
    webEnabled: boolean,
    sites: string[],
    reelsEnabled: boolean,
    reelLimit: number,
    showPip: boolean,
  ): Promise<void> {
    try {
      await native()?.configureExtras(
        webEnabled,
        sites,
        reelsEnabled,
        reelLimit,
        showPip,
      );
    } catch {
      // Retried on the next change.
    }
  },
  async configureIntensity(i: Intensity): Promise<void> {
    try {
      await native()?.configureIntensity(
        i.base,
        i.pending?.level ?? 0,
        i.pending?.at ?? 0,
        i.strictUntil ?? 0,
      );
    } catch {
      // Retried on the next change.
    }
  },
  async getReelStats(dates: string[]): Promise<ReelDayStats[]> {
    try {
      return cleanReelStats(await native()?.getReelStats(dates));
    } catch {
      return [];
    }
  },
  async clearStats(): Promise<void> {
    try {
      await native()?.clearStats();
    } catch {
      // ignore
    }
  },
};

export function planLine(plan: { when: string; then: string } | null): string {
  return plan ? `When ${plan.when}, I will ${plan.then}.` : '';
}
