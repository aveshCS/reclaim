import {
  Attempt,
  drillStats,
  EMPTY_GYM,
  garden,
  GymState,
  gradeNames,
  gradeReading,
  gradeReasoning,
  gradeRemember,
  gradeSteady,
  gymReducer,
  makeNamesRound,
  makeRememberRound,
  makeSteadyRound,
  namesLevel,
  pickReasoning,
  planFor,
  presentOrder,
  sanitizeGym,
  STEADY_TARGET,
  weekRhythm,
  workoutFor,
} from '../src/features/gym/gymModel';
import { REASONING } from '../src/features/gym/content/reasoning';
import { PASSAGES } from '../src/features/gym/content/passages';

let n = 0;
const attempt = (p: Partial<Attempt>): Attempt => ({
  id: `a${n++}`,
  drill: 'reason',
  date: '2026-11-07',
  at: 1000 + n,
  score: 1,
  correct: 1,
  total: 1,
  durationMs: 1000,
  detail: {},
  sync: 'pending',
  ...p,
});
const rec = (s: GymState, a: Attempt, inWorkout = true) =>
  gymReducer(s, {
    type: 'record',
    attempt: a,
    workoutDate: inWorkout ? a.date : null,
  });

describe('option order', () => {
  it('is a deterministic permutation, so the right answer is not always first', () => {
    const o1 = presentOrder(4, 'seed-x');
    expect(o1).toEqual(presentOrder(4, 'seed-x'));
    expect([...o1].sort()).toEqual([0, 1, 2, 3]);
    const firsts = new Set(
      Array.from({ length: 40 }, (_, i) => presentOrder(4, `s${i}`)[0]),
    );
    expect(firsts.size).toBe(4);
  });
});

describe('grading uses trusted content', () => {
  it('grades reasoning by the stored answer key', () => {
    const item = REASONING[0];
    expect(gradeReasoning(item.id, item.answer).correct).toBe(true);
    expect(gradeReasoning(item.id, (item.answer + 1) % 4).correct).toBe(false);
    expect(() => gradeReasoning('nope', 0)).toThrow();
  });

  it('grades reading answers', () => {
    const p = PASSAGES[0];
    expect(
      gradeReading(
        p.id,
        p.questions.map(q => q.answer),
      ),
    ).toEqual({
      correct: 3,
      total: 3,
    });
    expect(gradeReading(p.id, [-1, -1, -1]).correct).toBe(0);
  });
});

describe('daily workout, garden and rhythm', () => {
  it('always has 3 drills including a reasoning puzzle, and varies by day', () => {
    const plans = [
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
    ].map(planFor);
    plans.forEach(p => {
      expect(p).toHaveLength(3);
      expect(p[0]).toBe('reason');
      expect(new Set(p).size).toBe(3);
    });
    expect(new Set(plans.map(p => p.join())).size).toBeGreaterThan(1);
  });

  it('completes the workout when every planned drill is done, once', () => {
    const date = '2026-11-07';
    const plan = planFor(date);
    let s = EMPTY_GYM;
    plan.slice(0, 2).forEach(d => {
      s = rec(s, attempt({ drill: d, date }));
    });
    expect(workoutFor(s, date).completedAt).toBeNull();
    const last = attempt({ drill: plan[2], date, at: 5000 });
    s = rec(s, last);
    expect(workoutFor(s, date).completedAt).toBe(5000);
    // The same attempt is not stored twice.
    expect(rec(s, last).attempts).toHaveLength(3);
    expect(garden(s)).toHaveLength(1);
  });

  it('free practice does not count towards the workout', () => {
    const s = rec(EMPTY_GYM, attempt({ drill: 'reason' }), false);
    expect(workoutFor(s, '2026-11-07').done).toEqual([]);
    expect(s.attempts).toHaveLength(1);
  });

  it('shows missed days as empty without taking anything away', () => {
    let s = EMPTY_GYM;
    for (const date of ['2026-11-01', '2026-11-03']) {
      for (const d of planFor(date)) {
        s = rec(s, attempt({ drill: d, date }));
      }
    }
    expect(weekRhythm(s, ['2026-11-01', '2026-11-02', '2026-11-03'])).toEqual([
      true,
      false,
      true,
    ]);
    expect(garden(s)).toHaveLength(2);
  });
});

