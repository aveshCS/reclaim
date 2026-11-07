import {
  addDays,
  daysBetween,
  resetCalendar,
  resetResult,
  resetStatus,
  DAILY_TIPS,
} from '../src/features/reset/resetModel';
import {
  AppSettings,
  DEFAULT_SETTINGS,
  RESET_DAYS,
  settingsReducer,
  SettingsAction,
} from '../src/state/settings';
import { sanitizeSettings } from '../src/services/settingsStorage';

const AT = '2026-11-07T10:00:00.000Z';
const run = (s: AppSettings, ...a: SettingsAction[]) =>
  a.reduce(settingsReducer, s);

describe('reset dates', () => {
  it('counts days across months and DST safely', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
    expect(addDays('2026-10-25', 14)).toBe('2026-11-08');
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('has a tip for each of the 14 days', () => {
    expect(DAILY_TIPS).toHaveLength(RESET_DAYS);
  });
});

describe('reset challenge', () => {
  const started = run(DEFAULT_SETTINGS, {
    type: 'startReset',
    startDate: '2026-11-01',
    limitMin: 30,
  });

  it('starts with a baseline attention check', () => {
    expect(resetStatus(null, '2026-11-01')).toEqual({ kind: 'none' });
    expect(resetStatus(started.reset, '2026-11-01')).toEqual({
      kind: 'needsBaseline',
      day: 1,
    });
  });

  it('runs 14 days, then asks for the final check, then finishes', () => {
    const s = run(started, {
      type: 'setResetScore',
      which: 'baseline',
      score: 0.7,
    });
    expect(resetStatus(s.reset, '2026-11-05')).toEqual({
      kind: 'active',
      day: 5,
      daysLeft: 9,
    });
    expect(resetStatus(s.reset, '2026-11-14').kind).toBe('needsFinal');
    const done = run(
      s,
      { type: 'setResetScore', which: 'final', score: 0.85 },
      { type: 'finishReset', at: AT },
    );
    expect(resetStatus(done.reset, '2026-11-14').kind).toBe('finished');
    expect(resetResult(done.reset!)).toMatchObject({
      before: 0.7,
      after: 0.85,
      changePts: 15,
    });
  });

  it('keeps the first baseline even if checked again', () => {
    const s = run(
      started,
      { type: 'setResetScore', which: 'baseline', score: 0.6 },
      { type: 'setResetScore', which: 'baseline', score: 0.99 },
    );
    expect(s.reset!.baselineScore).toBe(0.6);
  });

  it('records kept days, toggles, and shows them on the calendar', () => {
    const s = run(
      started,
      { type: 'keepResetDay', date: '2026-11-01', kept: true },
      { type: 'keepResetDay', date: '2026-11-02', kept: true },
      { type: 'keepResetDay', date: '2026-11-02', kept: false },
      { type: 'keepResetDay', date: '2026-11-01', kept: true },
    );
    expect(s.reset!.keptDays).toEqual(['2026-11-01']);
    const cal = resetCalendar(s.reset!, '2026-11-03');
    expect(cal).toHaveLength(14);
    expect(cal[0]).toMatchObject({ day: 1, kept: true });
    expect(cal[2]).toMatchObject({ isToday: true, future: false });
    expect(cal[13].future).toBe(true);
  });

  it('allows only one active challenge and can be abandoned', () => {
    const again = run(started, {
      type: 'startReset',
      startDate: '2026-11-05',
      limitMin: 60,
    });
    expect(again.reset!.startDate).toBe('2026-11-01');
    expect(run(started, { type: 'abandonReset' }).reset).toBeNull();
  });
});

describe('pause and if-then plan settings', () => {
  it('records a separate consent each time the pause is switched on or off', () => {
    const s = run(
      DEFAULT_SETTINGS,
      { type: 'setGate', enabled: true, at: AT },
      { type: 'setGate', enabled: true, at: AT },
      { type: 'setGate', enabled: false, at: AT },
    );
    const c = s.consents.filter(x => x.purpose === 'accessibility_pause');
    expect(c.map(x => x.granted)).toEqual([true, false]);
  });

  it('clamps the open-anyway window and de-duplicates apps', () => {
    const s = run(
      DEFAULT_SETTINGS,
      { type: 'setGateMinutes', minutes: 500 },
      {
        type: 'setGateApps',
        apps: [
          { packageName: 'a', label: 'A' },
          { packageName: 'a', label: 'A2' },
        ],
      },
    );
    expect(s.gate.allowMinutes).toBe(60);
    expect(s.gate.packages).toHaveLength(1);
  });

  it('stores a trimmed plan and rejects empty halves', () => {
    expect(
      run(DEFAULT_SETTINGS, {
        type: 'setPlan',
        plan: { when: '  I feel bored ', then: ' read one page ' },
      }).plan,
    ).toEqual({ when: 'I feel bored', then: 'read one page' });
    expect(
      run(DEFAULT_SETTINGS, { type: 'setPlan', plan: { when: 'x', then: ' ' } })
        .plan,
    ).toBeNull();
  });

  it('survives storage round trips and repairs junk', () => {
    const s = sanitizeSettings({
      schemaVersion: 1,
      gate: {
        enabled: true,
        packages: [{ packageName: 'p', label: 'P' }],
        allowMinutes: 0,
      },
      plan: { when: 'a b c', then: 'd e f' },
      reset: {
        startDate: '2026-11-01',
        limitMin: 9999,
        baselineScore: 2,
        keptDays: ['2026-11-01', 'bad'],
      },
    });
    expect(s.gate).toEqual({
      enabled: true,
      packages: [{ packageName: 'p', label: 'P' }],
      allowMinutes: 1,
    });
    expect(s.plan).toEqual({ when: 'a b c', then: 'd e f' });
    expect(s.reset).toMatchObject({
      limitMin: 240,
      baselineScore: null,
      keptDays: ['2026-11-01'],
    });
    expect(
      sanitizeSettings({ schemaVersion: 1, reset: { startDate: 'x' } }).reset,
    ).toBeNull();
  });
});
