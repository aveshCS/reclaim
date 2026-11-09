/**
 * Backup and restore. Plain logic: it takes a snapshot of what's on the phone, talks to
 * the server, and returns what to change locally. CloudSync.tsx wires it to the app.
 *
 * Rules
 * - Restore first: the first sync after signing in pulls the backup and merges it in
 *   (nothing on the phone is lost; history is joined by id, workout days are combined).
 *   Backed-up preferences replace this phone's, because signing in on a phone usually
 *   means "bring my stuff here".
 * - Then upload: records not yet sent, consents, changed workout days, and the backed-up
 *   preferences if they changed. Every upload is safe to repeat.
 * - Preferences edited on two phones: the server answers 409 and this phone's copy wins
 *   (the latest edit is the one in your hand).
 * - A record the server would refuse is held back on the phone instead of blocking the rest.
 */
import type { SessionRecord } from '../features/focus/focusModel';
import type { Attempt, WorkoutDay } from '../features/gym/gymModel';
import type { AppSettings, ConsentRecord } from '../state/settings';
import { ApiError } from './account';
import { BackupSettings, pickBackup } from './backupSettings';

export type SyncMeta = {
  /** The account this bookkeeping belongs to. */
  userId: string | null;
  restored: boolean;
  settingsVersion: number | null;
  /** Fingerprint of the preferences last uploaded. */
  settingsSig: string | null;
  workoutSigs: Record<string, string>;
  /** How many consent records have been uploaded. */
  consentsSent: number;
  lastSyncAt: number | null;
};

export const EMPTY_META: SyncMeta = {
  userId: null,
  restored: false,
  settingsVersion: null,
  settingsSig: null,
  workoutSigs: {},
  consentsSent: 0,
  lastSyncAt: null,
};

export type Snapshot = {
  settings: AppSettings;
  focus: SessionRecord[];
  attempts: Attempt[];
  workouts: WorkoutDay[];
};

export type Restore = {
  settings: Record<string, unknown> | null;
  focus: SessionRecord[];
  attempts: Attempt[];
  workouts: WorkoutDay[];
};

export type SyncResult = {
  meta: SyncMeta;
  restore: Restore | null;
  focusSynced: string[];
  attemptsSynced: string[];
  heldBack: number;
};

type Request = <T>(path: string, init?: RequestInit) => Promise<T>;

const BATCH = 200;
const MIN_TIME = 1_577_836_800_000; // 2020-01-01, same as the server
const MAX_TIME = 4_102_444_800_000; // 2100-01-01
const DAY_MS = 86_400_000;
const DRILL_NAMES = [
  'reason',
  'deeper',
  'read',
  'recall',
  'names',
  'remember',
  'steady',
];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const sig = (v: unknown) => JSON.stringify(v);
const int = (n: unknown, lo: number, hi: number) =>
  typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;
const inTime = (t: number) => int(t, MIN_TIME, MAX_TIME);

/** Mirrors the server's checks so one odd record can't block a whole batch. */
export function focusOk(r: SessionRecord): boolean {
  return (
    r.id.length >= 1 &&
    r.id.length <= 100 &&
    r.intention.length <= 140 &&
    int(r.plannedMs, 0, DAY_MS) &&
    int(r.actualMs, 0, DAY_MS) &&
    inTime(r.startedAt) &&
    inTime(r.endedAt) &&
    r.endedAt >= r.startedAt &&
    int(r.pauses, 0, 1000) &&
    (r.reflection === null || (r.reflection.note ?? '').length <= 500)
  );
}

export function attemptOk(a: Attempt): boolean {
  return (
    a.id.length >= 1 &&
    a.id.length <= 100 &&
    DRILL_NAMES.includes(a.drill) &&
    DAY.test(a.date) &&
    inTime(a.at) &&
    a.score >= 0 &&
    a.score <= 1 &&
    int(a.correct, 0, 1000) &&
    int(a.total, 0, 1000) &&
    a.correct <= a.total &&
    int(a.durationMs, 0, DAY_MS) &&
    sig(a.detail).length <= 2048
  );
}

const focusBody = (r: SessionRecord) => ({
  clientId: r.id,
  intention: r.intention,
  plannedMs: r.plannedMs,
  actualMs: r.actualMs,
  startedAt: r.startedAt,
  endedAt: r.endedAt,
  status: r.status,
  pauses: r.pauses,
  reflection: r.reflection,
});

const attemptBody = (a: Attempt) => ({
  clientId: a.id,
  drill: a.drill,
  date: a.date,
  at: a.at,
  score: a.score,
  correct: a.correct,
  total: a.total,
  durationMs: a.durationMs,
  detail: a.detail,
});

const consentBody = (c: ConsentRecord) => ({
  clientId: `${c.purpose}@${c.recordedAt}`.slice(0, 100),
  purpose: c.purpose,
  policyVersion: c.policyVersion,
  granted: c.granted,
  recordedAt: c.recordedAt,
});

