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
import { FOCUS_KEY } from '../src/features/focus/FocusContext';

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
      configureExtras: jest.fn(async () => {}),
      configureIntensity: jest.fn(async () => {}),
      getReelStats: jest.fn(async () => []),
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

const NOW = new Date(2026, 10, 8, 15, 0).getTime();
const press = (l: string | RegExp) => fireEvent.press(screen.getByLabelText(l));
const stored = async () =>
  JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) ?? 'null');
const flush = () => new Promise<void>(r => setTimeout(r, 0));

async function seedAt(extra: Record<string, unknown> = {}) {
  await AsyncStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      ...DEFAULT_SETTINGS,
      onboarding: { completed: false, step: 'protect', protect: 'ask' },
      profile: { ...DEFAULT_SETTINGS.profile, dailyScreenHours: 7 },
      ...extra,
    }),
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockImplementation(() => NOW);
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation(() => ({ remove: jest.fn() } as never));
  await flush();
  await AsyncStorage.removeItem(FOCUS_KEY);
});
afterEach(async () => {
  await flush();
  jest.restoreAllMocks();
});

describe('onboarding: win back your time', () => {
  it('"Set up later" skips every protection step', async () => {
    await seedAt();
    await render(<App />);
    expect(
      await screen.findByText("First, let's win back some of that time."),
    ).toBeTruthy();
    await press('Set up later');
    expect(
      await screen.findByText('So what would you rather spend that time on?'),
    ).toBeTruthy();
    const s = await stored();
    expect(s.onboarding.protect).toBe('later');
    expect(s.gate.enabled).toBe(false);
    expect(s.consents).toEqual([]);
  });

  it('sets up apps and reels with their own consents, a level, then the one Android step', async () => {
    await seedAt();
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText("Yes, let's win it back"));

    // Apps: needs at least one app and the tick box.
    expect(await screen.findByText('Which apps pull you in the most?')).toBeTruthy();
    await press('Continue');
    expect((await stored()).gate.enabled).toBe(false);
    await press('Choose apps');
    await fireEvent.press(await screen.findByLabelText('Instagram'));
    await press('Save 1 app');
    await press(/I understand and agree to RECLAIM using the Accessibility service/);
    await press('Continue');

    // Reels: its own disclosure and tick.
    expect(await screen.findByText('Want me to count your Shorts and Reels?')).toBeTruthy();
    expect(screen.getByText(/Never sees which videos you watch/)).toBeTruthy();
    await press('40 reels');
    await press(/noticing short-video swipes/);
    await press('Continue');

    // Websites: skipped.
    expect(await screen.findByText('Feeds live in the browser too.')).toBeTruthy();
    await press('Skip this');

    // Level: Gentle by default; the user picks Firm.
    expect(await screen.findByText('How firm should I be?')).toBeTruthy();
    // Nothing is final during onboarding: back and forth applies at once, no "From …" wait.
    await press(/^Firm/);
    await press(/^Aware/);
    expect(screen.queryByText(/^From /)).toBeNull();
    expect(screen.getByLabelText(/^Aware/).props.accessibilityState).toMatchObject({
      selected: true,
    });
    await press(/^Firm/);
    await press('Continue');

    // One trip to Android Settings.
    expect(await screen.findByText('Last step: switch me on.')).toBeTruthy();
    await press('Open Accessibility settings');
    expect(gate.openSettings).toHaveBeenCalledTimes(1);
    await press("I'll do it later");
    expect(
      await screen.findByText('So what would you rather spend that time on?'),
    ).toBeTruthy();

    await waitFor(async () => {
      const s = await stored();
      expect(s.gate.enabled).toBe(true);
      expect(s.gate.packages).toEqual([
        { packageName: 'com.instagram.android', label: 'Instagram' },
      ]);
      expect(s.reels).toMatchObject({ enabled: true, limit: 40 });
      expect(s.web.enabled).toBe(false);
      expect(s.intensity.base).toBe(3);
      expect(s.consents.map((c: { purpose: string }) => c.purpose)).toEqual([
        'accessibility_pause',
        'accessibility_reels_counter',
      ]);
    });
    expect(gate.configureIntensity).toHaveBeenLastCalledWith(
      expect.objectContaining({ base: 3 }),
    );
  });

  it('skips the level and Android steps when nothing was switched on', async () => {
    await seedAt();
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText("Yes, let's win it back"));
    await press('Skip this'); // apps
    await fireEvent.press(await screen.findByLabelText('Skip this')); // reels
    await fireEvent.press(await screen.findByLabelText('Skip this')); // web
    expect(
      await screen.findByText('So what would you rather spend that time on?'),
    ).toBeTruthy();
  });

  it('says thank you when the service is already on', async () => {
    gate.isServiceEnabled.mockResolvedValue(true);
    await seedAt({
      onboarding: { completed: false, step: 'protectEnable', protect: 'yes' },
      reels: { enabled: true, limit: 0, showPip: true },
    });
    await render(<App />);
    expect(await screen.findByText("You're protected! 🎉")).toBeTruthy();
  });
});

describe('intensity in Insights', () => {
  it('tightens now, loosens after a day (cancellable), and Strict has an end', async () => {
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        onboarding: { completed: true, step: 'ready', protect: 'later' },
      }),
    );
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Insights tab'));
    await press(/^Intensity:/); // open the tile
    await press(/^Firm/);
    await waitFor(async () => expect((await stored()).intensity.base).toBe(3));

    await press(/^Gentle/);
    // Gentle is selected at once, marked with when it starts; Firm stays in force until then.
    expect(await screen.findByText(/^From /)).toBeTruthy();
    expect(screen.getByText('Now')).toBeTruthy();
    expect(screen.getByLabelText(/^Gentle/).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect((await stored()).intensity.base).toBe(3);
    await press(/^Firm/); // changed my mind: stay Firm
    await waitFor(async () => expect((await stored()).intensity.pending).toBeNull());

    await press('Try Strict for a while');
    await press('For 24 hours');
    expect(await screen.findByText(/✓ Strict until/)).toBeTruthy();
    await waitFor(async () =>
      expect((await stored()).intensity.strictUntil).toBe(NOW + 24 * 3_600_000),
    );
  });
});
