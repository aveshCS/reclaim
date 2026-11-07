import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../App';
import { usageStats, UsageSummary } from '../src/native/usageStats';
import { SETTINGS_KEY } from '../src/services/settingsStorage';
import { DEFAULT_SETTINGS } from '../src/state/settings';
import { HISTORY_KEY } from '../src/features/usage/usageRepository';
import {
  localDateKey,
  startOfLocalDay,
  startOfLocalDayDaysAgo,
} from '../src/utils/time';

jest.mock('../src/native/usageStats', () => {
  const actual = jest.requireActual('../src/native/usageStats');
  return {
    ...actual,
    usageStats: {
      isAvailable: jest.fn(),
      hasPermission: jest.fn(),
      openSettings: jest.fn(),
      getLaunchableApps: jest.fn(),
      getSummary: jest.fn(),
    },
  };
});
const mock = usageStats as jest.Mocked<typeof usageStats>;

const MIN = 60_000;
const IG = { packageName: 'com.instagram.android', label: 'Instagram' };

/** Android with `historyDays` days of history: past days 60 min, today `todayMin` with `opens` opens. */
function android(historyDays: number, todayMin: number, opens = 3) {
  const historyStart = startOfLocalDayDaysAgo(Date.now(), historyDays);
  mock.getSummary.mockImplementation(
    async (start, end, pkgs): Promise<UsageSummary> => {
      const isToday = start >= startOfLocalDay(Date.now());
      const available = end > historyStart;
      return {
        rangeStartMs: start,
        rangeEndMs: end,
        source: 'android_usage_events',
        eventCount: available ? 10 : 0,
        earliestEventMs: available ? Math.max(start, historyStart) : undefined,
        apps: pkgs.map(p => ({
          packageName: p,
          foregroundMs: available ? (isToday ? todayMin : 60) * MIN : 0,
          openCount: isToday ? opens : 2,
        })),
      };
    },
  );
}

async function seed(patch: object) {
  await AsyncStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      ...DEFAULT_SETTINGS,
      onboarding: { completed: true, step: 'ready' },
      ...patch,
    }),
  );
}
const ready = {
  monitoring: { choice: 'requested', paused: false },
  trackedApps: [IG],
};

const flush = () => new Promise<void>(r => setTimeout(r, 0));
beforeEach(async () => {
  jest.clearAllMocks();
  await flush();
  await AsyncStorage.removeItem(SETTINGS_KEY);
  await AsyncStorage.removeItem(HISTORY_KEY);
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation(() => ({ remove: jest.fn() } as never));
  mock.isAvailable.mockReturnValue(true);
  mock.hasPermission.mockResolvedValue(true);
});
afterEach(async () => {
  await flush();
  jest.restoreAllMocks();
});

describe('Home dashboard (Phase 4)', () => {
  it('without app time: shows the sprout and an optional setup card, reads nothing', async () => {
    await seed({});
    await render(<App />);
    expect(await screen.findByText('Your sprout is still tiny')).toBeTruthy();
    expect(
      screen.getByText('Want to see time in the apps you choose?'),
    ).toBeTruthy();
    expect(mock.getSummary).not.toHaveBeenCalled();
  });

  it('asks to finish setup when access is missing', async () => {
    mock.hasPermission.mockResolvedValue(false);
    await seed(ready);
    await render(<App />);
    expect(await screen.findByText('Finish setting up app time')).toBeTruthy();
    expect(mock.getSummary).not.toHaveBeenCalled();
  });

  it('shows real totals and an honest "building your baseline" state on day one', async () => {
    android(0, 25);
    await seed(ready);
    await render(<App />);
    expect(await screen.findByText('Today in your chosen apps')).toBeTruthy();
    expect(screen.getAllByText('25 min').length).toBeGreaterThan(0);
    expect(screen.getByText(/Building your baseline: 0 of 3/)).toBeTruthy();
    // Days without data are labelled as such in the chart.
    expect(screen.getAllByLabelText(/: no data$/).length).toBe(6);
    expect(screen.queryByText(/past your usual/)).toBeNull();
  });

  it('compares with the usual and explains its suggestion when asked', async () => {
    android(10, 90);
    await seed(ready);
    await render(<App />);
    expect(await screen.findByText(/Your usual day: 1 h/)).toBeTruthy();
    expect(screen.getByText('30 min past your usual')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Why am I seeing this?'));
    expect(
      screen.getByText(/average of your last 7 complete days/),
    ).toBeTruthy();
  });

  it('lets the user pause from the dashboard, after which nothing is read', async () => {
    android(10, 30);
    await seed(ready);
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Pause app time'));
    expect(await screen.findByText('Paused')).toBeTruthy();
    const calls = mock.getSummary.mock.calls.length;
    await fireEvent.press(screen.getByLabelText('Resume app time'));
    expect(await screen.findByText('Today in your chosen apps')).toBeTruthy();
    expect(mock.getSummary.mock.calls.length).toBeGreaterThan(calls);
  });

  it('shows an error with retry instead of numbers when Android fails', async () => {
    const { UsageError } = jest.requireActual('../src/native/usageStats');
    mock.getSummary.mockRejectedValue(
      new UsageError('FAILED', 'Android said no'),
    );
    await seed(ready);
    await render(<App />);
    expect(await screen.findByText('Android said no')).toBeTruthy();
    expect(screen.getByLabelText('Try again')).toBeTruthy();
  });

  it("shows today's practice as done once finished", async () => {
    await seed({ practice: { lastCompletedDate: localDateKey(Date.now()) } });
    await render(<App />);
    expect(
      await screen.findByLabelText(/Today's practice is done/),
    ).toBeTruthy();
  });
});
