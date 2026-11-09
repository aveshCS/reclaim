import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { T0, attemptItem, db, focusItem, makeApp, signIn } from './helpers.ts';

let app: INestApplication;
beforeAll(async () => {
  app = await makeApp();
});
afterAll(async () => {
  await app.close();
});
const http = () => request(app.getHttpServer());

const consent = (clientId: string, extra: object = {}) => ({
  clientId,
  purpose: 'pause',
  policyVersion: '2026-11',
  granted: true,
  recordedAt: '2026-11-09T09:00:00.000Z',
  ...extra,
});

describe('settings backup', () => {
  it('404 before the first backup, then versions each write', async () => {
    const s = await signIn(app);
    await http().get('/v1/me/settings').set(s.auth).expect(404);
    const v1 = await http().put('/v1/me/settings').set(s.auth).send({ data: { theme: 'warm' } }).expect(200);
    expect(v1.body.version).toBe(1);
    const v2 = await http()
      .put('/v1/me/settings')
      .set(s.auth)
      .send({ data: { theme: 'cool' }, baseVersion: 1 })
      .expect(200);
    expect(v2.body.version).toBe(2);
    const got = await http().get('/v1/me/settings').set(s.auth).expect(200);
    expect(got.body).toMatchObject({ data: { theme: 'cool' }, version: 2 });
  });

  it('a stale or missing baseVersion gets 409 with the current copy to merge', async () => {
    const s = await signIn(app);
    await http().put('/v1/me/settings').set(s.auth).send({ data: { a: 1 } }).expect(200);
    await http().put('/v1/me/settings').set(s.auth).send({ data: { a: 2 }, baseVersion: 1 }).expect(200);

    const stale = await http()
      .put('/v1/me/settings')
      .set(s.auth)
      .send({ data: { a: 3 }, baseVersion: 1 })
      .expect(409);
    expect(stale.body.error).toMatchObject({ code: 'conflict', details: { version: 2, data: { a: 2 } } });

    await http().put('/v1/me/settings').set(s.auth).send({ data: { a: 3 } }).expect(409);
  });

  it('two devices writing the same version: exactly one wins', async () => {
    const s = await signIn(app);
    await http().put('/v1/me/settings').set(s.auth).send({ data: { n: 0 } }).expect(200);
    const results = await Promise.all(
      [1, 2, 3, 4].map(n => http().put('/v1/me/settings').set(s.auth).send({ data: { n }, baseVersion: 1 })),
    );
    expect(results.map(r => r.status).sort()).toEqual([200, 409, 409, 409]);
  });

  it('refuses settings over 64 KB and bodies over 1 MB', async () => {
    const s = await signIn(app);
    await http()
      .put('/v1/me/settings')
      .set(s.auth)
      .send({ data: { blob: 'x'.repeat(70 * 1024) } })
      .expect(400);
    const res = await http()
      .put('/v1/me/settings')
      .set(s.auth)
      .send({ data: { blob: 'x'.repeat(1100 * 1024) } })
      .expect(413);
    expect(res.body.error.code).toBe('payload_too_large');
  });

  it('invalid JSON gets a clean 400', async () => {
    const s = await signIn(app);
    const res = await http()
      .put('/v1/me/settings')
      .set(s.auth)
      .set('Content-Type', 'application/json')
      .send('{"data": ')
      .expect(400);
    expect(res.body.error.code).toBe('bad_request');
  });
});

