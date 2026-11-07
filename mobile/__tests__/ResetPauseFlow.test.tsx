import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import App from '../App';
import { SETTINGS_KEY } from '../src/services/settingsStorage';
import { DEFAULT_SETTINGS } from '../src/state/settings';
import { pauseGate } from '../src/native/pauseGate';
import { usageStats } from '../src/native/usageStats';
import { gymTiming } from '../src/features/gym/gymModel';
import { FOCUS_KEY } from '../src/features/focus/FocusContext';
import { localDateKey } from '../src/utils/time';

jest.setTimeout(30_000);

jest.mock('../src/native/pauseGate', () => {
  const actual = jest.requireActual('../src/native/pauseGate');
  return {
    ...actual,
    pauseGate: {
      isAvailable: jest.fn(() => true),
      isServiceEnabled: jest.fn(async () => false),
      openSettings: jest.fn(async () => {}),
      configure: jest.fn(async () => {}),
      getStats: jest.fn(async () => []),
      clearStats: jest.fn(async () => {}),
    },
  };
});
jest.mock('../src/native/usageStats', () => {
  const actual = jest.requireActual('../src/native/usageStats');
  return {
    ...actual,
    usageStats: {
      isAvailable: jest.fn(() => true),
      hasPermission: jest.fn(async () => false),
      openSettings: jest.fn(),
      getLaunchableApps: jest.fn(async () => [
        { packageName: 'com.instagram.android', label: 'Instagram' },
        { packageName: 'com.google.android.youtube', label: 'YouTube' },
      ]),
      getSummary: jest.fn(),
    },
  };
});
const gate = pauseGate as jest.Mocked<typeof pauseGate>;
const usage = usageStats as jest.Mocked<typeof usageStats>;

const NOW = new Date(2026, 10, 7, 15, 0).getTime();
const press = (l: string | RegExp) => fireEvent.press(screen.getByLabelText(l));
const stored = async () =>
  JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) ?? 'null');
const flush = () => new Promise<void>(r => setTimeout(r, 0));

beforeEach(async () => {
  jest.clearAllMocks();
  gymTiming.scale = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => NOW);
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation(() => ({ remove: jest.fn() } as never));
  await flush();
  await AsyncStorage.removeItem(FOCUS_KEY);
  await AsyncStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      ...DEFAULT_SETTINGS,
      onboarding: { completed: true, step: 'ready' },
    }),
  );
});
afterEach(async () => {
  await flush();
  jest.restoreAllMocks();
  gymTiming.scale = 1;
});

describe('mindful pause setup (Play policy disclosure)', () => {
  it('shows a separate disclosure; nothing is enabled until the user ticks and agrees', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Insights tab'));
    await press('Set up the pause');
    expect(
      await screen.findByText("RECLAIM uses Android's Accessibility service"),
    ).toBeTruthy();
    expect(
      screen.getByText(/does not read what is on your screen/),
    ).toBeTruthy();
    // Button is disabled until the box is ticked.
    await press('Agree and open settings');
    expect(gate.openSettings).not.toHaveBeenCalled();
    expect((await stored()).gate.enabled).toBe(false);

    await press(/I understand and agree/);
    await press('Agree and open settings');
    expect(gate.openSettings).toHaveBeenCalledTimes(1);
    await waitFor(async () => {
      const s = await stored();
      expect(s.gate.enabled).toBe(true);
      expect(
        s.consents.filter(
          (c: { purpose: string }) => c.purpose === 'accessibility_pause',
        ),
      ).toHaveLength(1);
    });
    expect(await screen.findByText('One step left')).toBeTruthy();
  });

  it('declining leaves everything off', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Insights tab'));
    await press('Set up the pause');
    await press('No thanks');
    expect((await stored()).gate.enabled).toBe(false);
    expect(gate.openSettings).not.toHaveBeenCalled();
  });

  it('lets the user choose apps without Usage Access and pushes config to Android', async () => {
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        onboarding: { completed: true, step: 'ready' },
        gate: { enabled: true, packages: [], allowMinutes: 5 },
        plan: { when: 'I feel bored', then: 'read one page' },
      }),
    );
    gate.isServiceEnabled.mockResolvedValue(true);
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Insights tab'));
    expect(await screen.findByText(/The pause is on/)).toBeTruthy();
    await press('Choose apps');
    await fireEvent.press(await screen.findByLabelText('Instagram'));
    await press('Save 1 app');
    await waitFor(() =>
      expect(gate.configure).toHaveBeenLastCalledWith(
        true,
        [{ packageName: 'com.instagram.android', label: 'Instagram' }],
        5,
        'I feel bored → read one page',
      ),
    );
    expect(usage.getSummary).not.toHaveBeenCalled();
  });
});

describe('the 14-day Reset', () => {
  it('starts with a limit and a plan, takes the day-1 check, then shows day 1', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Learn more'));
    expect(
      await screen.findByText('14 days to get your attention back'),
    ).toBeTruthy();
    expect(screen.getByText(/2025 study of 467 adults/)).toBeTruthy();
    await press("I'm in");
    await press('45 min a day');
    await press('Continue');
    await press('I feel bored');
    await press('read one page first');
    await press('Start my Reset');

    expect(
      await screen.findByText('How steady is your attention?'),
    ).toBeTruthy();
    await press('Start');
    await fireEvent.press(await screen.findByLabelText('Continue'));

    expect(await screen.findByText('13 days to go')).toBeTruthy();
    await press('Yes, I kept it');
    await waitFor(async () => {
      const s = await stored();
      expect(s.reset).toMatchObject({
        startDate: localDateKey(NOW),
        limitMin: 45,
        keptDays: [localDateKey(NOW)],
      });
      expect(typeof s.reset.baselineScore).toBe('number');
      expect(s.plan).toEqual({
        when: 'I feel bored',
        then: 'read one page first',
      });
    });
  });
});

describe('move break before focus', () => {
  it('can be skipped straight into a focus session', async () => {
    gymTiming.scale = 1; // real one-second ticks for this one
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Focus tab'));
    await press('🏃 Move for 5 min first');
    expect(await screen.findByText('March on the spot')).toBeTruthy();
    await press('Skip to focus');
    expect(await screen.findByLabelText(/min left/)).toBeTruthy();
  });
});
