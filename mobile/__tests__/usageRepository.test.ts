import { UsageSummary } from '../src/native/usageStats';
import {
  createUsageRepository,
  HISTORY_KEY,
} from '../src/features/usage/usageRepository';
import {
  localDateKey,
  startOfLocalDay,
  startOfLocalDayDaysAgo,
} from '../src/utils/time';

const MIN = 60_000;
const NOW = new Date(2026, 10, 7, 20, 0).getTime(); // 7 Nov 2026, 8 pm local
const IG = 'com.instagram.android';
const YT = 'com.google.android.youtube';

function memoryStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    map: m,
    getItem: jest.fn(async (k: string) => m.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      m.set(k, v);
    }),
    removeItem: jest.fn(async (k: string) => {
      m.delete(k);
    }),
  };
}

/** Fake Android: each local day d days ago has (10 + d) min per app; history starts at `historyStart`. */
function fakeAndroid(historyStart: number) {
  return jest.fn(
    async (
      start: number,
      end: number,
      pkgs: string[],
    ): Promise<UsageSummary> => {
      const daysAgo = Math.round(
        (startOfLocalDay(NOW) - startOfLocalDay(start)) / (24 * 60 * MIN),
      );
      const available = end > historyStart;
      return {
        rangeStartMs: start,
        rangeEndMs: end,
        source: 'android_usage_events',
        eventCount: available ? 50 : 0,
        earliestEventMs: available ? Math.max(start, historyStart) : undefined,
        apps: pkgs.map(p => ({
          packageName: p,
          foregroundMs: available ? (10 + daysAgo) * MIN : 0,
          openCount: available ? 3 : 0,
        })),
      };
    },
  );
}

describe('usageRepository', () => {
  it('fills the last 7 complete days and today, all marked full when Android has the history', async () => {
    const storage = memoryStorage();
    const getSummary = fakeAndroid(startOfLocalDayDaysAgo(NOW, 30));
    const repo = createUsageRepository({ getSummary, storage });
    const r = await repo.sync([IG], NOW);

    expect(r.days).toHaveLength(7);
    expect(r.days.every(d => d.coverage === 'full')).toBe(true);
    expect(r.days[0].date < r.days[6].date).toBe(true); // oldest first
    expect(r.days[6].apps[IG].ms).toBe(11 * MIN); // yesterday
    expect(r.today.date).toBe(localDateKey(NOW));
    expect(r.today.apps[IG].ms).toBe(10 * MIN);
    // Only daily totals are stored, and today is never stored.
    const stored = JSON.parse(storage.map.get(HISTORY_KEY)!);
    expect(Object.keys(stored.days)).not.toContain(localDateKey(NOW));
  });

  it('marks the day where Android history begins as partial and skips earlier days', async () => {
    const historyStart = startOfLocalDayDaysAgo(NOW, 3) + 10 * 60 * MIN; // 10 am, 3 days ago
    const repo = createUsageRepository({
      getSummary: fakeAndroid(historyStart),
      storage: memoryStorage(),
    });
    const r = await repo.sync([IG], NOW);
    expect(r.days.map(d => d.coverage)).toEqual(['partial', 'full', 'full']);
  });

  it('does not re-query days it already has, but fills a newly chosen app', async () => {
    const storage = memoryStorage();
    const getSummary = fakeAndroid(startOfLocalDayDaysAgo(NOW, 30));
    const repo = createUsageRepository({ getSummary, storage });
    await repo.sync([IG], NOW);
    getSummary.mockClear();

    await repo.sync([IG], NOW);
    expect(getSummary).toHaveBeenCalledTimes(2); // probe + today only

    getSummary.mockClear();
    const r = await repo.sync([IG, YT], NOW);
    expect(getSummary).toHaveBeenCalledTimes(2 + 7);
    const dayCalls = getSummary.mock.calls.slice(1, 8);
    expect(dayCalls.every(c => c[2].length === 1 && c[2][0] === YT)).toBe(true);
    expect(Object.keys(r.days[6].apps).sort()).toEqual([YT, IG].sort());
  });

  it('deletes days older than the retention window and ignores junk', async () => {
    const old = localDateKey(startOfLocalDayDaysAgo(NOW, 90));
    const kept = localDateKey(startOfLocalDayDaysAgo(NOW, 20));
    const storage = memoryStorage({
      [HISTORY_KEY]: JSON.stringify({
        version: 1,
        days: {
          [old]: { date: old, coverage: 'full', apps: {} },
          [kept]: {
            date: kept,
            coverage: 'full',
            apps: { [IG]: { ms: 1, opens: 1 } },
          },
          junk: { nope: true },
        },
      }),
    });
    const repo = createUsageRepository({
      getSummary: fakeAndroid(startOfLocalDayDaysAgo(NOW, 30)),
      storage,
    });
    const r = await repo.sync([IG], NOW);
    const dates = r.days.map(d => d.date);
    expect(dates).toContain(kept);
    expect(dates).not.toContain(old);
    expect(dates).not.toContain('junk');
  });

  it('recovers from corrupt storage and can be cleared', async () => {
    const storage = memoryStorage({ [HISTORY_KEY]: '{not json' });
    const repo = createUsageRepository({
      getSummary: fakeAndroid(startOfLocalDayDaysAgo(NOW, 30)),
      storage,
    });
    await expect(repo.sync([IG], NOW)).resolves.toBeTruthy();
    await repo.clear();
    expect(storage.map.has(HISTORY_KEY)).toBe(false);
  });
});
