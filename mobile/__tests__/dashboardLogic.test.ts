import {
  computeBaseline,
  OPENS_THRESHOLD,
  pickSuggestion,
  weekBars,
} from '../src/features/dashboard/dashboardLogic';
import { buildDashboard } from '../src/features/dashboard/useDashboard';
import type { DayRecord } from '../src/features/usage/usageRepository';

const MIN = 60_000;
const A = 'com.a';
const B = 'com.b';

const day = (
  date: string,
  apps: Record<string, number>,
  coverage: 'full' | 'partial' = 'full',
): DayRecord => ({
  date,
  coverage,
  apps: Object.fromEntries(
    Object.entries(apps).map(([k, m]) => [k, { ms: m * MIN, opens: 2 }]),
  ),
});

describe('baseline', () => {
  it('needs 3 complete days before it exists', () => {
    const b = computeBaseline(
      [day('2026-11-05', { [A]: 60 }), day('2026-11-06', { [A]: 30 })],
      [A],
    );
    expect(b).toEqual({ kind: 'building', completeDays: 2, needed: 3 });
  });

  it('ignores partial days and days missing a chosen app', () => {
    const b = computeBaseline(
      [
        day('2026-11-02', { [A]: 999 }, 'partial'),
        day('2026-11-03', { [A]: 999 }), // missing B
        day('2026-11-04', { [A]: 30, [B]: 30 }),
        day('2026-11-05', { [A]: 60, [B]: 0 }),
        day('2026-11-06', { [A]: 90, [B]: 30 }),
      ],
      [A, B],
    );
    expect(b).toEqual({ kind: 'ready', avgMs: 80 * MIN, days: 3 });
  });

  it('averages only the last 7 complete days', () => {
    const days = Array.from({ length: 10 }, (_, i) =>
      day(`2026-10-${String(20 + i).padStart(2, '0')}`, {
        [A]: i < 3 ? 1000 : 10,
      }),
    );
    expect(computeBaseline(days, [A])).toEqual({
      kind: 'ready',
      avgMs: 10 * MIN,
      days: 7,
    });
  });
});

describe('week bars', () => {
  it('shows missing days as no data, never zero', () => {
    const bars = weekBars(
      day('2026-11-07', { [A]: 5 }),
      [day('2026-11-06', { [A]: 0 })],
      [A],
      ['2026-11-05', '2026-11-06'],
    );
    expect(bars.map(b => b.ms)).toEqual([null, 0, 5 * MIN]);
    expect(bars[2].isToday).toBe(true);
  });
});

describe('suggestions', () => {
  const ready = { kind: 'ready' as const, avgMs: 60 * MIN, days: 5 };
  const building = { kind: 'building' as const, completeDays: 1, needed: 3 };

  it('says nothing without evidence', () => {
    expect(
      pickSuggestion({
        todayMs: 500 * MIN,
        baseline: building,
        topApp: null,
        hour: 21,
      }),
    ).toBeNull();
  });

  it('flags passing the usual day by at least 15 minutes, with the exact reason', () => {
    const s = pickSuggestion({
      todayMs: 80 * MIN,
      baseline: ready,
      topApp: null,
      hour: 14,
    });
    expect(s?.id).toBe('over-usual');
    expect(s?.title).toBe('20 min past your usual');
    expect(s?.why).toContain('average of your last 5 complete days');
  });

  it('does not flag small overshoots', () => {
    expect(
      pickSuggestion({
        todayMs: 70 * MIN,
        baseline: ready,
        topApp: null,
        hour: 14,
      }),
    ).toBeNull();
  });

  it('flags many opens even before a baseline exists', () => {
    const s = pickSuggestion({
      todayMs: 10 * MIN,
      baseline: building,
      topApp: { label: 'Instagram', opens: OPENS_THRESHOLD },
      hour: 9,
    });
    expect(s?.id).toBe('many-opens');
    expect(s?.title).toBe('Instagram opened 20 times today');
  });

  it('gives a positive note only in the evening and only when clearly under', () => {
    const input = { todayMs: 40 * MIN, baseline: ready, topApp: null };
    expect(pickSuggestion({ ...input, hour: 17 })).toBeNull();
    expect(pickSuggestion({ ...input, hour: 19 })?.id).toBe('under-usual');
  });

  it('is deterministic', () => {
    const input = {
      todayMs: 90 * MIN,
      baseline: ready,
      topApp: { label: 'X', opens: 30 },
      hour: 20,
    };
    expect(pickSuggestion(input)).toEqual(pickSuggestion(input));
    expect(pickSuggestion(input)?.id).toBe('over-usual'); // rule order
  });
});

describe('buildDashboard', () => {
  it('reconciles the total with the per-app numbers', () => {
    const now = new Date(2026, 10, 7, 12).getTime();
    const d = buildDashboard(
      day('2026-11-07', { [A]: 30, [B]: 15 }),
      [],
      [
        { packageName: A, label: 'Alpha' },
        { packageName: B, label: 'Beta' },
      ],
      now,
    );
    expect(d.todayMs).toBe(45 * MIN);
    expect(d.perApp.reduce((n, a) => n + a.ms, 0)).toBe(d.todayMs);
    expect(d.perApp[0].label).toBe('Alpha');
    expect(d.week).toHaveLength(7);
  });
});
