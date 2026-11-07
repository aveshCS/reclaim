import {
  EMPTY_FOCUS,
  elapsedMs,
  FocusAction,
  focusReducer,
  FocusState,
  growthFor,
  isDue,
  minutesOnDay,
  remainingMs,
  sanitizeFocus,
} from '../src/features/focus/focusModel';

const MIN = 60_000;
const T0 = 1_800_000_000_000;
const run = (s: FocusState, ...a: FocusAction[]) => a.reduce(focusReducer, s);
const start = (minutes = 25, now = T0): FocusAction => ({
  type: 'start',
  id: 's1',
  minutes,
  intention: '  Chapter 4  ',
  now,
});

describe('focus timing', () => {
  it('uses timestamps, so time passes while the app is closed', () => {
    const s = run(EMPTY_FOCUS, start());
    expect(s.active?.intention).toBe('Chapter 4');
    expect(elapsedMs(s.active!, T0 + 10 * MIN)).toBe(10 * MIN);
    expect(remainingMs(s.active!, T0 + 10 * MIN)).toBe(15 * MIN);
  });

  it('pauses and resumes without losing or inventing time', () => {
    const s = run(
      EMPTY_FOCUS,
      start(),
      { type: 'pause', now: T0 + 5 * MIN },
      { type: 'resume', now: T0 + 20 * MIN }, // 15 min break
    );
    expect(elapsedMs(s.active!, T0 + 25 * MIN)).toBe(10 * MIN);
    expect(s.active!.pauses).toBe(1);
    // While paused, time does not move.
    const paused = run(s, { type: 'pause', now: T0 + 25 * MIN });
    expect(elapsedMs(paused.active!, T0 + 99 * MIN)).toBe(10 * MIN);
  });

  it('ignores the clock jumping backwards instead of subtracting time', () => {
    const s = run(EMPTY_FOCUS, start());
    expect(elapsedMs(s.active!, T0 - 5 * MIN)).toBe(0);
  });

  it('never reports more than planned and knows when it is due', () => {
    const s = run(EMPTY_FOCUS, start(25));
    expect(isDue(s.active!, T0 + 24 * MIN)).toBe(false);
    expect(isDue(s.active!, T0 + 40 * MIN)).toBe(true);
    expect(elapsedMs(s.active!, T0 + 40 * MIN)).toBe(25 * MIN);
  });

  it('clamps session length to 5..180 minutes', () => {
    expect(run(EMPTY_FOCUS, start(1)).active!.plannedMs).toBe(5 * MIN);
    expect(run(EMPTY_FOCUS, start(999)).active!.plannedMs).toBe(180 * MIN);
  });

  it('allows only one session at a time', () => {
    const s = run(EMPTY_FOCUS, start(25), {
      ...start(45),
      id: 's2',
    } as FocusAction);
    expect(s.active!.id).toBe('s1');
  });
});

describe('finishing and saving', () => {
  it('a completed session ends at its planned end, even if noticed later', () => {
    const s = run(EMPTY_FOCUS, start(25), {
      type: 'finish',
      now: T0 + 3 * 60 * MIN, // noticed 3 hours later
      early: false,
    });
    expect(s.active).toBeNull();
    expect(s.history).toHaveLength(1);
    expect(s.history[0]).toMatchObject({
      status: 'completed',
      actualMs: 25 * MIN,
      endedAt: T0 + 25 * MIN,
      sync: 'pending',
      reflection: null,
    });
  });

  it('ending early saves the real minutes', () => {
    const s = run(EMPTY_FOCUS, start(25), {
      type: 'finish',
      now: T0 + 12 * MIN,
      early: true,
    });
    expect(s.history[0]).toMatchObject({
      status: 'ended_early',
      actualMs: 12 * MIN,
    });
  });

  it('does not save sessions under a minute', () => {
    const s = run(EMPTY_FOCUS, start(), {
      type: 'finish',
      now: T0 + 30_000,
      early: true,
    });
    expect(s.active).toBeNull();
    expect(s.history).toHaveLength(0);
  });

  it('saves a session exactly once, even if finish is sent twice', () => {
    const fin: FocusAction = {
      type: 'finish',
      now: T0 + 30 * MIN,
      early: false,
    };
    const s = run(EMPTY_FOCUS, start(), fin, fin);
    expect(s.history).toHaveLength(1);
    // And a stale active copy of the same id cannot be saved again.
    const replay = run(
      { ...s, active: { ...run(EMPTY_FOCUS, start()).active! } },
      fin,
    );
    expect(replay.history).toHaveLength(1);
  });

  it('keeps only the first reflection', () => {
    const s = run(
      EMPTY_FOCUS,
      start(),
      { type: 'finish', now: T0 + 30 * MIN, early: false },
      {
        type: 'reflect',
        id: 's1',
        reflection: { progress: 'yes', interruptions: 'few', note: '  good  ' },
      },
      {
        type: 'reflect',
        id: 's1',
        reflection: { progress: 'no', interruptions: 'many' },
      },
    );
    expect(s.history[0].reflection).toEqual({
      progress: 'yes',
      interruptions: 'few',
      note: 'good',
    });
  });
});

describe('summaries, growth and stored data', () => {
  it('counts minutes and completed sessions per day', () => {
    const s = run(
      EMPTY_FOCUS,
      start(25),
      { type: 'finish', now: T0 + 25 * MIN, early: false },
      { ...start(25, T0 + 60 * MIN), id: 's2' } as FocusAction,
      { type: 'finish', now: T0 + 70 * MIN, early: true },
    );
    expect(minutesOnDay(s.history, T0, T0 + 24 * 60 * MIN)).toEqual({
      minutes: 35,
      completed: 1,
    });
  });

  it('grows through stages and never past fully grown', () => {
    expect(growthFor(0)).toMatchObject({
      stage: 'Seed',
      nextStage: 'Sprout',
      minutesToNext: 25,
      value: 0,
    });
    expect(growthFor(30)).toMatchObject({ stage: 'Sprout', minutesToNext: 70 });
    expect(growthFor(5000)).toMatchObject({
      stage: 'Blooming',
      nextStage: null,
      value: 1,
    });
  });

  it('sanitises stored data and keeps a valid running session', () => {
    expect(sanitizeFocus(null)).toEqual(EMPTY_FOCUS);
    expect(sanitizeFocus({ version: 2 })).toEqual(EMPTY_FOCUS);
    const s = sanitizeFocus({
      version: 1,
      active: {
        id: 'x',
        plannedMs: 25 * MIN,
        startedAt: T0,
        status: 'running',
        accumulatedMs: 0,
        resumedAt: T0,
      },
      history: [{ id: 'bad' }, 7],
    });
    expect(s.active?.id).toBe('x');
    expect(s.history).toEqual([]);
  });
});
