import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { UsageError } from '../../native/usageStats';
import { useSettings } from '../../state/SettingsContext';
import { TrackedApp } from '../../state/settings';
import { localDateKey, startOfLocalDayDaysAgo } from '../../utils/time';
import { DayRecord, usageRepository } from '../usage/usageRepository';
import { AccessStatus, useUsageAccess } from '../usage/useUsageAccess';
import {
  Baseline,
  computeBaseline,
  dayTotal,
  pickSuggestion,
  Suggestion,
  weekBars,
  WeekBar,
} from './dashboardLogic';

export type DashboardData = {
  todayMs: number;
  perApp: (TrackedApp & { ms: number; opens: number })[];
  baseline: Baseline;
  week: WeekBar[];
  suggestion: Suggestion | null;
  todayPartial: boolean;
  updatedAt: number;
};

/** Every state the dashboard can be in, so each one can be designed explicitly. */
export type DashboardState =
  | { kind: 'off' }
  | { kind: 'paused' }
  | { kind: 'unavailable' }
  | { kind: 'checking' }
  | { kind: 'needsPermission' }
  | { kind: 'needsApps' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: DashboardData };

function decide(
  optedIn: boolean,
  paused: boolean,
  access: AccessStatus,
  appCount: number,
): DashboardState['kind'] | 'read' {
  if (!optedIn) {
    return 'off';
  }
  if (paused) {
    return 'paused';
  }
  if (access === 'unavailable') {
    return 'unavailable';
  }
  if (access === 'checking') {
    return 'checking';
  }
  if (access === 'denied') {
    return 'needsPermission';
  }
  if (appCount === 0) {
    return 'needsApps';
  }
  return 'read';
}

export function buildDashboard(
  today: DayRecord,
  days: DayRecord[],
  apps: TrackedApp[],
  now: number,
): DashboardData {
  const pkgs = apps.map(a => a.packageName);
  const baseline = computeBaseline(days, pkgs);
  const perApp = apps
    .map(a => ({
      ...a,
      ms: today.apps[a.packageName]?.ms ?? 0,
      opens: today.apps[a.packageName]?.opens ?? 0,
    }))
    .sort((x, y) => y.ms - x.ms);
  const todayMs = dayTotal(today, pkgs);
  const mostOpened = [...perApp].sort((x, y) => y.opens - x.opens)[0];
  const pastKeys = [6, 5, 4, 3, 2, 1].map(d =>
    localDateKey(startOfLocalDayDaysAgo(now, d)),
  );
  return {
    todayMs,
    perApp,
    baseline,
    week: weekBars(today, days, pkgs, pastKeys),
    suggestion: pickSuggestion({
      todayMs,
      baseline,
      topApp: mostOpened
        ? { label: mostOpened.label, opens: mostOpened.opens }
        : null,
      hour: new Date(now).getHours(),
    }),
    todayPartial: today.coverage === 'partial',
    updatedAt: now,
  };
}

/**
 * Reads on demand (when the dashboard is shown and when the app returns to the
 * foreground). Nothing runs in the background.
 */
export function useDashboard(visible: boolean) {
  const { settings } = useSettings();
  const { status } = useUsageAccess();
  const apps = settings.trackedApps;
  const appsRef = useRef(apps);
  appsRef.current = apps;
  const appsKey = apps.map(a => a.packageName).join('|');

  const gate = decide(
    settings.monitoring.choice === 'requested',
    settings.monitoring.paused,
    status,
    apps.length,
  );
  const [read, setRead] = useState<DashboardState>({ kind: 'loading' });

  const refresh = useCallback(async () => {
    if (gate !== 'read' || !visible) {
      return;
    }
    setRead(s => (s.kind === 'ready' ? s : { kind: 'loading' }));
    try {
      const list = appsRef.current;
      const now = Date.now();
      const r = await usageRepository.sync(
        list.map(a => a.packageName),
        now,
      );
      setRead({
        kind: 'ready',
        data: buildDashboard(r.today, r.days, list, now),
      });
    } catch (e) {
      setRead({
        kind: 'error',
        message:
          e instanceof UsageError
            ? e.message
            : 'Could not read app time just now.',
      });
    }
    // appsKey tracks list changes without re-creating on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, visible, appsKey]);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  const state: DashboardState =
    gate === 'read' ? read : ({ kind: gate } as DashboardState);
  return { state, refresh };
}
