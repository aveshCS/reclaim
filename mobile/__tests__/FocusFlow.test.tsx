import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import App from '../App';
import { SETTINGS_KEY } from '../src/services/settingsStorage';
import { DEFAULT_SETTINGS } from '../src/state/settings';
import { FOCUS_KEY } from '../src/features/focus/FocusContext';

// Renders the whole app; under a full parallel run it can exceed Jest's 5 s default.
jest.setTimeout(30_000);

const MIN = 60_000;
let NOW = new Date(2026, 10, 7, 15, 0).getTime();

const storedFocus = async () =>
  JSON.parse((await AsyncStorage.getItem(FOCUS_KEY)) ?? 'null');

async function seedSettings() {
  await AsyncStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      ...DEFAULT_SETTINGS,
      onboarding: { completed: true, step: 'ready' },
      profile: { ...DEFAULT_SETTINGS.profile, name: 'Asha' },
    }),
  );
}
async function seedFocus(active: object | null, history: object[] = []) {
  await AsyncStorage.setItem(
    FOCUS_KEY,
    JSON.stringify({ version: 1, active, history }),
  );
}
const running = (startedMinAgo: number, plannedMin = 25) => ({
  id: 'run1',
  intention: 'Essay draft',
  plannedMs: plannedMin * MIN,
  startedAt: NOW - startedMinAgo * MIN,
  status: 'running',
  accumulatedMs: 0,
  resumedAt: NOW - startedMinAgo * MIN,
  pauses: 0,
});

const press = (label: string) => fireEvent.press(screen.getByLabelText(label));
const flush = () => new Promise<void>(r => setTimeout(r, 0));

beforeEach(async () => {
  NOW = new Date(2026, 10, 7, 15, 0).getTime();
  jest.spyOn(Date, 'now').mockImplementation(() => NOW);
  await flush();
  await AsyncStorage.removeItem(SETTINGS_KEY);
  await AsyncStorage.removeItem(FOCUS_KEY);
  await seedSettings();
});
afterEach(async () => {
  await flush();
  jest.restoreAllMocks();
});

describe('focus sessions (Phase 5)', () => {
  it('starts, pauses, resumes and keeps correct time across a "background" gap', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Focus tab'));
    await fireEvent.changeText(
      screen.getByLabelText('Intention for this session'),
      'Chapter 4',
    );
    await press('Start session');
    expect(await screen.findByText('Chapter 4')).toBeTruthy();
    expect(screen.getByLabelText('25 min left')).toBeTruthy();

    // 10 minutes pass while the app is in the background.
    NOW += 10 * MIN;
    await press('Pause');
    expect(await screen.findByLabelText('15 min left')).toBeTruthy();

    NOW += 30 * MIN; // a long break does not count
    await press('Resume');
    NOW += 5 * MIN;
    await press('Pause');
    expect(await screen.findByLabelText('10 min left')).toBeTruthy();
    expect((await storedFocus()).active.status).toBe('paused');
  });

  it('recovers a running session after the app was killed', async () => {
    await seedFocus(running(10));
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Focus tab'));
    expect(await screen.findByText('Essay draft')).toBeTruthy();
    expect(screen.getByLabelText('15 min left')).toBeTruthy();
  });

  it('finishes a session that ran out while the app was closed, and saves it once', async () => {
    await seedFocus(running(40));
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Focus tab'));
    expect(
      await screen.findByText(/finished while you were away/),
    ).toBeTruthy();
    expect(screen.getByText('25 min of focus. Lovely.')).toBeTruthy();
    await waitFor(async () => {
      const s = await storedFocus();
      expect(s.active).toBeNull();
      expect(s.history).toHaveLength(1);
    });
    const saved = (await storedFocus()).history[0];
    expect(saved).toMatchObject({ status: 'completed', actualMs: 25 * MIN });
    expect(saved.endedAt).toBe(NOW - 15 * MIN);
  });

  it('ends early with confirmation and saves the reflection', async () => {
    await seedFocus(running(12));
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Focus tab'));
    await press('End early');
    expect(screen.getByText(/12 min will be saved/)).toBeTruthy();
    await press('Yes, end session');
    expect(await screen.findByText('12 min still counts.')).toBeTruthy();
    await press('Yes, I made progress');
    await press('A few');
    await press('Save reflection');
    expect(await screen.findByText('One thing at a time.')).toBeTruthy();
    const s = await storedFocus();
    expect(s.history).toHaveLength(1);
    expect(s.history[0]).toMatchObject({
      status: 'ended_early',
      actualMs: 12 * MIN,
      reflection: { progress: 'yes', interruptions: 'few' },
    });
  });

  it('Pip on Home shows real focus minutes, growth, and reacts to a tap', async () => {
    await seedFocus(null, [
      {
        id: 'h1',
        intention: '',
        plannedMs: 25 * MIN,
        actualMs: 30 * MIN,
        startedAt: NOW - 60 * MIN,
        endedAt: NOW - 30 * MIN,
        status: 'completed',
        pauses: 0,
        reflection: null,
        sync: 'pending',
      },
    ]);
    await render(<App />);
    expect(
      await screen.findByText(/Today: 30 min in focus · 1 session completed/),
    ).toBeTruthy();
    expect(screen.getByText('Sprout')).toBeTruthy();
    expect(screen.getByText('70 min to Seedling')).toBeTruthy();
    expect(
      screen.getByText('We focused 30 min today! My leaves feel stronger.'),
    ).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Pip. Tap to say hello'));
    });
    expect(screen.getByText('Hehe, that tickles! 🌱')).toBeTruthy();
  });
});
