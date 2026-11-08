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
import { loadSettings, SETTINGS_KEY } from '../src/services/settingsStorage';
import {
  cleanSites,
  DEFAULT_SETTINGS,
  normalizeSite,
  settingsReducer,
} from '../src/state/settings';
import { pauseGate, ReelDayStats } from '../src/native/pauseGate';
import { reelBreakdown, reelMood } from '../src/features/pause/WebAndReels';
import { FOCUS_KEY } from '../src/features/focus/FocusContext';
import { localDateKey } from '../src/utils/time';

jest.setTimeout(30_000);

jest.mock('../src/native/pauseGate', () => {
  const actual = jest.requireActual('../src/native/pauseGate');
  return {
    ...actual,
    pauseGate: {
      isAvailable: jest.fn(() => true),
      isServiceEnabled: jest.fn(async () => true),
      openSettings: jest.fn(async () => {}),
      configure: jest.fn(async () => {}),
      getStats: jest.fn(async () => []),
      clearStats: jest.fn(async () => {}),
      configureExtras: jest.fn(async () => {}),
      getReelStats: jest.fn(async () => []),
      configureIntensity: jest.fn(async () => {}),
    },
  };
});
const gate = pauseGate as jest.Mocked<typeof pauseGate>;

const NOW = new Date(2026, 10, 8, 15, 0).getTime();
const press = (l: string | RegExp) => fireEvent.press(screen.getByLabelText(l));
const stored = async () =>
  JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) ?? 'null');
const flush = () => new Promise<void>(r => setTimeout(r, 0));
const AT = '2026-11-08T10:00:00.000Z';

describe('site names', () => {
  it('normalises what people type into a bare site', () => {
    expect(normalizeSite('https://www.Reddit.com/r/x?y=1')).toBe('reddit.com');
    expect(normalizeSite(' m.youtube.com ')).toBe('youtube.com');
    expect(normalizeSite('old.reddit.com')).toBe('old.reddit.com');
    expect(normalizeSite('x.com')).toBe('x.com');
    expect(normalizeSite('reddit')).toBeNull();
    expect(normalizeSite('funny cats')).toBeNull();
    expect(normalizeSite('')).toBeNull();
  });

  it('cleans, de-duplicates and caps site lists', () => {
    expect(cleanSites(['reddit.com', 'www.reddit.com', 'nope', 3, 'x.com'])).toEqual([
      'reddit.com',
      'x.com',
    ]);
    expect(cleanSites('reddit.com')).toEqual([]);
    expect(cleanSites(Array.from({ length: 80 }, (_, i) => `s${i}.com`))).toHaveLength(50);
  });
});

describe('settings for websites and reels', () => {
  it('records a separate consent each time a feature is switched on or off', () => {
    let s = settingsReducer(DEFAULT_SETTINGS, { type: 'setWeb', enabled: true, at: AT });
    s = settingsReducer(s, { type: 'setWeb', enabled: true, at: AT }); // no-op
    s = settingsReducer(s, { type: 'setReels', enabled: true, at: AT });
    s = settingsReducer(s, { type: 'setReels', enabled: false, at: AT });
    expect(s.consents.map(c => [c.purpose, c.granted])).toEqual([
      ['accessibility_website_pause', true],
      ['accessibility_reels_counter', true],
      ['accessibility_reels_counter', false],
    ]);
    expect(s.web.enabled).toBe(true);
    expect(s.reels.enabled).toBe(false);
  });

  it('clamps the reel limit', () => {
    const s = settingsReducer(DEFAULT_SETTINGS, { type: 'setReelLimit', limit: 5000 });
    expect(s.reels.limit).toBe(1000);
    expect(settingsReducer(s, { type: 'setReelLimit', limit: -3 }).reels.limit).toBe(0);
  });

  it('loads old saved settings (before this feature) with both features off', async () => {
    const old: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    delete old.web;
    delete old.reels;
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(old));
    const loaded = await loadSettings();
    expect(loaded.web).toEqual({ enabled: false, sites: [] });
    expect(loaded.reels).toEqual({ enabled: false, limit: 0, showPip: true });
  });

  it('sanitises tampered saved values', async () => {
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        web: { enabled: 'yes', sites: ['REDDIT.com/x', 42, 'bad site'] },
        reels: { enabled: true, limit: 'lots', showPip: false },
      }),
    );
    const loaded = await loadSettings();
    expect(loaded.web).toEqual({ enabled: false, sites: ['reddit.com'] });
    expect(loaded.reels).toEqual({ enabled: true, limit: 0, showPip: false });
  });
});

describe('reel breakdown', () => {
  it('names the apps and groups browsers together', () => {
    expect(
      reelBreakdown({
        'com.google.android.youtube': 15,
        'com.android.chrome': 2,
        'com.brave.browser': 1,
      }),
    ).toBe('YouTube Shorts: 15 · In your browser: 3');
    expect(reelBreakdown({})).toBe('');
  });
});

