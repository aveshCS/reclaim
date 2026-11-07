import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  UsageAppSummary,
  UsageError,
  usageStats,
} from '../../native/usageStats';
import { TrackedApp } from '../../state/settings';
import { startOfLocalDay, startOfLocalDayDaysAgo } from '../../utils/time';

export type AppUsageRow = TrackedApp & {
  todayMs: number;
  todayOpens: number;
  weekMs: number;
};

export type AppUsageState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | {
      kind: 'ready';
      rows: AppUsageRow[];
      todayTotalMs: number;
      updatedAt: number;
      /** True when Android no longer had events for the start of the 7-day window. */
      weekPartial: boolean;
    }
  | { kind: 'error'; code: string; message: string };

const byPkg = (apps: UsageAppSummary[]) =>
  new Map(apps.map(a => [a.packageName, a]));

/**
 * Reads today's and the last 7 days' usage for the tracked apps, on demand.
 * Refreshes when `active` turns on and whenever the app returns to the foreground.
 * Nothing runs in the background and nothing is stored or sent anywhere.
 */
export function useAppUsage(apps: TrackedApp[], active: boolean) {
  const [state, setState] = useState<AppUsageState>({ kind: 'idle' });
  const appsKey = apps.map(a => a.packageName).join('|');
  const appsRef = useRef(apps);
  appsRef.current = apps;

  const refresh = useCallback(async () => {
    const list = appsRef.current;
    if (!active || list.length === 0) {
      setState({ kind: 'idle' });
      return;
    }
    setState(s => (s.kind === 'ready' ? s : { kind: 'loading' }));
    const now = Date.now();
    const pkgs = list.map(a => a.packageName);
    try {
      const weekStart = startOfLocalDayDaysAgo(now, 6);
      const [today, week] = await Promise.all([
        usageStats.getSummary(startOfLocalDay(now), now, pkgs),
        usageStats.getSummary(weekStart, now, pkgs),
      ]);
      const t = byPkg(today.apps);
      const w = byPkg(week.apps);
      const rows = list
        .map(a => ({
          ...a,
          todayMs: t.get(a.packageName)?.foregroundMs ?? 0,
          todayOpens: t.get(a.packageName)?.openCount ?? 0,
          weekMs: w.get(a.packageName)?.foregroundMs ?? 0,
        }))
        .sort((x, y) => y.todayMs - x.todayMs);
      setState({
        kind: 'ready',
        rows,
        todayTotalMs: rows.reduce((n, r) => n + r.todayMs, 0),
        updatedAt: now,
        weekPartial:
          week.earliestEventMs !== undefined &&
          week.earliestEventMs > weekStart + 60 * 60 * 1000,
      });
    } catch (e) {
      const err =
        e instanceof UsageError
          ? e
          : new UsageError('FAILED', 'Could not read app time.');
      setState({ kind: 'error', code: err.code, message: err.message });
    }
    // appsKey captures list changes without re-creating on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, appsKey]);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  return { state, refresh };
}
