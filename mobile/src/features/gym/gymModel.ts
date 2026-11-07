/**
 * Attention Gym: pure logic for drills, grading, the daily workout, the garden,
 * weekly rhythm and personal progress. No IQ, no diagnosis, no punishment.
 *
 * Grading never trusts the UI: answers are checked here against trusted content.
 */
import { FACES, NAMES } from './content/people';
import { PASSAGES } from './content/passages';
import { REASONING, ReasoningItem, ReasoningSkill } from './content/reasoning';

// ---------- Randomness (deterministic, seedable) ----------
/* eslint-disable no-bitwise -- FNV-1a hash and mulberry32 PRNG need bit operations */

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* eslint-enable no-bitwise */

export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Presents options in a seeded order. `order[k]` is the original index shown at position k. */
export function presentOrder(n: number, seed: string): number[] {
  return shuffle(
    Array.from({ length: n }, (_, i) => i),
    rng(hashString(seed)),
  );
}

// ---------- Drills ----------

export type DrillKind = 'reason' | 'read' | 'names' | 'remember' | 'steady';

export const DRILLS: Record<
  DrillKind,
  { title: string; trains: string; minutes: number; icon: string }
> = {
  reason: {
    title: 'Think it through',
    trains: 'Critical thinking',
    minutes: 1,
    icon: '🧩',
  },
  read: {
    title: 'Deep read',
    trains: 'Reading stamina',
    minutes: 2,
    icon: '📖',
  },
  names: {
    title: 'Names & faces',
    trains: 'Remembering people',
    minutes: 1,
    icon: '🙂',
  },
  remember: {
    title: 'Remember to remember',
    trains: 'Remembering plans',
    minutes: 1,
    icon: '🍋',
  },
  steady: {
    title: 'Steady eye',
    trains: 'Sustained focus',
    minutes: 1,
    icon: '🎯',
  },
};

/** Timing knobs. Tests shrink `scale` so drills run instantly. */
export const gymTiming = { scale: 1 };
export const ms = (n: number) => Math.round(n * gymTiming.scale);

// ---------- Attempts and state ----------

export type Attempt = {
  id: string;
  drill: DrillKind;
  /** Local YYYY-MM-DD. */
  date: string;
  at: number;
  /** 0..1, computed by the grader. */
  score: number;
  correct: number;
  total: number;
  durationMs: number;
  /** Item/skill details for progress and review. */
  detail: Record<string, string | number | boolean>;
  sync: 'pending' | 'synced';
};

export type WorkoutDay = {
  date: string;
  plan: DrillKind[];
  done: DrillKind[];
  completedAt: number | null;
};

export type GymState = {
  version: 1;
  attempts: Attempt[];
  workouts: Record<string, WorkoutDay>;
};

export const EMPTY_GYM: GymState = { version: 1, attempts: [], workouts: {} };
export const ATTEMPT_LIMIT = 2000;

// ---------- Daily workout ----------

const ROTATION: [DrillKind, DrillKind][] = [
  ['read', 'names'],
  ['steady', 'remember'],
  ['names', 'read'],
  ['remember', 'steady'],
];

/** Three short drills, always including a reasoning puzzle. Varies by day. */
export function planFor(date: string): DrillKind[] {
  const pair = ROTATION[hashString(date) % ROTATION.length];
  return ['reason', ...pair];
}

export function workoutFor(state: GymState, date: string): WorkoutDay {
  return (
    state.workouts[date] ?? {
      date,
      plan: planFor(date),
      done: [],
      completedAt: null,
    }
  );
}

export function nextDrill(w: WorkoutDay): DrillKind | null {
  return w.plan.find(d => !w.done.includes(d)) ?? null;
}

export type GymAction =
  | { type: 'hydrate'; state: GymState }
  | { type: 'record'; attempt: Attempt; workoutDate: string | null };

