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

const stored = async () =>
  JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) ?? 'null');

async function seed(patch: object) {
  await AsyncStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ ...DEFAULT_SETTINGS, ...patch }),
  );
}
const seedCompleted = (patch: object = {}) =>
  seed({ onboarding: { completed: true, step: 'ready' }, ...patch });

const press = (label: string) => fireEvent.press(screen.getByLabelText(label));

// Let any in-flight save from the previous test finish before wiping storage.
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));
afterEach(async () => {
  await flush();
});
beforeEach(async () => {
  await flush();
  await AsyncStorage.removeItem(SETTINGS_KEY);
});

describe('main app (onboarding already done)', () => {
  it('renders Home and navigates through all five tabs', async () => {
    await seedCompleted();
    await render(<App />);
    expect(await screen.findByLabelText('Grow together · 25 min')).toBeTruthy();
    const expectations: [string, string][] = [
      ['Focus', 'One thing at a time.'],
      ['Train', 'Rebuild your attention.'],
      ['Insights', 'Progress, not perfection.'],
      ['Profile', 'Your settings.'],
      ['Home', 'Grow together · 25 min'],
    ];
    for (const [tab, heading] of expectations) {
      await press(`${tab} tab`);
      expect(screen.getByText(heading)).toBeTruthy();
    }
  });

  it('greets the user by name and shows no fake metrics', async () => {
    await seedCompleted({
      profile: { ...DEFAULT_SETTINGS.profile, name: 'Asha' },
    });
    await render(<App />);
    expect(await screen.findByText(/^(Good \w+|Still up), Asha\.$/)).toBeTruthy();
    expect(screen.queryByText(/mindful breaks/i)).toBeNull();
    expect(screen.queryByText(/minutes today/i)).toBeNull();
  });

  it('uses the saved default focus length', async () => {
    await seedCompleted({ focusMinutes: 30 });
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Focus tab'));
    expect(screen.getByText('30:00')).toBeTruthy();
  });

  it('lets the user pause monitoring from Profile and saves it', async () => {
    await seedCompleted({ monitoring: { choice: 'requested', paused: false } });
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Profile tab'));
    await fireEvent(
      screen.getByLabelText('Pause monitoring'),
      'valueChange',
      true,
    );
    await waitFor(async () =>
      expect((await stored()).monitoring.paused).toBe(true),
    );
  });
});

describe('onboarding with Pip', () => {
  it('can be skipped end to end without recording consent or profile data', async () => {
    await render(<App />);
    expect(await screen.findByText("Hi, I'm Pip! 🌱")).toBeTruthy();
    await press('Skip'); // name
    await press('Skip'); // role
    await press('None of these'); // struggles (exam is not shown)
    await press('That makes sense'); // science
    await press('Skip'); // age
    await press("I'd rather not say"); // screen time -> reality is skipped
    expect(
      screen.getByText('So what would you rather spend that time on?'),
    ).toBeTruthy();
    await press('Skip'); // priorities
    await press('Continue'); // duration
    await press('Skip'); // monitoring
    await press('Skip'); // pledge
    await press("Let's begin");

    expect(await screen.findByLabelText('Grow together · 25 min')).toBeTruthy();
    const saved = await stored();
    expect(saved.onboarding.completed).toBe(true);
    expect(saved.consents).toEqual([]);
    expect(saved.profile).toEqual(DEFAULT_SETTINGS.profile);
  });

  it('builds a student profile, shows the reality check and the pledge', async () => {
    await render(<App />);
    await fireEvent.changeText(
      await screen.findByLabelText('Your first name'),
      'Asha',
    );
    await press('Continue');
    expect(screen.getByText('Nice to meet you, Asha!')).toBeTruthy();
    await press('Student');
    await press('Continue');
    await press('UPSC / State PSC');
    await press('Continue');
    await press('I forget things I just heard, even names');
    await press('Continue');
    expect(screen.getByText(/never fully landed/)).toBeTruthy();
    expect(screen.getByText(/not a medical treatment/)).toBeTruthy();
    await press('That makes sense');
    await press('18–24');
    await press('Continue');
    await press('More'); // 4 -> 5
    await press('More'); // 5 -> 6
    await press('Continue');
    // 6 h/day, age band midpoint 21 -> 59 years ahead -> 14.75 -> "15 years"
    expect(screen.getByText('15 years')).toBeTruthy();
    expect(screen.getByText(/not a prediction/)).toBeTruthy();
    await press('I want that time back');
    await press('Study');
    await press('Continue');
    expect(screen.getByText(/For UPSC \/ State PSC prep/)).toBeTruthy();
    await press('45 min');
    await press('Continue');
    await press('Not now');
    await press('Continue');
    await fireEvent(
      screen.getByLabelText('Hold to commit'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'activate' } },
    );
    expect(await screen.findByText("You're all set, Asha! 🎉")).toBeTruthy();
    await fireEvent.press(await screen.findByLabelText("Let's begin"));

    expect(await screen.findByText(/^(Good \w+|Still up), Asha\.$/)).toBeTruthy();
    const saved = await stored();
    expect(saved.profile).toMatchObject({
      name: 'Asha',
      role: 'student',
      exam: 'upsc',
      ageBand: '18-24',
      struggles: ['forgetting'],
      dailyScreenHours: 6,
    });
    expect(typeof saved.profile.pledgedAt).toBe('string');
    expect(saved.focusMinutes).toBe(45);
    expect(saved.priorities).toEqual(['study']);
    expect(saved.consents).toHaveLength(1);
    expect(saved.consents[0].granted).toBe(false);
  });

  it('does not ask a working person about exams', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Skip'));
    await press('Working');
    await press('Continue');
    expect(screen.getByText('Be honest. No judgement here.')).toBeTruthy();
    expect(screen.queryByText('What are you working towards?')).toBeNull();
  });

  it('resumes at the saved step after a restart, and Back goes to the previous step', async () => {
    await seed({
      profile: { ...DEFAULT_SETTINGS.profile, name: 'Ravi' },
      onboarding: { completed: false, step: 'age' },
    });
    await render(<App />);
    expect(await screen.findByText('Quick one: how old are you?')).toBeTruthy();
    await press('Back');
    expect(
      screen.getByText(
        "Here's something most people don't realise about scrolling.",
      ),
    ).toBeTruthy();
  });
});
