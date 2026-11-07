import React from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import App from '../App';
import { usageStats } from '../src/native/usageStats';
import { SETTINGS_KEY } from '../src/services/settingsStorage';
import { DEFAULT_SETTINGS } from '../src/state/settings';

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
const YT = { packageName: 'com.google.android.youtube', label: 'YouTube' };

// Capture AppState listeners so we can simulate returning from Android Settings.
let appStateListeners: ((s: AppStateStatus) => void)[] = [];
const resume = async () => {
  await act(async () => {
    appStateListeners.forEach(l => l('active'));
  });
};

const stored = async () =>
  JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) ?? 'null');

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
const optedIn = { monitoring: { choice: 'requested', paused: false } };

async function openInsights() {
  await render(<App />);
  await fireEvent.press(await screen.findByLabelText('Insights tab'));
}

const flush = () => new Promise<void>(r => setTimeout(r, 0));
beforeEach(async () => {
  jest.clearAllMocks();
  await flush();
  await AsyncStorage.removeItem(SETTINGS_KEY);
  appStateListeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, l) => {
    appStateListeners.push(l as (s: AppStateStatus) => void);
    return { remove: jest.fn() } as never;
  });
  mock.isAvailable.mockReturnValue(true);
  mock.hasPermission.mockResolvedValue(false);
  mock.openSettings.mockResolvedValue();
  mock.getLaunchableApps.mockResolvedValue([IG, YT]);
  mock.getSummary.mockImplementation(async (start, end, pkgs) => ({
    rangeStartMs: start,
    rangeEndMs: end,
    source: 'android_usage_events',
    eventCount: 10,
    earliestEventMs: start,
    apps: pkgs.map(p => ({
      packageName: p,
      foregroundMs: p === IG.packageName ? 75 * MIN : 20 * MIN,
      openCount: p === IG.packageName ? 14 : 3,
    })),
  }));
});
afterEach(async () => {
  await flush();
  jest.restoreAllMocks();
});

describe('app time (Phase 3)', () => {
  it('stays off until the user opts in, and reads nothing', async () => {
    await seed({});
    await openInsights();
    expect(
      screen.getByText('See where your time goes (optional)'),
    ).toBeTruthy();
    expect(mock.getSummary).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Set up app time'));
    expect(await screen.findByText('Allow Usage Access')).toBeTruthy();
    expect((await stored()).monitoring.choice).toBe('requested');
  });

  it('explains, opens Android settings, and notices the grant when the user comes back', async () => {
    await seed(optedIn);
    await openInsights();
    expect(await screen.findByText('Allow Usage Access')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Open Android settings'));
    expect(mock.openSettings).toHaveBeenCalledTimes(1);

    mock.hasPermission.mockResolvedValue(true);
    await resume();
    expect(await screen.findByText('Now choose your apps')).toBeTruthy();
    const saved = await stored();
    expect(
      saved.consents.filter(
        (c: { purpose: string }) => c.purpose === 'usage_access_permission',
      ),
    ).toHaveLength(1);
  });

  it('lets the user pick apps (nothing pre-selected) and shows real totals', async () => {
    mock.hasPermission.mockResolvedValue(true);
    await seed(optedIn);
    await openInsights();
    await fireEvent.press(await screen.findByLabelText('Choose apps'));
    const ig = await screen.findByLabelText('Instagram');
    expect(ig.props.accessibilityState.checked).toBe(false);
    expect(
      screen.getByLabelText('YouTube').props.accessibilityState.checked,
    ).toBe(false);
    await fireEvent.press(ig);
    await fireEvent.press(screen.getByLabelText('Save 1 app'));

    // Total for the day and the Instagram row both show the real number.
    expect(await screen.findAllByText('1 h 15 min')).toHaveLength(2);
    expect(
      screen.getByLabelText(/Instagram: 1 h 15 min today, opened 14 times/),
    ).toBeTruthy();
    expect((await stored()).trackedApps).toEqual([IG]);
    // Only the chosen package is ever requested once apps are saved.
    const lastCall = mock.getSummary.mock.calls.at(-1)!;
    expect(lastCall[2]).toEqual([IG.packageName]);
  });

  it('detects revocation when the user returns to the app', async () => {
    mock.hasPermission.mockResolvedValue(true);
    await seed({ ...optedIn, trackedApps: [IG] });
    await openInsights();
    expect(await screen.findByText('App time today')).toBeTruthy();

    mock.hasPermission.mockResolvedValue(false);
    await resume();
    expect(await screen.findByText('Allow Usage Access')).toBeTruthy();
    expect(screen.getByText(/Usage Access was switched off/)).toBeTruthy();
    await waitFor(async () => {
      const access = (await stored()).consents
        .filter(
          (c: { purpose: string }) => c.purpose === 'usage_access_permission',
        )
        .map((c: { granted: boolean }) => c.granted);
      expect(access).toEqual([true, false]);
    });
  });

  it('reads nothing while paused', async () => {
    mock.hasPermission.mockResolvedValue(true);
    await seed({
      monitoring: { choice: 'requested', paused: true },
      trackedApps: [IG],
    });
    await openInsights();
    expect(await screen.findByText('Paused')).toBeTruthy();
    expect(mock.getSummary).not.toHaveBeenCalled();
  });

  it('shows an error with retry when Android refuses', async () => {
    mock.hasPermission.mockResolvedValue(true);
    const { UsageError } = jest.requireActual('../src/native/usageStats');
    mock.getSummary.mockRejectedValue(
      new UsageError('FAILED', 'Android said no'),
    );
    await seed({ ...optedIn, trackedApps: [IG] });
    await openInsights();
    expect(await screen.findByText('Android said no')).toBeTruthy();
    expect(screen.getByLabelText('Try again')).toBeTruthy();
  });

  it('prompts on Home until setup is finished', async () => {
    await seed(optedIn);
    await render(<App />);
    expect(await screen.findByText('Finish setting up app time')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Continue setup'));
    expect(await screen.findByText('Allow Usage Access')).toBeTruthy();
  });
});