export function gymReducer(state: GymState, action: GymAction): GymState {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'record': {
      if (state.attempts.some(a => a.id === action.attempt.id)) {
        return state; // saved once
      }
      const attempts = [...state.attempts, action.attempt].slice(
        -ATTEMPT_LIMIT,
      );
      if (!action.workoutDate) {
        return { ...state, attempts };
      }
      const w = workoutFor(state, action.workoutDate);
      if (!w.plan.includes(action.attempt.drill) || w.completedAt) {
        return { ...state, attempts };
      }
      const done = w.done.includes(action.attempt.drill)
        ? w.done
        : [...w.done, action.attempt.drill];
      const complete = w.plan.every(d => done.includes(d));
      return {
        ...state,
        attempts,
        workouts: {
          ...state.workouts,
          [w.date]: {
            ...w,
            done,
            completedAt: complete ? action.attempt.at : null,
          },
        },
      };
    }
  }
}

// ---------- Garden & rhythm ----------

export const FLOWER_COLORS = [
  '#F26A3D',
  '#F5A99A',
  '#FFD66B',
  '#A9D3EE',
  '#B9A5F0',
  '#7FC795',
];

/** One flower per completed daily workout. Flowers are never removed. */
export function garden(state: GymState): { date: string; color: string }[] {
  return Object.values(state.workouts)
    .filter(w => w.completedAt !== null)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(w => ({
      date: w.date,
      color: FLOWER_COLORS[hashString(w.date) % FLOWER_COLORS.length],
    }));
}

/** Which of the given 7 dates had a completed workout. Missed days are just empty; nothing is lost. */
export function weekRhythm(state: GymState, dates: string[]): boolean[] {
  return dates.map(d => !!state.workouts[d]?.completedAt);
}

// ---------- Progress ----------

export type DrillStats = {
  attempts: number;
  best: number | null;
  recent: number | null; // average of last 5
  first: number | null; // average of first 5
};

export function drillStats(state: GymState, drill: DrillKind): DrillStats {
  const list = state.attempts.filter(a => a.drill === drill);
  if (list.length === 0) {
    return { attempts: 0, best: null, recent: null, first: null };
  }
  const avg = (xs: Attempt[]) =>
    xs.reduce((n, a) => n + a.score, 0) / xs.length;
  return {
    attempts: list.length,
    best: Math.max(...list.map(a => a.score)),
    recent: avg(list.slice(-5)),
    first: avg(list.slice(0, 5)),
  };
}

export function skillAccuracy(
  state: GymState,
): Partial<Record<ReasoningSkill, { correct: number; total: number }>> {
  const out: Partial<
    Record<ReasoningSkill, { correct: number; total: number }>
  > = {};
  for (const a of state.attempts) {
    if (a.drill !== 'reason') {
      continue;
    }
    const skill = a.detail.skill as ReasoningSkill;
    const s = (out[skill] ??= { correct: 0, total: 0 });
    s.total += 1;
    s.correct += a.correct;
  }
  return out;
}

// ---------- Reasoning ----------

export function reasoningById(id: string): ReasoningItem | undefined {
  return REASONING.find(r => r.id === id);
}

/** Picks a puzzle not seen recently, leaning towards the weakest skill. Deterministic per seed. */
export function pickReasoning(state: GymState, seed: string): ReasoningItem {
  const seen = new Set(
    state.attempts
      .filter(a => a.drill === 'reason')
      .slice(-25)
      .map(a => String(a.detail.itemId)),
  );
  let pool = REASONING.filter(r => !seen.has(r.id));
  if (pool.length === 0) {
    pool = REASONING;
  }
  const acc = skillAccuracy(state);
  const weakness = (s: ReasoningSkill) => {
    const v = acc[s];
    return v && v.total > 0 ? v.correct / v.total : 0.5;
  };
  const rand = rng(hashString(seed));
  const sorted = shuffle(pool, rand).sort(
    (a, b) => weakness(a.skill) - weakness(b.skill),
  );
  // Choose among the 4 weakest-skill candidates so it doesn't feel repetitive.
  return sorted[Math.floor(rand() * Math.min(4, sorted.length))];
}

