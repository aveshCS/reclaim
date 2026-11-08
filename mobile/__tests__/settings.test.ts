import {
  AppSettings,
  clampFocusMinutes,
  clampScreenHours,
  CONSENT_POLICY_VERSION,
  DEFAULT_SETTINGS,
  isMonitoringActive,
  settingsReducer,
  SettingsAction,
  visibleSteps,
} from '../src/state/settings';
import { sanitizeSettings } from '../src/services/settingsStorage';

const AT = '2026-11-07T10:00:00.000Z';
const reduce = (s: AppSettings, ...actions: SettingsAction[]) =>
  actions.reduce(settingsReducer, s);
const at = (s: AppSettings, step: AppSettings['onboarding']['step']) => ({
  ...s,
  onboarding: { ...s.onboarding, step },
});

describe('onboarding steps', () => {
  it('never moves past either end', () => {
    expect(
      reduce(DEFAULT_SETTINGS, { type: 'previousStep' }).onboarding.step,
    ).toBe('hello');
    let s = DEFAULT_SETTINGS;
    for (let i = 0; i < 30; i++) {
      s = reduce(s, { type: 'nextStep' });
    }
    expect(s.onboarding.step).toBe('ready');
  });

  it('asks about exams only for people who study', () => {
    const worker = reduce(
      at(DEFAULT_SETTINGS, 'role'),
      { type: 'setRole', role: 'working' },
      { type: 'nextStep' },
    );
    expect(worker.onboarding.step).toBe('struggles');

    const student = reduce(
      at(DEFAULT_SETTINGS, 'role'),
      { type: 'setRole', role: 'student' },
      { type: 'nextStep' },
    );
    expect(student.onboarding.step).toBe('exam');
  });

  it('skips the reality check when no screen time was given, in both directions', () => {
    const fwd = reduce(at(DEFAULT_SETTINGS, 'screenTime'), {
      type: 'nextStep',
    });
    expect(fwd.onboarding.step).toBe('priorities');
    const back = reduce(at(DEFAULT_SETTINGS, 'priorities'), {
      type: 'previousStep',
    });
    expect(back.onboarding.step).toBe('screenTime');

    const withHours = reduce(
      at(DEFAULT_SETTINGS, 'screenTime'),
      { type: 'setScreenHours', hours: 5 },
      { type: 'nextStep' },
    );
    expect(withHours.onboarding.step).toBe('reality');
  });

  it('lists only the steps this user will see', () => {
    expect(visibleSteps(DEFAULT_SETTINGS)).not.toContain('exam');
    expect(visibleSteps(DEFAULT_SETTINGS)).not.toContain('reality');
  });
});

describe('profile', () => {
  it('clears the exam when the user stops being a student', () => {
    const s = reduce(
      DEFAULT_SETTINGS,
      { type: 'setRole', role: 'student' },
      { type: 'setExam', exam: 'neet' },
      { type: 'setRole', role: 'working' },
    );
    expect(s.profile.exam).toBeNull();
  });

  it('cleans names and toggles struggles', () => {
    const s = reduce(
      DEFAULT_SETTINGS,
      { type: 'setName', name: '   Asha    Rao' },
      { type: 'toggleStruggle', struggle: 'forgetting' },
      { type: 'toggleStruggle', struggle: 'regret' },
      { type: 'toggleStruggle', struggle: 'forgetting' },
    );
    expect(s.profile.name).toBe('Asha Rao');
    expect(s.profile.struggles).toEqual(['regret']);
  });

  it('clamps screen hours and focus minutes', () => {
    expect(clampScreenHours(0)).toBe(1);
    expect(clampScreenHours(30)).toBe(16);
    expect(clampScreenHours(NaN)).toBe(4);
    expect(clampFocusMinutes(1)).toBe(5);
    expect(clampFocusMinutes(999)).toBe(180);
    expect(clampFocusMinutes(NaN)).toBe(25);
  });
});

