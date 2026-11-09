import { ApiError } from '../src/cloud/account';
import { applyBackup, pickBackup } from '../src/cloud/backupSettings';
import { EMPTY_META, runSync, Snapshot, SyncMeta } from '../src/cloud/sync';
import {
  focusReducer,
  SessionRecord,
  EMPTY_FOCUS,
} from '../src/features/focus/focusModel';
import {
  Attempt,
  EMPTY_GYM,
  gymReducer,
  WorkoutDay,
} from '../src/features/gym/gymModel';
import { AppSettings, DEFAULT_SETTINGS } from '../src/state/settings';

const T0 = Date.UTC(2026, 10, 9, 9, 0, 0);

/** In-memory stand-in that follows the real server's rules (idempotent batches, 409 on stale settings). */
class FakeServer {
  settings: { data: Record<string, unknown>; version: number } | null = null;
  focus = new Map<string, any>();
  attempts = new Map<string, any>();
  workouts = new Map<string, any>();
  consents = new Map<string, any>();
  calls: string[] = [];
  offline = false;

  request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const method = init.method ?? 'GET';
    this.calls.push(`${method} ${path.split('?')[0]}`);
    if (this.offline) {
      throw new ApiError(0, 'offline', 'offline');
    }
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    const base = path.split('?')[0];
    if (base === '/me/settings' && method === 'GET') {
      if (!this.settings) {
        throw new ApiError(404, 'not_found', 'none');
      }
      return this.settings as T;
    }
    if (base === '/me/settings' && method === 'PUT') {
      if (this.settings && body.baseVersion !== this.settings.version) {
        throw new ApiError(409, 'conflict', 'changed', {
          version: this.settings.version,
        });
      }
      this.settings = {
        data: body.data,
        version: (this.settings?.version ?? 0) + 1,
      };
      return { version: this.settings.version } as T;
    }
    const page = (m: Map<string, any>) => ({
      items: [...m.values()],
      nextCursor: null,
    });
    if (base === '/me/focus-sessions') {
      if (method === 'GET') {
        return page(this.focus) as T;
      }
      body.items.forEach((i: any) => this.focus.set(i.clientId, i));
      return { stored: body.items.length } as T;
    }
    if (base === '/me/gym/attempts') {
      if (method === 'GET') {
        return page(this.attempts) as T;
      }
      let n = 0;
      body.items.forEach((i: any) => {
        if (!this.attempts.has(i.clientId)) {
          this.attempts.set(i.clientId, i);
          n++;
        }
      });
      return { stored: n } as T;
    }
    if (base === '/me/gym/workouts') {
      if (method === 'GET') {
        return [...this.workouts.values()] as T;
      }
      body.items.forEach((w: any) => this.workouts.set(w.date, w));
      return { stored: body.items.length } as T;
    }
    if (base === '/me/consents') {
      body.items.forEach((c: any) => this.consents.set(c.clientId, c));
      return { stored: body.items.length } as T;
    }
    throw new Error(`unexpected ${method} ${path}`);
  };
}

const session = (
  id: string,
  extra: Partial<SessionRecord> = {},
): SessionRecord => ({
  id,
  intention: 'Read',
  plannedMs: 1_500_000,
  actualMs: 1_500_000,
  startedAt: T0,
  endedAt: T0 + 1_500_000,
  status: 'completed',
  pauses: 0,
  reflection: null,
  sync: 'pending',
  ...extra,
});

const attempt = (id: string, extra: Partial<Attempt> = {}): Attempt => ({
  id,
  drill: 'reason',
  date: '2026-11-09',
  at: T0,
  score: 0.8,
  correct: 4,
  total: 5,
  durationMs: 60_000,
  detail: { skill: 'inference' },
  sync: 'pending',
  ...extra,
});

const settingsWith = (patch: Partial<AppSettings>): AppSettings => ({
  ...DEFAULT_SETTINGS,
  onboarding: { completed: true, step: 'ready', protect: 'later' },
  ...patch,
});