export function gradeReasoning(itemId: string, chosenOriginal: number) {
  const item = reasoningById(itemId);
  if (!item) {
    throw new Error(`Unknown exercise ${itemId}`);
  }
  const correct = chosenOriginal === item.answer;
  return { correct, item };
}

// ---------- Reading ----------

export function pickPassage(state: GymState, seed: string) {
  const recent = new Set(
    state.attempts
      .filter(a => a.drill === 'read')
      .slice(-(PASSAGES.length - 1))
      .map(a => String(a.detail.passageId)),
  );
  const pool = PASSAGES.filter(p => !recent.has(p.id));
  const list = pool.length ? pool : PASSAGES;
  return list[hashString(seed) % list.length];
}

export function gradeReading(passageId: string, chosen: number[]) {
  const p = PASSAGES.find(x => x.id === passageId);
  if (!p) {
    throw new Error(`Unknown passage ${passageId}`);
  }
  const correct = p.questions.filter((q, i) => chosen[i] === q.answer).length;
  return { correct, total: p.questions.length };
}

// ---------- Names & faces ----------

export type NamesRound = {
  people: { face: string; name: string }[];
  /** For each quiz question: the face and 4 name options (one correct). */
  quiz: { face: string; answer: string; options: string[] }[];
};

/** Adaptive size: 3 people to start, up to 6 as you get better. */
export function namesLevel(state: GymState): number {
  const last = state.attempts.filter(a => a.drill === 'names').slice(-3);
  let level = 3;
  for (const a of last) {
    const size = Number(a.detail.size) || 3;
    if (a.score >= 0.8) {
      level = Math.min(6, size + 1);
    } else if (a.score < 0.5) {
      level = Math.max(3, size - 1);
    } else {
      level = size;
    }
  }
  return level;
}

export function makeNamesRound(size: number, seed: string): NamesRound {
  const rand = rng(hashString(seed));
  const faces = shuffle(FACES, rand).slice(0, size);
  const names = shuffle(NAMES, rand).slice(0, size);
  const people = faces.map((face, i) => ({ face, name: names[i] }));
  const quiz = shuffle(people, rand).map(p => {
    const others = shuffle(
      NAMES.filter(n => n !== p.name),
      rand,
    ).slice(0, 3);
    return {
      face: p.face,
      answer: p.name,
      options: shuffle([p.name, ...others], rand),
    };
  });
  return { people, quiz };
}

export function gradeNames(round: NamesRound, chosen: string[]) {
  const correct = round.quiz.filter((q, i) => chosen[i] === q.answer).length;
  return { correct, total: round.quiz.length };
}

// ---------- Remember to remember (prospective memory) ----------

const LIVING = [
  'tiger',
  'rose',
  'sparrow',
  'oak',
  'dolphin',
  'fern',
  'ant',
  'cactus',
  'horse',
  'moss',
];
const NONLIVING = [
  'spoon',
  'bridge',
  'pencil',
  'cloud',
  'rock',
  'ladder',
  'coin',
  'kite',
  'brick',
  'chair',
];
const FOOD = ['mango', 'bread', 'rice', 'banana', 'cheese', 'samosa'];

export type RememberItem = {
  word: string;
  kind: 'living' | 'nonliving' | 'food';
};

/** 14 sorting words with 2 food words hidden after the first few. Food words are the cue to tap "Remember!". */
export function makeRememberRound(seed: string): RememberItem[] {
  const rand = rng(hashString(seed));
  const base: RememberItem[] = shuffle(
    [
      ...shuffle(LIVING, rand)
        .slice(0, 6)
        .map(w => ({ word: w, kind: 'living' as const })),
      ...shuffle(NONLIVING, rand)
        .slice(0, 6)
        .map(w => ({ word: w, kind: 'nonliving' as const })),
    ],
    rand,
  );
  const foods = shuffle(FOOD, rand).slice(0, 2);
  // Never in the first 3 words, never next to each other.
  const p1 = 3 + Math.floor(rand() * 4); // 3..6
  const p2 = p1 + 3 + Math.floor(rand() * 3); // p1+3..p1+5
  const out = [...base];
  out.splice(p1, 0, { word: foods[0], kind: 'food' });
  out.splice(Math.min(p2, out.length), 0, { word: foods[1], kind: 'food' });
  return out;
}