describe('batches are idempotent (safe to retry)', () => {
  it('consents: re-sending the same records stores nothing new', async () => {
    const s = await signIn(app);
    const items = [consent('c1'), consent('c2', { purpose: 'reels', granted: false, recordedAt: '2026-11-09T09:01:00.000Z' })];
    const a = await http().post('/v1/me/consents').set(s.auth).send({ items }).expect(200);
    expect(a.body.stored).toBe(2);
    const b = await http().post('/v1/me/consents').set(s.auth).send({ items }).expect(200);
    expect(b.body.stored).toBe(0);
    const list = await http().get('/v1/me/consents').set(s.auth).expect(200);
    expect(list.body.map((c: { clientId: string }) => c.clientId)).toEqual(['c1', 'c2']);
  });

  it('focus sessions: a retry updates in place, and a later reflection is kept', async () => {
    const s = await signIn(app);
    await http().post('/v1/me/focus-sessions').set(s.auth).send({ items: [focusItem('f1')] }).expect(200);
    await http()
      .post('/v1/me/focus-sessions')
      .set(s.auth)
      .send({ items: [focusItem('f1', T0, { reflection: { progress: 'yes', interruptions: 'few' } })] })
      .expect(200);
    const list = await http().get('/v1/me/focus-sessions').set(s.auth).expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ clientId: 'f1', startedAt: T0, reflection: { progress: 'yes' } });
  });

  it('gym attempts: inserted once; workouts upsert by day', async () => {
    const s = await signIn(app);
    const items = [attemptItem('a1'), attemptItem('a2', { drill: 'recall' })];
    expect((await http().post('/v1/me/gym/attempts').set(s.auth).send({ items }).expect(200)).body.stored).toBe(2);
    expect((await http().post('/v1/me/gym/attempts').set(s.auth).send({ items }).expect(200)).body.stored).toBe(0);

    const day = { date: '2026-11-09', plan: ['reason', 'recall'], done: ['reason'] };
    await http().post('/v1/me/gym/workouts').set(s.auth).send({ items: [day] }).expect(200);
    await http()
      .post('/v1/me/gym/workouts')
      .set(s.auth)
      .send({ items: [{ ...day, done: ['reason', 'recall'], completedAt: T0 }] })
      .expect(200);
    const w = await http().get('/v1/me/gym/workouts').set(s.auth).expect(200);
    expect(w.body).toEqual([
      { date: '2026-11-09', plan: ['reason', 'recall'], done: ['reason', 'recall'], completedAt: T0 },
    ]);
  });

  it('pages through long histories without gaps or repeats', async () => {
    const s = await signIn(app);
    const items = Array.from({ length: 7 }, (_, i) => focusItem(`p${i}`, T0 + i * 3_600_000));
    await http().post('/v1/me/focus-sessions').set(s.auth).send({ items }).expect(200);
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const q: string = cursor ? `?limit=3&cursor=${cursor}` : '?limit=3';
      const page: request.Response = await http().get(`/v1/me/focus-sessions${q}`).set(s.auth).expect(200);
      seen.push(...page.body.items.map((f: { clientId: string }) => f.clientId));
      cursor = page.body.nextCursor;
    } while (cursor);
    expect(seen).toEqual(['p6', 'p5', 'p4', 'p3', 'p2', 'p1', 'p0']);
  });
});

describe('validation', () => {
  it('refuses bad records with 400 and stores none of the batch', async () => {
    const s = await signIn(app);
    const post = (path: string, items: unknown) => http().post(path).set(s.auth).send({ items });

    await post('/v1/me/focus-sessions', [focusItem('ok'), focusItem('bad', T0, { status: 'abandoned' })]).expect(400);
    await post('/v1/me/focus-sessions', [focusItem('ok'), focusItem('t', T0, { endedAt: T0 - 1 })]).expect(400);
    await post('/v1/me/focus-sessions', [focusItem('t', 1000)]).expect(400); // 1970: broken clock
    await post('/v1/me/gym/attempts', [attemptItem('x', { drill: 'iq-test' })]).expect(400);
    await post('/v1/me/gym/attempts', [attemptItem('x', { correct: 6, total: 5 })]).expect(400);
    await post('/v1/me/gym/attempts', [attemptItem('x', { score: 1.5 })]).expect(400);
    await post('/v1/me/gym/attempts', [attemptItem('x', { detail: { big: 'x'.repeat(3000) } })]).expect(400);
    await post('/v1/me/gym/workouts', [{ date: '9 Nov', plan: [], done: [] }]).expect(400);
    await post('/v1/me/consents', Array.from({ length: 501 }, (_, i) => consent(`c${i}`))).expect(400);
    await post('/v1/me/consents', 'nope').expect(400);
    await http().get('/v1/me/focus-sessions?limit=0').set(s.auth).expect(400);
    await http().get('/v1/me/focus-sessions?cursor=not-a-uuid').set(s.auth).expect(400);

    const list = await http().get('/v1/me/focus-sessions').set(s.auth).expect(200);
    expect(list.body.items).toEqual([]);
    const attempts = await http().get('/v1/me/gym/attempts').set(s.auth).expect(200);
    expect(attempts.body.items).toEqual([]);
  });
});

