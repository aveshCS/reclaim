/**
 * Focus sessions as pure data + functions, so the rules are deterministic and testable.
 *
 * Timing never relies on counting interval ticks. A running session stores
 * `accumulatedMs` (time banked before the last resume) and `resumedAt` (wall-clock
 * timestamp of the last start/resume). Elapsed = accumulated + (now - resumedAt).
 * That stays correct across backgrounding, screen-off, sleep and process death.
 *
 * Clock changes: if the wall clock jumps backwards, the negative span is ignored
 * (counted as 0) instead of subtracting time. Time-zone changes don't matter
 * because timestamps are UTC epoch milliseconds.
 */

export const MIN_SESSION_MIN = 5;
export const MAX_SESSION_MIN = 180;
/** Sessions shorter than this are not saved (an accidental start, not a session). */
export const MIN_SAVED_MS = 60_000;
/** How many finished sessions we keep on the phone. */
export const HISTORY_LIMIT = 1000;

export type ActiveSession = {
  id: string;
  intention: string;
  plannedMs: number;
  startedAt: number;
  status: 'running' | 'paused';
  accumulatedMs: number;
  /** Set while running; null while paused. */
  resumedAt: number | null;
  pauses: number;
};

export type Reflection = {
  progress: 'yes' | 'some' | 'no';
  /** Self-reported. RECLAIM does not measure interruptions. */
  interruptions: 'none' | 'few' | 'many';
  note?: string;
};

export type SessionRecord = {
  id: string;
  intention: string;
  plannedMs: number;
  /** Time the session was open (running), not proof of attention. */
  actualMs: number;
  startedAt: number;
  endedAt: number;
  status: 'completed' | 'ended_early';
  pauses: number;
  reflection: Reflection | null;
  /** For the future backend: every record waits here until synced, once. */
  sync: 'pending' | 'synced';
};

export type FocusState = {
  version: 1;
  active: ActiveSession | null;
  history: SessionRecord[];
};

export const EMPTY_FOCUS: FocusState = {
  version: 1,
  active: null,
  history: [],
};

export function clampSessionMinutes(m: number): number {
  if (!Number.isFinite(m)) {
    return 25;
  }
  return Math.min(MAX_SESSION_MIN, Math.max(MIN_SESSION_MIN, Math.round(m)));
}

export function elapsedMs(s: ActiveSession, now: number): number {
  const live =
    s.status === 'running' && s.resumedAt !== null
      ? Math.max(0, now - s.resumedAt)
      : 0;
  return Math.min(s.plannedMs, s.accumulatedMs + live);
}

export function remainingMs(s: ActiveSession, now: number): number {
  return Math.max(0, s.plannedMs - elapsedMs(s, now));
}

export function isDue(s: ActiveSession, now: number): boolean {
  return remainingMs(s, now) === 0;
}

export type FocusAction =
  | { type: 'hydrate'; state: FocusState }
  | {
      type: 'start';
      id: string;
      minutes: number;
      intention: string;
      now: number;
    }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  /** Finish the active session. Idempotent: does nothing if there is no active session. */
  | { type: 'finish'; now: number; early: boolean }
  /** Attach a reflection to a saved session. Only the first reflection is kept. */
  | { type: 'reflect'; id: string; reflection: Reflection }
  /** Throw away the active session without saving (e.g. an accidental start). */
  | { type: 'discard' }
  /** Backup: these records reached the server. */
  | { type: 'markSynced'; ids: string[] }
  /** Restore: records from the backup that this phone doesn't have yet. */
  | { type: 'mergeRemote'; records: SessionRecord[] };

function cleanNote(n: string | undefined): string | undefined {
  const t = (n ?? '').trim().slice(0, 500);
  return t ? t : undefined;
}

export function focusReducer(
  state: FocusState,
  action: FocusAction,
): FocusState {
  switch (action.type) {
    case 'hydrate':
      return action.state;

    case 'start': {
      if (state.active) {
        return state; // one session at a time
      }
      return {
        ...state,
        active: {
          id: action.id,
          intention: action.intention.trim().slice(0, 140),
          plannedMs: clampSessionMinutes(action.minutes) * 60_000,
          startedAt: action.now,
          status: 'running',
          accumulatedMs: 0,
          resumedAt: action.now,
          pauses: 0,
        },
      };
    }

    case 'pause': {
      const a = state.active;
      if (!a || a.status !== 'running') {
        return state;
      }
      return {
        ...state,
        active: {
          ...a,
          status: 'paused',
          accumulatedMs: elapsedMs(a, action.now),
          resumedAt: null,
          pauses: a.pauses + 1,
        },
      };
    }

    case 'resume': {
      const a = state.active;
      if (!a || a.status !== 'paused') {
        return state;
      }
      return {
        ...state,
        active: { ...a, status: 'running', resumedAt: action.now },
      };
    }

    case 'finish': {
      const a = state.active;
      if (!a) {
        return state;
      }
      const actual = elapsedMs(a, action.now);
      const completed = !action.early || actual >= a.plannedMs;
      // If a session is "due", it ended when the planned time ran out, not when we noticed.
      const endedAt = completed
        ? Math.min(
            action.now,
            a.status === 'running' && a.resumedAt !== null
              ? a.resumedAt + (a.plannedMs - a.accumulatedMs)
              : action.now,
          )
        : action.now;
      if (actual < MIN_SAVED_MS) {
        return { ...state, active: null }; // too short to be a session
      }
      if (state.history.some(r => r.id === a.id)) {
        return { ...state, active: null }; // already saved once
      }
      const record: SessionRecord = {
        id: a.id,
        intention: a.intention,
        plannedMs: a.plannedMs,
        actualMs: completed ? a.plannedMs : actual,
        startedAt: a.startedAt,
        endedAt: Math.max(endedAt, a.startedAt),
        status: completed ? 'completed' : 'ended_early',
        pauses: a.pauses,
        reflection: null,
        sync: 'pending',
      };
      return {
        ...state,
        active: null,
        history: [...state.history, record].slice(-HISTORY_LIMIT),
      };
    }

    case 'reflect': {
      let changed = false;
      const history = state.history.map(r => {
        if (r.id !== action.id || r.reflection) {
          return r;
        }
        changed = true;
        return {
          ...r,
          sync: 'pending' as const, // send again with the reflection
          reflection: {
            progress: action.reflection.progress,
            interruptions: action.reflection.interruptions,
            note: cleanNote(action.reflection.note),
          },
        };
      });
      return changed ? { ...state, history } : state;
    }

    case 'discard':
      return { ...state, active: null };

    case 'markSynced': {
      const ids = new Set(action.ids);
      let changed = false;
      const history = state.history.map(r => {
        if (!ids.has(r.id) || r.sync === 'synced') {
          return r;
        }
        changed = true;
        return { ...r, sync: 'synced' as const };
      });
      return changed ? { ...state, history } : state;
    }

    case 'mergeRemote': {
      const byId = new Map(state.history.map(r => [r.id, r]));
      let changed = false;
      for (const remote of action.records) {
        const mine = byId.get(remote.id);
        if (!mine) {
          byId.set(remote.id, { ...remote, sync: 'synced' });
          changed = true;
        } else if (!mine.reflection && remote.reflection) {
          byId.set(remote.id, { ...mine, reflection: remote.reflection });
          changed = true;
        }
      }
      if (!changed) {
        return state;
      }
      const history = [...byId.values()]
        .sort((a, b) => a.startedAt - b.startedAt)
        .slice(-HISTORY_LIMIT);
      return { ...state, history };
    }
  }
}

