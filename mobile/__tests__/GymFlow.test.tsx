import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import App from '../App';
import { SETTINGS_KEY } from '../src/services/settingsStorage';
import { DEFAULT_SETTINGS } from '../src/state/settings';
import { GYM_KEY } from '../src/features/gym/GymContext';
import {
  DrillKind,
  DRILLS,
  gymTiming,
  makeNamesRound,
  planFor,
} from '../src/features/gym/gymModel';
import { REASONING } from '../src/features/gym/content/reasoning';
import { PASSAGES } from '../src/features/gym/content/passages';
import { localDateKey } from '../src/utils/time';

// Full multi-drill journeys need more than Jest's 5 s default under parallel load.
jest.setTimeout(30_000);

const NOW = new Date(2026, 10, 7, 15, 0).getTime();
const TODAY = localDateKey(NOW);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const press = (label: string | RegExp) =>
  fireEvent.press(screen.getByLabelText(label));
const stored = async (k: string) =>
  JSON.parse((await AsyncStorage.getItem(k)) ?? 'null');
const flush = () => new Promise<void>(r => setTimeout(r, 0));

beforeEach(async () => {
  gymTiming.scale = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => NOW);
  await flush();
  await AsyncStorage.removeItem(GYM_KEY);
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

async function doDrill(kind: DrillKind) {
  await screen.findByText(new RegExp(esc(DRILLS[kind].title)));
  switch (kind) {
    case 'reason': {
      const item = REASONING.find(r => screen.queryByText(`“${r.passage}”`))!;
      await press(new RegExp(esc(item.options[item.answer])));
      await press('Check my reasoning');
      expect(await screen.findByText('Sharp thinking!')).toBeTruthy();
      break;
    }
    case 'read': {
      const p = PASSAGES.find(x => screen.queryByText(x.title))!;
      await press("I've read it");
      for (const q of p.questions) {
        await press(new RegExp(`^${esc(q.options[q.answer])}$`));
      }
      await press('Check answers');
      expect(await screen.findByText('3 of 3 from memory')).toBeTruthy();
      break;
    }
    case 'names': {
      const round = makeNamesRound(3, `${TODAY}:names`);
      await press("I've got them");
      for (const q of round.quiz) {
        await waitFor(() => expect(screen.getByText(q.face)).toBeTruthy());
        await press(q.answer);
      }
      expect(await screen.findByText('3 of 3 names remembered')).toBeTruthy();
      break;
    }
    case 'remember':
    case 'steady':
      await press('Start');
      break;
  }
  await fireEvent.press(await screen.findByLabelText('Continue'));
}

describe('Attention gym (Phase 6)', () => {
  it('runs a full daily workout, plants a flower and marks practice done', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Train tab'));
    expect(await screen.findByText('Three short drills. Ready?')).toBeTruthy();
    expect(
      screen.getByText(
        "Your first flower appears when you finish today's workout.",
      ),
    ).toBeTruthy();

    await press('Start workout');
    for (const kind of planFor(TODAY)) {
      await doDrill(kind);
    }

    expect(
      await screen.findByText("A new flower for Pip's garden!"),
    ).toBeTruthy();
    const gym = await stored(GYM_KEY);
    expect(gym.attempts).toHaveLength(3);
    expect(gym.workouts[TODAY].completedAt).toBe(NOW);
    expect(
      gym.attempts.every((a: { sync: string }) => a.sync === 'pending'),
    ).toBe(true);
    await waitFor(async () =>
      expect((await stored(SETTINGS_KEY)).practice.lastCompletedDate).toBe(
        TODAY,
      ),
    );

    await press('Back to the gym');
    expect(await screen.findByText('Done for today! 🌸')).toBeTruthy();
    expect(screen.getByLabelText("Pip's garden: 1 flower")).toBeTruthy();
    expect(screen.getByLabelText('Today: workout done')).toBeTruthy();

    await press('Home tab');
    expect(await screen.findByText('Workout done ✓')).toBeTruthy();
  });

  it('resumes a half-finished workout and grades a wrong answer honestly', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Train tab'));
    await press('Start workout');
    await screen.findByText(new RegExp(esc(DRILLS.reason.title)));
    const item = REASONING.find(r => screen.queryByText(`“${r.passage}”`))!;
    const wrong = item.options[(item.answer + 1) % 4];
    await press(new RegExp(esc(wrong)));
    await press('Check my reasoning');
    expect(
      await screen.findByText('Good try. Here’s the key idea.'),
    ).toBeTruthy();
    expect(screen.getByText(item.explanation)).toBeTruthy();
    await press('Continue');
    await press('Leave drill');
    expect(await screen.findByText('1 of 3 done. Keep going?')).toBeTruthy();
    expect(screen.getByLabelText('Continue workout')).toBeTruthy();
    const gym = await stored(GYM_KEY);
    expect(gym.attempts[0]).toMatchObject({ drill: 'reason', score: 0 });
  });

  it('free practice saves a result without touching the workout', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Train tab'));
    await press('Practise Steady eye');
    await press('Start');
    await fireEvent.press(await screen.findByLabelText('Continue'));
    expect(await screen.findByText(/Steady eye: \d+% saved/)).toBeTruthy();
    expect(screen.getByText('Three short drills. Ready?')).toBeTruthy();
  });
});