function chunks<T>(items: T[], size = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function pageAll<T>(request: Request, path: string): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null = null;
  do {
    const q: string = cursor ? `?limit=500&cursor=${cursor}` : '?limit=500';
    const page: { items: T[]; nextCursor: string | null } = await request(
      `${path}${q}`,
    );
    all.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return all;
}

async function pull(
  request: Request,
): Promise<{ restore: Restore; settingsVersion: number | null }> {
  let settings: { data: Record<string, unknown>; version: number } | null =
    null;
  try {
    settings = await request('/me/settings');
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) {
      throw e;
    }
  }
  type RemoteFocus = ReturnType<typeof focusBody>;
  type RemoteAttempt = ReturnType<typeof attemptBody>;
  const [focus, attempts, workouts] = await Promise.all([
    pageAll<RemoteFocus>(request, '/me/focus-sessions'),
    pageAll<RemoteAttempt>(request, '/me/gym/attempts'),
    request<WorkoutDay[]>('/me/gym/workouts'),
  ]);
  return {
    settingsVersion: settings?.version ?? null,
    restore: {
      settings: settings?.data ?? null,
      focus: focus.map(f => ({
        id: f.clientId,
        intention: f.intention,
        plannedMs: f.plannedMs,
        actualMs: f.actualMs,
        startedAt: f.startedAt,
        endedAt: f.endedAt,
        status: f.status,
        pauses: f.pauses,
        reflection: f.reflection ?? null,
        sync: 'synced' as const,
      })),
      attempts: attempts.map(a => ({
        id: a.clientId,
        drill: a.drill,
        date: a.date,
        at: a.at,
        score: a.score,
        correct: a.correct,
        total: a.total,
        durationMs: a.durationMs,
        detail: a.detail,
        sync: 'synced' as const,
      })),
      workouts: workouts as WorkoutDay[],
    },
  };
}

async function putSettings(
  request: Request,
  data: BackupSettings,
  baseVersion: number | null,
): Promise<number> {
  const send = (v: number | null) =>
    request<{ version: number }>('/me/settings', {
      method: 'PUT',
      body: JSON.stringify(v === null ? { data } : { data, baseVersion: v }),
    });
  try {
    return (await send(baseVersion)).version;
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      // Changed on another phone: this phone's edit wins.
      const current =
        (e.details as { version?: number } | undefined)?.version ?? null;
      return (await send(current)).version;
    }
    throw e;
  }
}

/** One full backup pass. Throws ApiError when offline or signed out; nothing is lost then. */
export async function runSync(
  request: Request,
  snap: Snapshot,
  meta: SyncMeta,
  now: number,
): Promise<SyncResult> {
  if (!meta.restored) {
    const { restore, settingsVersion } = await pull(request);
    return {
      meta: {
        ...meta,
        restored: true,
        settingsVersion,
        settingsSig: null,
        workoutSigs: {},
        consentsSent: 0,
      },
      restore,
      focusSynced: [],
      attemptsSynced: [],
      heldBack: 0,
    };
  }

  const next: SyncMeta = { ...meta, workoutSigs: { ...meta.workoutSigs } };
  let heldBack = 0;

  // Consents: append-only; send when there are new ones. The server ignores repeats.
  if (snap.settings.consents.length !== next.consentsSent) {
    const consents = snap.settings.consents.slice(-500).map(consentBody);
    if (consents.length) {
      await request('/me/consents', {
        method: 'POST',
        body: JSON.stringify({ items: consents }),
      });
    }
    next.consentsSent = snap.settings.consents.length;
  }

  const pendingFocus = snap.focus.filter(r => r.sync === 'pending');
  const sendFocus = pendingFocus.filter(focusOk);
  heldBack += pendingFocus.length - sendFocus.length;
  const focusSynced: string[] = [];
  for (const batch of chunks(sendFocus)) {
    await request('/me/focus-sessions', {
      method: 'POST',
      body: JSON.stringify({ items: batch.map(focusBody) }),
    });
    focusSynced.push(...batch.map(r => r.id));
  }

  const pendingAttempts = snap.attempts.filter(a => a.sync === 'pending');
  const sendAttempts = pendingAttempts.filter(attemptOk);
  heldBack += pendingAttempts.length - sendAttempts.length;
  const attemptsSynced: string[] = [];
  for (const batch of chunks(sendAttempts)) {
    await request('/me/gym/attempts', {
      method: 'POST',
      body: JSON.stringify({ items: batch.map(attemptBody) }),
    });
    attemptsSynced.push(...batch.map(a => a.id));
  }

  const changedDays = snap.workouts.filter(
    w => DAY.test(w.date) && next.workoutSigs[w.date] !== sig(w),
  );
  for (const batch of chunks(changedDays)) {
    await request('/me/gym/workouts', {
      method: 'POST',
      body: JSON.stringify({ items: batch }),
    });
    for (const w of batch) {
      next.workoutSigs[w.date] = sig(w);
    }
  }

  const prefs = pickBackup(snap.settings);
  if (sig(prefs) !== next.settingsSig) {
    next.settingsVersion = await putSettings(
      request,
      prefs,
      next.settingsVersion,
    );
    next.settingsSig = sig(prefs);
  }

  next.lastSyncAt = now;
  return { meta: next, restore: null, focusSynced, attemptsSynced, heldBack };
}