export type RememberResponse = 'living' | 'nonliving' | 'remember' | null;

export function gradeRemember(
  items: RememberItem[],
  responses: RememberResponse[],
) {
  let sortCorrect = 0;
  let sortTotal = 0;
  let cueHits = 0;
  let cueTotal = 0;
  items.forEach((it, i) => {
    const r = responses[i] ?? null;
    if (it.kind === 'food') {
      cueTotal += 1;
      if (r === 'remember') {
        cueHits += 1;
      }
    } else {
      sortTotal += 1;
      if (r === it.kind) {
        sortCorrect += 1;
      }
    }
  });
  const score =
    0.5 * (sortTotal ? sortCorrect / sortTotal : 0) +
    0.5 * (cueTotal ? cueHits / cueTotal : 0);
  return { score, sortCorrect, sortTotal, cueHits, cueTotal };
}

// ---------- Steady eye (sustained attention, go/no-go) ----------

export const STEADY_TARGET = 3;

/** 36 digits 1-9; about 1 in 9 is the "don't tap" digit 3. */
export function makeSteadyRound(seed: string, length = 36): number[] {
  const rand = rng(hashString(seed));
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    out.push(1 + Math.floor(rand() * 9));
  }
  // Guarantee a few targets, not in the first two.
  for (const i of [5, 14, 23, 31]) {
    if (i < length) {
      out[i] = STEADY_TARGET;
    }
  }
  return out;
}

export function gradeSteady(digits: number[], tapped: boolean[]) {
  let hits = 0;
  let goTotal = 0;
  let holds = 0;
  let noGoTotal = 0;
  digits.forEach((d, i) => {
    if (d === STEADY_TARGET) {
      noGoTotal += 1;
      if (!tapped[i]) {
        holds += 1;
      }
    } else {
      goTotal += 1;
      if (tapped[i]) {
        hits += 1;
      }
    }
  });
  const correct = hits + holds;
  const total = digits.length;
  return {
    score: total ? correct / total : 0,
    correct,
    total,
    hits,
    goTotal,
    holds,
    noGoTotal,
  };
}

// ---------- Storage ----------

export function sanitizeGym(raw: unknown): GymState {
  if (typeof raw !== 'object' || raw === null) {
    return EMPTY_GYM;
  }
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) {
    return EMPTY_GYM;
  }
  const kinds = Object.keys(DRILLS);
  const attempts = Array.isArray(r.attempts)
    ? (r.attempts.filter(
        a =>
          typeof a === 'object' &&
          a !== null &&
          typeof (a as Attempt).id === 'string' &&
          kinds.includes((a as Attempt).drill) &&
          typeof (a as Attempt).score === 'number' &&
          typeof (a as Attempt).date === 'string',
      ) as Attempt[])
    : [];
  const workouts: Record<string, WorkoutDay> = {};
  if (typeof r.workouts === 'object' && r.workouts !== null) {
    for (const [k, v] of Object.entries(
      r.workouts as Record<string, unknown>,
    )) {
      const w = v as WorkoutDay;
      if (
        w &&
        typeof w.date === 'string' &&
        Array.isArray(w.plan) &&
        Array.isArray(w.done)
      ) {
        workouts[k] = {
          date: w.date,
          plan: w.plan.filter(d => kinds.includes(d)),
          done: w.done.filter(d => kinds.includes(d)),
          completedAt: typeof w.completedAt === 'number' ? w.completedAt : null,
        };
      }
    }
  }
  return { version: 1, attempts: attempts.slice(-ATTEMPT_LIMIT), workouts };
}