const snap = (patch: Partial<Snapshot> = {}): Snapshot => ({
  settings: settingsWith({}),
  focus: [],
  attempts: [],
  workouts: [],
  ...patch,
});

/** Runs passes the way CloudSync does: restore once, then upload, applying results locally. */
async function syncPhone(
  server: FakeServer,
  phone: { snap: Snapshot; meta: SyncMeta },
) {
  for (let i = 0; i < 2; i++) {
    const r = await runSync(server.request, phone.snap, phone.meta, T0 + 1000);
    phone.meta = r.meta;
    let focus = { ...EMPTY_FOCUS, history: phone.snap.focus };
    let gym = {
      ...EMPTY_GYM,
      attempts: phone.snap.attempts,
      workouts: Object.fromEntries(phone.snap.workouts.map(w => [w.date, w])),
    };
    let settings = phone.snap.settings;
    if (r.restore) {
      if (r.restore.settings) {
        settings = applyBackup(settings, r.restore.settings);
      }
      focus = focusReducer(focus, {
        type: 'mergeRemote',
        records: r.restore.focus,
      });
      gym = gymReducer(gym, {
        type: 'mergeRemote',
        attempts: r.restore.attempts,
        workouts: r.restore.workouts,
      });
    }
    focus = focusReducer(focus, { type: 'markSynced', ids: r.focusSynced });
    gym = gymReducer(gym, { type: 'markSynced', ids: r.attemptsSynced });
    phone.snap = {
      settings,
      focus: focus.history,
      attempts: gym.attempts,
      workouts: Object.values(gym.workouts),
    };
  }
  return phone;
}

it('backs up a phone, then restores everything on a new phone', async () => {
  const server = new FakeServer();
  const day: WorkoutDay = {
    date: '2026-11-09',
    plan: ['reason', 'read'],
    done: ['reason'],
    completedAt: null,
  };
  const old = await syncPhone(server, {
    meta: EMPTY_META,
    snap: snap({
      settings: settingsWith({
        profile: { ...DEFAULT_SETTINGS.profile, name: 'Avi' },
        focusMinutes: 40,
        trackedApps: [{ packageName: 'com.secret.app', label: 'Secret' }],
        consents: [
          {
            purpose: 'cloud_backup',
            policyVersion: '1',
            granted: true,
            recordedAt: '2026-11-09T09:00:00.000Z',
          },
        ],
      }),
      focus: [
        session('f1'),
        session('f2', { startedAt: T0 + 5000, endedAt: T0 + 9000 }),
      ],
      attempts: [attempt('a1')],
      workouts: [day],
    }),
  });

  expect(old.snap.focus.every(r => r.sync === 'synced')).toBe(true);
  expect(old.snap.attempts.every(a => a.sync === 'synced')).toBe(true);
  expect(server.focus.size).toBe(2);
  expect(server.consents.size).toBe(1);
  // Only preferences go up; the apps you track never leave the phone.
  expect(JSON.stringify(server.settings)).not.toContain('com.secret.app');
  expect(server.settings!.data).toMatchObject({
    focusMinutes: 40,
    profile: { name: 'Avi' },
  });

  const fresh = await syncPhone(server, { meta: EMPTY_META, snap: snap() });
  expect(fresh.snap.settings.profile.name).toBe('Avi');
  expect(fresh.snap.settings.focusMinutes).toBe(40);
  expect(fresh.snap.settings.trackedApps).toEqual([]);
  expect(fresh.snap.focus.map(r => r.id).sort()).toEqual(['f1', 'f2']);
  expect(fresh.snap.attempts.map(a => a.id)).toEqual(['a1']);
  expect(fresh.snap.workouts).toEqual([day]);
});

it('merges instead of overwriting when both phones have history', async () => {
  const server = new FakeServer();
  await syncPhone(server, {
    meta: EMPTY_META,
    snap: snap({ focus: [session('old-phone')] }),
  });
  const now = await syncPhone(server, {
    meta: EMPTY_META,
    snap: snap({
      focus: [session('new-phone', { startedAt: T0 + 1, endedAt: T0 + 2 })],
    }),
  });
  expect(now.snap.focus.map(r => r.id).sort()).toEqual([
    'new-phone',
    'old-phone',
  ]);
  expect([...server.focus.keys()].sort()).toEqual(['new-phone', 'old-phone']);
});