describe('each person only ever sees their own data', () => {
  it('user B cannot read or overwrite user A', async () => {
    const a = await signIn(app);
    const b = await signIn(app);
    await http().put('/v1/me/settings').set(a.auth).send({ data: { owner: 'a' } }).expect(200);
    await http().post('/v1/me/focus-sessions').set(a.auth).send({ items: [focusItem('shared-id')] }).expect(200);
    await http().post('/v1/me/gym/attempts').set(a.auth).send({ items: [attemptItem('shared-id')] }).expect(200);

    await http().get('/v1/me/settings').set(b.auth).expect(404);
    expect((await http().get('/v1/me/focus-sessions').set(b.auth).expect(200)).body.items).toEqual([]);
    expect((await http().get('/v1/me/gym/attempts').set(b.auth).expect(200)).body.items).toEqual([]);
    expect((await http().get('/v1/me/export').set(b.auth).expect(200)).body.focusSessions).toEqual([]);

    // The same client id from B is B's own record and leaves A's alone.
    await http()
      .post('/v1/me/focus-sessions')
      .set(b.auth)
      .send({ items: [focusItem('shared-id', T0, { intention: 'B' })] })
      .expect(200);
    const bAttempt = await http().post('/v1/me/gym/attempts').set(b.auth).send({ items: [attemptItem('shared-id')] });
    expect(bAttempt.body.stored).toBe(1);
    const aList = await http().get('/v1/me/focus-sessions').set(a.auth).expect(200);
    expect(aList.body.items[0].intention).toBe('Read chapter 3');
  });

  it("B can't use A's paging cursor to read A's rows", async () => {
    const a = await signIn(app);
    const b = await signIn(app);
    const items = [focusItem('a0', T0), focusItem('a1', T0 + 1000), focusItem('a2', T0 + 2000)];
    await http().post('/v1/me/focus-sessions').set(a.auth).send({ items }).expect(200);
    const page = await http().get('/v1/me/focus-sessions?limit=1').set(a.auth).expect(200);
    const res = await http().get(`/v1/me/focus-sessions?cursor=${page.body.nextCursor}`).set(b.auth);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });
});

describe('export and delete', () => {
  async function fillEverything(auth: { Authorization: string }) {
    await http().put('/v1/me/settings').set(auth).send({ data: { k: 'v' } }).expect(200);
    await http().post('/v1/me/consents').set(auth).send({ items: [consent('c')] }).expect(200);
    await http().post('/v1/me/focus-sessions').set(auth).send({ items: [focusItem('f')] }).expect(200);
    await http().post('/v1/me/gym/attempts').set(auth).send({ items: [attemptItem('g')] }).expect(200);
    await http()
      .post('/v1/me/gym/workouts')
      .set(auth)
      .send({ items: [{ date: '2026-11-09', plan: ['reason'], done: [] }] })
      .expect(200);
  }

  it('export holds everything stored for the user', async () => {
    const s = await signIn(app);
    await fillEverything(s.auth);
    const ex = await http().get('/v1/me/export').set(s.auth).expect(200);
    expect(ex.body.profile.id).toBe(s.userId);
    expect(ex.body.settings).toEqual({ data: { k: 'v' }, version: 1 });
    expect(ex.body.consents).toHaveLength(1);
    expect(ex.body.focusSessions).toHaveLength(1);
    expect(ex.body.gymAttempts).toHaveLength(1);
    expect(ex.body.gymWorkouts).toHaveLength(1);
  });

  it('delete removes the account and every row, and old tokens stop working', async () => {
    const s = await signIn(app);
    await fillEverything(s.auth);
    await http().delete('/v1/me').set(s.auth).expect(204);

    const p = db(app);
    const where = { userId: s.userId };
    const counts = await Promise.all([
      p.user.count({ where: { id: s.userId } }),
      p.refreshToken.count({ where }),
      p.userSettings.count({ where }),
      p.consent.count({ where }),
      p.focusSession.count({ where }),
      p.gymAttempt.count({ where }),
      p.gymWorkout.count({ where }),
    ]);
    expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0]);
    await http().get('/v1/me').set(s.auth).expect(401);
    await http().post('/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(401);
  });
});