/** Minutes spent in sessions (completed or ended early) on the local day of `dayStart`. */
export function minutesOnDay(
  history: SessionRecord[],
  dayStart: number,
  dayEnd: number,
): { minutes: number; completed: number } {
  let ms = 0;
  let completed = 0;
  for (const r of history) {
    if (r.endedAt >= dayStart && r.endedAt < dayEnd) {
      ms += r.actualMs;
      if (r.status === 'completed') {
        completed += 1;
      }
    }
  }
  return { minutes: Math.floor(ms / 60_000), completed };
}

export function totalMinutes(history: SessionRecord[]): number {
  return Math.floor(history.reduce((n, r) => n + r.actualMs, 0) / 60_000);
}

/** Pip's sprout grows with total focus minutes. It never shrinks. */
export const GROWTH_STAGES = [
  { minutes: 0, name: 'Seed' },
  { minutes: 25, name: 'Sprout' },
  { minutes: 100, name: 'Seedling' },
  { minutes: 250, name: 'Young plant' },
  { minutes: 500, name: 'Leafy' },
  { minutes: 1000, name: 'Blooming' },
] as const;

export type Growth = {
  /** 0..1, feeds Pip's `growth` prop. */
  value: number;
  stage: string;
  nextStage: string | null;
  minutesToNext: number | null;
  /** 0..1 progress inside the current stage. */
  stageProgress: number;
};

export function growthFor(totalMin: number): Growth {
  const m = Math.max(0, Math.floor(totalMin));
  let i = 0;
  while (i + 1 < GROWTH_STAGES.length && m >= GROWTH_STAGES[i + 1].minutes) {
    i++;
  }
  const cur = GROWTH_STAGES[i];
  const next = GROWTH_STAGES[i + 1] ?? null;
  return {
    value: i / (GROWTH_STAGES.length - 1),
    stage: cur.name,
    nextStage: next ? next.name : null,
    minutesToNext: next ? next.minutes - m : null,
    stageProgress: next ? (m - cur.minutes) / (next.minutes - cur.minutes) : 1,
  };
}

/** Defensive parse of stored focus data. Unknown or broken input becomes an empty state. */
export function sanitizeFocus(raw: unknown): FocusState {
  if (typeof raw !== 'object' || raw === null) {
    return EMPTY_FOCUS;
  }
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) {
    return EMPTY_FOCUS;
  }
  const num = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  let active: ActiveSession | null = null;
  const a = r.active as Record<string, unknown> | null;
  if (a && typeof a === 'object') {
    const planned = num(a.plannedMs);
    const started = num(a.startedAt);
    const acc = num(a.accumulatedMs);
    if (
      typeof a.id === 'string' &&
      planned !== null &&
      started !== null &&
      acc !== null &&
      (a.status === 'running' || a.status === 'paused')
    ) {
      active = {
        id: a.id,
        intention: typeof a.intention === 'string' ? a.intention : '',
        plannedMs: planned,
        startedAt: started,
        status: a.status,
        accumulatedMs: Math.max(0, acc),
        resumedAt: a.status === 'running' ? num(a.resumedAt) ?? started : null,
        pauses: num(a.pauses) ?? 0,
      };
    }
  }
  const history = Array.isArray(r.history)
    ? (r.history.filter(
        (h): h is SessionRecord =>
          typeof h === 'object' &&
          h !== null &&
          typeof (h as SessionRecord).id === 'string' &&
          typeof (h as SessionRecord).actualMs === 'number' &&
          typeof (h as SessionRecord).endedAt === 'number' &&
          ((h as SessionRecord).status === 'completed' ||
            (h as SessionRecord).status === 'ended_early'),
      ) as SessionRecord[])
    : [];
  return { version: 1, active, history: history.slice(-HISTORY_LIMIT) };
}