it('combines a workout day finished on two phones', () => {
  const gym = {
    ...EMPTY_GYM,
    workouts: {
      '2026-11-09': {
        date: '2026-11-09',
        plan: ['reason', 'read', 'names'],
        done: ['reason'],
        completedAt: null,
      } as WorkoutDay,
    },
  };
  const next = gymReducer(gym, {
    type: 'mergeRemote',
    attempts: [],
    workouts: [
      {
        date: '2026-11-09',
        plan: ['reason', 'read', 'names'],
        done: ['read', 'names'],
        completedAt: T0,
      },
    ],
  });
  expect(next.workouts['2026-11-09']).toEqual({
    date: '2026-11-09',
    plan: ['reason', 'read', 'names'],
    done: ['reason', 'read', 'names'],
    completedAt: T0,
  });
});

it('uploads only what changed, and a reflection added later goes up again', async () => {
  const server = new FakeServer();
  const phone = await syncPhone(server, {
    meta: EMPTY_META,
    snap: snap({ focus: [session('f1')] }),
  });
  server.calls = [];
  await syncPhone(server, phone);
  expect(server.calls).toEqual([]); // nothing new: no requests

  const reflected = focusReducer(
    { ...EMPTY_FOCUS, history: phone.snap.focus },
    {
      type: 'reflect',
      id: 'f1',
      reflection: { progress: 'yes', interruptions: 'none' },
    },
  );
  expect(reflected.history[0].sync).toBe('pending');
  phone.snap = { ...phone.snap, focus: reflected.history };
  await syncPhone(server, phone);
  expect(server.focus.get('f1').reflection).toMatchObject({ progress: 'yes' });
});

it('settings edited on another phone: this phone wins instead of failing', async () => {
  const server = new FakeServer();
  const a = await syncPhone(server, { meta: EMPTY_META, snap: snap() });
  const b = await syncPhone(server, { meta: EMPTY_META, snap: snap() });
  b.snap = { ...b.snap, settings: { ...b.snap.settings, focusMinutes: 50 } };
  await syncPhone(server, b);
  a.snap = { ...a.snap, settings: { ...a.snap.settings, focusMinutes: 15 } };
  await syncPhone(server, a); // stale version -> 409 -> retried with the current one
  expect(server.settings!.data.focusMinutes).toBe(15);
});

it('holds back a record the server would refuse instead of blocking the rest', async () => {
  const server = new FakeServer();
  const phone = await syncPhone(server, {
    meta: EMPTY_META,
    snap: snap({
      focus: [
        session('good'),
        session('broken-clock', { startedAt: 1000, endedAt: 2000 }),
      ],
    }),
  });
  expect([...server.focus.keys()]).toEqual(['good']);
  const r = await runSync(server.request, phone.snap, phone.meta, T0);
  expect(r.heldBack).toBe(1);
});

it('offline: nothing is marked as backed up, so it goes up next time', async () => {
  const server = new FakeServer();
  const phone = await syncPhone(server, { meta: EMPTY_META, snap: snap() });
  phone.snap = { ...phone.snap, focus: [session('f9')] };
  server.offline = true;
  await expect(
    runSync(server.request, phone.snap, phone.meta, T0),
  ).rejects.toMatchObject({ status: 0 });
  expect(phone.snap.focus[0].sync).toBe('pending');
  server.offline = false;
  await syncPhone(server, phone);
  expect(server.focus.has('f9')).toBe(true);
});

it('the backed-up part of settings never includes this-phone data', () => {
  const keys = Object.keys(pickBackup(DEFAULT_SETTINGS));
  for (const local of [
    'trackedApps',
    'gate',
    'web',
    'reels',
    'intensity',
    'monitoring',
    'onboarding',
    'consents',
  ]) {
    expect(keys).not.toContain(local);
  }
});
