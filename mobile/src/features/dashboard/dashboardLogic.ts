import type { DayRecord } from '../usage/usageRepository';
import { formatDuration } from '../../utils/time';

/** Days of complete history needed before we compare anything to "your usual". */
export const BASELINE_MIN_DAYS = 3;
/** Most recent complete days averaged into the baseline. */
export const BASELINE_WINDOW = 7;

export function dayTotal(day: DayRecord, packages: string[]): number {
  return packages.reduce((n, p) => n + (day.apps[p]?.ms ?? 0), 0);
}

/** A day is usable for the baseline only if Android covered all of it and every chosen app is present. */
export function isComplete(day: DayRecord, packages: string[]): boolean {
  return day.coverage === 'full' && packages.every(p => p in day.apps);
}

export type Baseline =
  | { kind: 'building'; completeDays: number; needed: number }
  | { kind: 'ready'; avgMs: number; days: number };

export function computeBaseline(
  pastDays: DayRecord[],
  packages: string[],
): Baseline {
  const complete = pastDays
    .filter(d => isComplete(d, packages))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-BASELINE_WINDOW);
  if (complete.length < BASELINE_MIN_DAYS || packages.length === 0) {
    return {
      kind: 'building',
      completeDays: complete.length,
      needed: BASELINE_MIN_DAYS,
    };
  }
  const total = complete.reduce((n, d) => n + dayTotal(d, packages), 0);
  return {
    kind: 'ready',
    avgMs: Math.round(total / complete.length),
    days: complete.length,
  };
}

export type WeekBar = {
  date: string;
  /** null = no data for that day (not zero use). */
  ms: number | null;
  isToday: boolean;
  partial: boolean;
};

/** Seven bars ending today. Days without data are null, never zero. */
export function weekBars(
  today: DayRecord,
  pastDays: DayRecord[],
  packages: string[],
  pastKeys: string[],
): WeekBar[] {
  const byDate = new Map(pastDays.map(d => [d.date, d]));
  const bars: WeekBar[] = pastKeys.map(k => {
    const d = byDate.get(k);
    const has = d && packages.every(p => p in d.apps);
    return {
      date: k,
      ms: has ? dayTotal(d!, packages) : null,
      isToday: false,
      partial: !!d && d.coverage === 'partial',
    };
  });
  bars.push({
    date: today.date,
    ms: dayTotal(today, packages),
    isToday: true,
    partial: today.coverage === 'partial',
  });
  return bars;
}

export type Suggestion = {
  id: 'over-usual' | 'many-opens' | 'under-usual';
  title: string;
  body: string;
  /** Exactly which signal and window produced this, for "Why am I seeing this?". */
  why: string;
  action?: 'breathe' | 'focus';
};

export type SuggestionInput = {
  todayMs: number;
  baseline: Baseline;
  topApp: { label: string; opens: number } | null;
  /** Local hour 0-23. */
  hour: number;
};

export const OPENS_THRESHOLD = 20;
export const OVER_MIN_MS = 15 * 60_000;

/**
 * One deterministic suggestion, or none. Same input always gives the same output.
 * Rules (first match wins):
 * 1. Today already passed the full-day baseline by >= 15 min.
 * 2. The most-opened chosen app was opened >= 20 times today.
 * 3. After 6 pm, today is at least 20% under the baseline (positive note).
 * No mood, motivation or diagnosis is inferred from usage.
 */
export function pickSuggestion(input: SuggestionInput): Suggestion | null {
  const { todayMs, baseline, topApp, hour } = input;

  if (baseline.kind === 'ready' && todayMs - baseline.avgMs >= OVER_MIN_MS) {
    return {
      id: 'over-usual',
      title: `${formatDuration(todayMs - baseline.avgMs)} past your usual`,
      body: 'Your chosen apps have already gone past a usual full day. Want to try a short focus session instead?',
      why: `Today so far: ${formatDuration(
        todayMs,
      )}. Your usual full day: ${formatDuration(
        baseline.avgMs,
      )} (average of your last ${baseline.days} complete days).`,
      action: 'focus',
    };
  }

  if (topApp && topApp.opens >= OPENS_THRESHOLD) {
    return {
      id: 'many-opens',
      title: `${topApp.label} opened ${topApp.opens} times today`,
      body: 'Next time you reach for it, try one slow breath first. Then decide.',
      why: `Opens of ${topApp.label} counted by Android since midnight. Shown when an app reaches ${OPENS_THRESHOLD} opens in a day.`,
      action: 'breathe',
    };
  }

  if (
    baseline.kind === 'ready' &&
    hour >= 18 &&
    todayMs <= baseline.avgMs * 0.8
  ) {
    return {
      id: 'under-usual',
      title: `${formatDuration(baseline.avgMs - todayMs)} under your usual`,
      body: 'That time went somewhere else today. Nice.',
      why: `Today so far: ${formatDuration(
        todayMs,
      )}. Your usual full day: ${formatDuration(
        baseline.avgMs,
      )} (average of your last ${
        baseline.days
      } complete days). Shown after 6 pm when today is at least 20% lower.`,
    };
  }

  return null;
}
