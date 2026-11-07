import { NativeModules, Platform } from 'react-native';

/** Per-app aggregate for a time range. Estimates from Android's usage events. */
export type UsageAppSummary = {
  packageName: string;
  foregroundMs: number;
  /** Times the app was brought to the front (see UsageEventAggregator.kt for the definition). */
  openCount: number;
};

export type UsageSummary = {
  rangeStartMs: number;
  rangeEndMs: number;
  source: 'android_usage_events';
  eventCount: number;
  /** Oldest event Android still had for this range; later than rangeStartMs means partial history. */
  earliestEventMs?: number;
  apps: UsageAppSummary[];
};

export type LaunchableApp = { packageName: string; label: string };

export type UsageErrorCode =
  | 'NOT_AVAILABLE'
  | 'USAGE_ACCESS_NOT_GRANTED'
  | 'INVALID_RANGE'
  | 'RANGE_TOO_LONG'
  | 'TOO_MANY_APPS'
  | 'FAILED';

export class UsageError extends Error {
  constructor(public code: UsageErrorCode, message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

type NativeUsage = {
  hasUsageAccess(): Promise<boolean>;
  openUsageAccessSettings(): Promise<boolean>;
  getLaunchableApps(): Promise<LaunchableApp[]>;
  getUsageSummary(
    startMillis: number,
    endMillis: number,
    packageNames: string[],
  ): Promise<UsageSummary>;
};

export const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
export const MAX_PACKAGES_PER_CALL = 200;

const KNOWN_CODES: UsageErrorCode[] = [
  'USAGE_ACCESS_NOT_GRANTED',
  'INVALID_RANGE',
  'RANGE_TOO_LONG',
  'TOO_MANY_APPS',
];

// Read lazily so tests (and hot reload) see the current module.
function native(): NativeUsage | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  return (NativeModules.ReclaimUsageStats as NativeUsage | undefined) ?? null;
}

function toUsageError(e: unknown): UsageError {
  const code = (e as { code?: string } | null)?.code;
  if (code && (KNOWN_CODES as string[]).includes(code)) {
    return new UsageError(code as UsageErrorCode, String((e as Error).message));
  }
  return new UsageError('FAILED', e instanceof Error ? e.message : String(e));
}

function requireNative(): NativeUsage {
  const n = native();
  if (!n) {
    throw new UsageError(
      'NOT_AVAILABLE',
      'App time needs the Android app (it is not available here).',
    );
  }
  return n;
}

export const usageStats = {
  isAvailable(): boolean {
    return native() !== null;
  },

  async hasPermission(): Promise<boolean> {
    const n = native();
    if (!n) {
      return false;
    }
    try {
      return await n.hasUsageAccess();
    } catch {
      return false;
    }
  },

  async openSettings(): Promise<void> {
    try {
      await requireNative().openUsageAccessSettings();
    } catch (e) {
      throw e instanceof UsageError ? e : toUsageError(e);
    }
  },

  async getLaunchableApps(): Promise<LaunchableApp[]> {
    try {
      const apps = await requireNative().getLaunchableApps();
      return apps.filter(
        a => typeof a.packageName === 'string' && a.packageName.length > 0,
      );
    } catch (e) {
      throw e instanceof UsageError ? e : toUsageError(e);
    }
  },

  /** Usage for exactly the given packages. Anything else the native side returns is dropped. */
  async getSummary(
    startMs: number,
    endMs: number,
    packageNames: string[],
  ): Promise<UsageSummary> {
    if (
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs) ||
      endMs <= startMs
    ) {
      throw new UsageError('INVALID_RANGE', 'End must be after start.');
    }
    if (endMs - startMs > MAX_RANGE_MS) {
      throw new UsageError(
        'RANGE_TOO_LONG',
        'Ask for at most 31 days at a time.',
      );
    }
    const wanted = Array.from(new Set(packageNames.filter(Boolean)));
    if (wanted.length > MAX_PACKAGES_PER_CALL) {
      throw new UsageError('TOO_MANY_APPS', 'Too many apps in one request.');
    }
    if (wanted.length === 0) {
      return {
        rangeStartMs: startMs,
        rangeEndMs: Math.min(endMs, Date.now()),
        source: 'android_usage_events',
        eventCount: 0,
        apps: [],
      };
    }
    let raw: UsageSummary;
    try {
      raw = await requireNative().getUsageSummary(startMs, endMs, wanted);
    } catch (e) {
      throw e instanceof UsageError ? e : toUsageError(e);
    }
    const allowed = new Set(wanted);
    return {
      ...raw,
      apps: raw.apps.filter(a => allowed.has(a.packageName)),
    };
  },
};
