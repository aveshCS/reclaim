import { DEEPER } from '../src/features/gym/content/deeper';
import {
  Attempt,
  dueRecall,
  EMPTY_GYM,
  gradeDeeper,
  GymState,
  gymReducer,
  workoutFor,
} from '../src/features/gym/gymModel';

let n = 0;
const att = (p: Partial<Attempt>): Attempt => ({
  id: `x${n++}`,
  drill: 'read',
  date: '2026-11-01',
  at: n,
  score: 1,
  correct: 3,
  total: 3,
  durationMs: 1,
  detail: {},
  sync: 'pending',
  ...p,
});
const add = (s: GymState, a: Attempt) =>
  gymReducer(s, { type: 'record', attempt: a, workoutDate: null });

describe('Question it content', () => {
  it('has at least 12 well-formed claims', () => {
    expect(DEEPER.length).toBeGreaterThanOrEqual(12);
    expect(new Set(DEEPER.map(d => d.id)).size).toBe(DEEPER.length);
    for (const d of DEEPER) {
      expect(d.probes.length).toBeGreaterThanOrEqual(3);
      expect(d.verdicts.length).toBeGreaterThanOrEqual(3);
      expect(d.probes[d.bestProbe]).toBeTruthy();
      expect(d.verdicts[d.bestVerdict]).toBeTruthy();
      expect(new Set(d.probes).size).toBe(d.probes.length);
      expect(d.probeWhy.length).toBeGreaterThan(40);
      expect(d.takeaway.length).toBeGreaterThan(30);
      expect(`${d.probeWhy} ${d.takeaway}`.toLowerCase()).not.toMatch(
        /adhd|diagnos|disorder/,
      );
    }
  });

  it('grades the question and the verdict separately', () => {
    const d = DEEPER[0];
    expect(gradeDeeper(d.id, d.bestProbe, d.bestVerdict).correct).toBe(2);
    const half = gradeDeeper(d.id, (d.bestProbe + 1) % 3, d.bestVerdict);
    expect(half).toMatchObject({ probeOk: false, verdictOk: true, correct: 1 });
  });
});

describe('spaced recall', () => {
  const read = add(
    EMPTY_GYM,
    att({ drill: 'read', date: '2026-11-01', detail: { passageId: 'rd-02' } }),
  );

  it('nothing is due on the day you read', () => {
    expect(dueRecall(read, '2026-11-01')).toBeNull();
  });

  it('is due 1 day later, then 3+ days later, then done', () => {
    expect(dueRecall(read, '2026-11-02')).toMatchObject({
      kind: 'passage',
      passageId: 'rd-02',
      stage: 1,
    });
    const s1 = add(
      read,
      att({
        drill: 'recall',
        date: '2026-11-02',
        detail: { passageId: 'rd-02', stage: 1 },
      }),
    );
    expect(dueRecall(s1, '2026-11-02')).toBeNull(); // one per day
    expect(dueRecall(s1, '2026-11-03')).toBeNull(); // stage 2 needs 3 days
    expect(dueRecall(s1, '2026-11-04')).toMatchObject({ stage: 3 });
    const s2 = add(
      s1,
      att({
        drill: 'recall',
        date: '2026-11-04',
        detail: { passageId: 'rd-02', stage: 3 },
      }),
    );
    expect(dueRecall(s2, '2026-11-09')).toBeNull();
  });

  it('falls back to a recent focus note, but not an old one', () => {
    const note = {
      id: 'f1',
      date: '2026-11-05',
      intention: 'Chapter 4',
      note: 'Mitochondria',
    };
    expect(dueRecall(EMPTY_GYM, '2026-11-06', [note])).toMatchObject({
      kind: 'focus',
      sessionId: 'f1',
    });
    expect(dueRecall(EMPTY_GYM, '2026-11-20', [note])).toBeNull();
    expect(dueRecall(EMPTY_GYM, '2026-11-05', [note])).toBeNull();
  });

  it('puts Recall in the workout when something is due, and the stored plan wins after', () => {
    const w = workoutFor(read, '2026-11-02');
    expect(w.plan[0]).toBe('reason');
    expect(w.plan[1]).toBe('recall');
    expect(new Set(w.plan).size).toBe(3);
    const s = gymReducer(read, {
      type: 'record',
      attempt: att({ drill: 'reason', date: '2026-11-02' }),
      workoutDate: '2026-11-02',
      plan: w.plan,
    });
    expect(s.workouts['2026-11-02'].plan).toEqual(w.plan);
  });
});