describe('Pip on the reels card', () => {
  it('reacts kindly and never scolds', () => {
    expect(reelMood(0, 0).mood).toBe('cheer');
    expect(reelMood(5, 0).mood).toBe('happy');
    expect(reelMood(30, 0).mood).toBe('think');
    expect(reelMood(40, 40).line).toMatch(/limit of 40/);
    for (const n of [0, 5, 30, 80, 500]) {
      expect(reelMood(n, 0).line).not.toMatch(/brain ?rot|damag|lazy|bad|shame/i);
    }
  });
});

describe('website pause and reels counter screens', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
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
  });

  it('Home shows today at a glance: Not now, reels and focus minutes', async () => {
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        onboarding: { completed: true, step: 'ready' },
        gate: { enabled: true, packages: [], allowMinutes: 5 },
        reels: { enabled: true, limit: 0, showPip: true },
      }),
    );
    gate.getStats.mockResolvedValue([
      { date: localDateKey(NOW), shown: 6, notNow: 4, opened: 2 },
    ]);
    gate.getReelStats.mockResolvedValue([
      { date: localDateKey(NOW), total: 12, byApp: { 'com.google.android.youtube': 12 } },
    ]);
    await render(<App />);
    expect(
      await screen.findByLabelText('Today: 4 Not now, 12 reels, 0 focus min'),
    ).toBeTruthy();
  });

  it('the reels counter needs its own tick-box consent before it switches on', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Insights tab'));
    await press('Count my reels');
    expect(
      await screen.findByText('The reels counter notices short-video swipes'),
    ).toBeTruthy();
    expect(screen.getByText(/Never sees which videos you watch/)).toBeTruthy();

    await press('Agree and switch on'); // disabled until ticked
    expect((await stored()).reels.enabled).toBe(false);

    await press(/noticing short-video swipes/);
    await press('Agree and switch on');
    await waitFor(async () => {
      const s = await stored();
      expect(s.reels.enabled).toBe(true);
      expect(gate.configureExtras).toHaveBeenLastCalledWith(false, [], true, 0, true);
    });
  });

  it('shows today\'s real count, per app, and lets the user set a limit', async () => {
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        onboarding: { completed: true, step: 'ready' },
        reels: { enabled: true, limit: 0, showPip: true },
      }),
    );
    gate.getReelStats.mockImplementation(async dates =>
      dates.map(
        (d): ReelDayStats =>
          d === localDateKey(NOW)
            ? {
                date: d,
                total: 23,
                byApp: { 'com.google.android.youtube': 15, 'com.instagram.android': 8 },
              }
            : { date: d, total: 0, byApp: {} },
      ),
    );
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Insights tab'));
    expect(await screen.findByLabelText('23')).toBeTruthy();
    await press(/^Reels counter: 23 reels today/); // open the tile
    expect(screen.getByText('YouTube Shorts: 15 · Instagram Reels: 8')).toBeTruthy();
    await press('40');
    await waitFor(() =>
      expect(gate.configureExtras).toHaveBeenLastCalledWith(false, [], true, 40, true),
    );
    await press('Show Pip with the count on top of Shorts and Reels');
    await waitFor(() =>
      expect(gate.configureExtras).toHaveBeenLastCalledWith(false, [], true, 40, false),
    );
  });

  it('the website pause has its own consent, suggests sites and accepts typed ones', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Insights tab'));
    await press('Set up the website pause');
    expect(
      await screen.findByText("The website pause reads your browser's address bar"),
    ).toBeTruthy();
    expect(screen.getByText(/Never reads page content/)).toBeTruthy();
    await press(/reading my browser's address bar/);
    await press('Agree and switch on');

    await fireEvent.changeText(
      await screen.findByLabelText('Add a website'),
      'https://www.9GAG.com/hot',
    );
    await press('Add');
    await fireEvent.changeText(screen.getByLabelText('Add a website'), 'not a site');
    await press('Add');
    expect(screen.getByText('Type a site like reddit.com')).toBeTruthy();

    await waitFor(async () => {
      const s = await stored();
      expect(s.web).toEqual({
        enabled: true,
        sites: ['youtube.com', 'instagram.com', 'facebook.com', '9gag.com'],
      });
      expect(
        s.consents.filter((c: { purpose: string }) => c.purpose === 'accessibility_website_pause'),
      ).toHaveLength(1);
      expect(gate.configureExtras).toHaveBeenLastCalledWith(
        true,
        ['youtube.com', 'instagram.com', 'facebook.com', '9gag.com'],
        false,
        0,
        true,
      );
    });
  });
});