describe('monitoring and consent', () => {
  it('starts off with no consent records', () => {
    expect(isMonitoringActive(DEFAULT_SETTINGS)).toBe(false);
    expect(DEFAULT_SETTINGS.consents).toEqual([]);
  });

  it('keeps an append-only consent history and ignores repeats', () => {
    const s = reduce(
      DEFAULT_SETTINGS,
      { type: 'setMonitoringChoice', choice: 'requested', at: AT },
      { type: 'setMonitoringChoice', choice: 'requested', at: AT },
      { type: 'setMonitoringChoice', choice: 'declined', at: AT },
    );
    expect(s.consents).toHaveLength(2);
    expect(s.consents[0]).toEqual({
      purpose: 'usage_monitoring_setup',
      policyVersion: CONSENT_POLICY_VERSION,
      granted: true,
      recordedAt: AT,
    });
    expect(s.consents[1].granted).toBe(false);
  });

  it('pauses only after opting in', () => {
    expect(
      reduce(DEFAULT_SETTINGS, { type: 'setMonitoringPaused', paused: true })
        .monitoring.paused,
    ).toBe(false);
    const paused = reduce(
      DEFAULT_SETTINGS,
      { type: 'setMonitoringChoice', choice: 'requested', at: AT },
      { type: 'setMonitoringPaused', paused: true },
    );
    expect(isMonitoringActive(paused)).toBe(false);
  });
});

describe('sanitizeSettings', () => {
  it('falls back to defaults for garbage', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ schemaVersion: 99 })).toEqual(DEFAULT_SETTINGS);
  });

  it('fills in a missing profile for data saved by older versions', () => {
    const s = sanitizeSettings({
      schemaVersion: 1,
      onboarding: { completed: true, step: 'confirm' },
      priorities: ['study'],
      focusMinutes: 40,
      monitoring: { choice: 'declined', paused: false },
      consents: [],
    });
    expect(s.profile).toEqual(DEFAULT_SETTINGS.profile);
    expect(s.onboarding).toEqual({
      completed: true,
      step: 'hello',
      protect: 'ask',
    });
    expect(s.focusMinutes).toBe(40);
  });

  it('repairs bad profile fields', () => {
    const s = sanitizeSettings({
      schemaVersion: 1,
      profile: {
        name: 42,
        role: 'working',
        exam: 'jee', // not allowed for a non-student
        ageBand: 'ancient',
        struggles: ['regret', 'regret', 'bogus'],
        dailyScreenHours: 99,
        pledgedAt: 7,
      },
    });
    expect(s.profile).toEqual({
      name: '',
      role: 'working',
      exam: null,
      ageBand: null,
      struggles: ['regret'],
      dailyScreenHours: 16,
      pledgedAt: null,
    });
  });
});

describe('tracked apps and usage access history', () => {
  const optedIn = reduce(DEFAULT_SETTINGS, {
    type: 'setMonitoringChoice',
    choice: 'requested',
    at: AT,
  });

  it('de-duplicates tracked apps, fills labels and caps the list', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      packageName: `com.app${i}`,
      label: `App ${i}`,
    }));
    const s = reduce(DEFAULT_SETTINGS, {
      type: 'setTrackedApps',
      apps: [
        { packageName: 'com.a', label: '' },
        { packageName: 'com.a', label: 'Dup' },
        ...many,
      ],
    });
    expect(s.trackedApps[0]).toEqual({ packageName: 'com.a', label: 'com.a' });
    expect(s.trackedApps).toHaveLength(30);
  });

  it('records grant and revoke changes only, and only after opting in', () => {
    const notOpted = reduce(DEFAULT_SETTINGS, {
      type: 'observeUsageAccess',
      granted: true,
      at: AT,
    });
    expect(notOpted.consents).toHaveLength(0);

    const s = reduce(
      optedIn,
      { type: 'observeUsageAccess', granted: false, at: AT }, // never granted: ignored
      { type: 'observeUsageAccess', granted: true, at: AT },
      { type: 'observeUsageAccess', granted: true, at: AT }, // no change: ignored
      { type: 'observeUsageAccess', granted: false, at: AT }, // revoked
    );
    const access = s.consents.filter(
      c => c.purpose === 'usage_access_permission',
    );
    expect(access.map(c => c.granted)).toEqual([true, false]);
  });

  it('keeps tracked apps through sanitising and drops junk', () => {
    const s = sanitizeSettings({
      schemaVersion: 1,
      trackedApps: [
        { packageName: 'com.a', label: 'A' },
        { packageName: 5 },
        'x',
      ],
    });
    expect(s.trackedApps).toEqual([{ packageName: 'com.a', label: 'A' }]);
  });
});
