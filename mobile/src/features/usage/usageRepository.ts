import AsyncStorage from '@react-native-async-storage/async-storage';
import { usageStats, UsageSummary } from '../../native/usageStats';
import {
  localDateKey,
  startOfLocalDay,
  startOfLocalDayDaysAgo,
} from '../../utils/time';

/**
 * Local-first store of DAILY aggregates for the apps the user chose.
 *
 * Why store anything: Android keeps detailed usage events for only about a week, so a
 * personal baseline needs our own copy of past daily totals.
 *
 * Retention policy (also in docs/PRIVACY_AND_PLATFORM.md):
 * - Only per-app daily totals (foreground ms, opens) for chosen apps. No events, no times of day.
 * - Kept for RETENTION_DAYS days, then deleted automatically.
 * - Deleted completely when the user turns app time off or taps "Delete app-time history".
 * - Never leaves the phone (no backend yet).
 */

export const HISTORY_KEY = 'reclaim.usageHistory.v1';
export const RETENTION_DAYS = 60;
/** How many completed days back we try to fill from Android on each sync. */
export const SYNC_DAYS = 7;

export type AppDay = { ms: number; opens: number };

/**
 * 'full'    = Android had events for the whole day.
 * 'partial' = Android's history started part-way through the day.
 */
export type Coverage = 'full' | 'partial';

export type DayRecord = {
  date: string; // local YYYY-MM-DD
  coverage: Coverage;
  apps: Record<string, AppDay>;
};

type StoredHistory = { version: 1; days: Record<string, DayRecord> };

export type SyncResult = {
  today: DayRecord;
  /** Completed past days we have data for, oldest first, within retention. */
  days: DayRecord[];
  updatedAt: number;
};

export interface UsageRepository {
  sync(packages: string[], now?: number): Promise<SyncResult>;
  clear(): Promise<void>;
}

type Deps = {
  getSummary: (
    start: number,
    end: number,
    pkgs: string[],
  ) => Promise<UsageSummary>;
  storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;
};

function toApps(s: UsageSummary): Record<string, AppDay> {
  const out: Record<string, AppDay> = {};
  for (const a of s.apps) {
    out[a.packageName] = { ms: a.foregroundMs, opens: a.openCount };
  }
  return out;
}

function isDayRecord(v: unknown): v is DayRecord {
  if (typeof v !== 'object' || v === null) {
    return false;
  }
  const r = v as Record<string, unknown>;
  return (
    typeof r.date === 'string' &&
    (r.coverage === 'full' || r.coverage === 'partial') &&
    typeof r.apps === 'object' &&
    r.apps !== null
  );
}

export function createUsageRepository(deps: Deps): UsageRepository {
  async function load(): Promise<Record<string, DayRecord>> {
    try {
      const raw = await deps.storage.getItem(HISTORY_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw) as StoredHistory;
      if (parsed?.version !== 1 || typeof parsed.days !== 'object') {
        return {};
      }
      const days: Record<string, DayRecord> = {};
      for (const [k, v] of Object.entries(parsed.days)) {
        if (isDayRecord(v)) {
          days[k] = v;
        }
      }
      return days;
    } catch {
      return {};
    }
  }

  async function save(days: Record<string, DayRecord>) {
    const data: StoredHistory = { version: 1, days };
    await deps.storage.setItem(HISTORY_KEY, JSON.stringify(data));
  }

  return {
    async sync(packages, now = Date.now()) {
      const pkgs = Array.from(new Set(packages));
      const days = await load();

      // Retention: drop anything older than RETENTION_DAYS.
      const oldestKept = localDateKey(
        startOfLocalDayDaysAgo(now, RETENTION_DAYS),
      );
      for (const k of Object.keys(days)) {
        if (k < oldestKept) {
          delete days[k];
        }
      }

      // Where does Android's event history start? Probe once over the sync window.
      const windowStart = startOfLocalDayDaysAgo(now, SYNC_DAYS);
      const probe = await deps.getSummary(windowStart, now, pkgs);
      const historyStart =
        probe.eventCount > 0 && probe.earliestEventMs !== undefined
          ? probe.earliestEventMs
          : now;

      // Fill completed days that are missing, or missing a newly chosen app.
      for (let d = 1; d <= SYNC_DAYS; d++) {
        const dayStart = startOfLocalDayDaysAgo(now, d);
        const dayEnd = startOfLocalDayDaysAgo(now, d - 1);
        const key = localDateKey(dayStart);
        const existing = days[key];
        const missing = pkgs.filter(p => !existing || !(p in existing.apps));
        if (missing.length === 0 || dayEnd <= historyStart) {
          continue; // complete already, or Android has nothing for that day
        }
        const s = await deps.getSummary(dayStart, dayEnd, missing);
        const coverage: Coverage =
          dayStart >= historyStart && existing?.coverage !== 'partial'
            ? 'full'
            : 'partial';
        days[key] = {
          date: key,
          coverage,
          apps: { ...(existing?.apps ?? {}), ...toApps(s) },
        };
      }

      const todayStart = startOfLocalDay(now);
      const t = await deps.getSummary(todayStart, now, pkgs);
      const today: DayRecord = {
        date: localDateKey(todayStart),
        coverage: todayStart >= historyStart ? 'full' : 'partial',
        apps: toApps(t),
      };

      await save(days);
      const todayKey = today.date;
      return {
        today,
        days: Object.values(days)
          .filter(r => r.date < todayKey)
          .sort((a, b) => (a.date < b.date ? -1 : 1)),
        updatedAt: now,
      };
    },

    async clear() {
      await deps.storage.removeItem(HISTORY_KEY);
    },
  };
}

/** The app-wide repository backed by the native module and on-device storage. */
export const usageRepository: UsageRepository = createUsageRepository({
  getSummary: (s, e, p) => usageStats.getSummary(s, e, p),
  storage: AsyncStorage,
});