describe('drill generators and scoring', () => {
  it('builds name rounds and grades them', () => {
    const r = makeNamesRound(4, 'x');
    expect(r.people).toHaveLength(4);
    expect(r.quiz).toHaveLength(4);
    r.quiz.forEach(q => {
      expect(q.options).toHaveLength(4);
      expect(q.options).toContain(q.answer);
    });
    expect(
      gradeNames(
        r,
        r.quiz.map(q => q.answer),
      ).correct,
    ).toBe(4);
  });

  it('adapts the number of people to recent results', () => {
    let s: GymState = EMPTY_GYM;
    expect(namesLevel(s)).toBe(3);
    s = rec(
      s,
      attempt({ drill: 'names', score: 1, detail: { size: 3 } }),
      false,
    );
    expect(namesLevel(s)).toBe(4);
    s = rec(
      s,
      attempt({ drill: 'names', score: 0.25, detail: { size: 4 } }),
      false,
    );
    expect(namesLevel(s)).toBe(3);
  });

  it('hides exactly two food cues, never at the start', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const items = makeRememberRound(seed);
      const idx = items
        .map((it, i) => (it.kind === 'food' ? i : -1))
        .filter(i => i >= 0);
      expect(idx).toHaveLength(2);
      expect(idx[0]).toBeGreaterThanOrEqual(3);
      expect(idx[1] - idx[0]).toBeGreaterThanOrEqual(2);
    }
  });

  it('scores remembering and sorting separately', () => {
    const items = makeRememberRound('z');
    const perfect = items.map(it =>
      it.kind === 'food' ? ('remember' as const) : it.kind,
    );
    expect(gradeRemember(items, perfect).score).toBe(1);
    const forgot = items.map(it =>
      it.kind === 'food' ? ('living' as const) : it.kind,
    );
    const g = gradeRemember(items, forgot);
    expect(g.cueHits).toBe(0);
    expect(g.score).toBe(0.5);
  });

  it('scores the steady drill as taps on others plus holds on the target', () => {
    const digits = makeSteadyRound('q');
    expect(
      digits.filter(d => d === STEADY_TARGET).length,
    ).toBeGreaterThanOrEqual(4);
    const perfect = digits.map(d => d !== STEADY_TARGET);
    expect(gradeSteady(digits, perfect).score).toBe(1);
    const tapAll = digits.map(() => true);
    const g = gradeSteady(digits, tapAll);
    expect(g.holds).toBe(0);
    expect(g.score).toBeLessThan(1);
  });
});

describe('scheduling and progress', () => {
  it('does not repeat a recently seen reasoning puzzle', () => {
    let s = EMPTY_GYM;
    const first = pickReasoning(s, 'day1');
    expect(pickReasoning(s, 'day1').id).toBe(first.id); // deterministic
    s = rec(
      s,
      attempt({
        drill: 'reason',
        detail: { itemId: first.id, skill: first.skill },
      }),
      false,
    );
    for (let i = 0; i < 10; i++) {
      expect(pickReasoning(s, `day1-${i}`).id).not.toBe(first.id);
    }
  });

  it('compares first and recent attempts against yourself', () => {
    let s = EMPTY_GYM;
    [0.4, 0.4, 0.4, 0.4, 0.4, 0.9, 0.9, 0.9, 0.9, 0.9].forEach(score => {
      s = rec(s, attempt({ drill: 'steady', score }), false);
    });
    const st = drillStats(s, 'steady');
    expect(st.attempts).toBe(10);
    expect(st.first).toBeCloseTo(0.4);
    expect(st.recent).toBeCloseTo(0.9);
    expect(st.best).toBe(0.9);
  });

  it('sanitises stored data', () => {
    expect(sanitizeGym(null)).toEqual(EMPTY_GYM);
    const s = sanitizeGym({
      version: 1,
      attempts: [attempt({}), { id: 'x', drill: 'hack' }],
      workouts: {
        d: { date: 'd', plan: ['reason', 'bad'], done: [], completedAt: 'x' },
      },
    });
    expect(s.attempts).toHaveLength(1);
    expect(s.workouts.d.plan).toEqual(['reason']);
    expect(s.workouts.d.completedAt).toBeNull();
  });
});
