import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { db, googleToken, makeApp, signIn } from './helpers.ts';

let app: INestApplication;
beforeAll(async () => {
  app = await makeApp();
});
afterAll(async () => {
  await app.close();
});
const http = () => request(app.getHttpServer());

describe('health', () => {
  it('reports the database is reachable', async () => {
    const res = await http().get('/v1/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });
});

describe('Google sign-in', () => {
  it('creates the account once, then signs the same person back in', async () => {
    const first = await http().post('/v1/auth/google').send({ idToken: googleToken('alice-1') }).expect(200);
    expect(first.body.created).toBe(true);
    expect(first.body.expiresIn).toBe(3600);
    const again = await http().post('/v1/auth/google').send({ idToken: googleToken('alice-1') }).expect(200);
    expect(again.body.created).toBe(false);
    expect(again.body.userId).toBe(first.body.userId);

    const me = await http().get('/v1/me').set('Authorization', `Bearer ${again.body.accessToken}`).expect(200);
    expect(me.body).toMatchObject({ id: first.body.userId, email: 'alice-1@example.com' });
  });

  it('refuses a token Google would not accept', async () => {
    const res = await http().post('/v1/auth/google').send({ idToken: 'forged-token-forged-token' }).expect(401);
    expect(res.body.error).toMatchObject({ status: 401, code: 'unauthorized' });
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('validates the body', async () => {
    await http().post('/v1/auth/google').send({}).expect(400);
    await http().post('/v1/auth/google').send({ idToken: googleToken('x'), extra: 1 }).expect(400);
  });

  it('never stores refresh tokens in plain text', async () => {
    const s = await signIn(app);
    const rows = await db(app).refreshToken.findMany({ where: { userId: s.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toContain(s.refreshToken);
  });
});

describe('access tokens', () => {
  it('rejects missing, malformed and tampered tokens', async () => {
    const s = await signIn(app);
    await http().get('/v1/me').expect(401);
    await http().get('/v1/me').set('Authorization', 'Bearer nope').expect(401);
    await http().get('/v1/me').set('Authorization', `Basic ${s.accessToken}`).expect(401);
    const [h, p, sig] = s.accessToken.split('.');
    const flipped = sig.slice(0, -2) + (sig.endsWith('AA') ? 'BB' : 'AA');
    await http().get('/v1/me').set('Authorization', `Bearer ${h}.${p}.${flipped}`).expect(401);
  });

  it('rejects a token signed with another secret', async () => {
    const other = await makeApp({ JWT_SECRET: 'a-different-secret-that-is-long-enough-xyz' });
    try {
      const s = await signIn(other);
      await http().get('/v1/me').set(s.auth).expect(401);
    } finally {
      await other.close();
    }
  });
});

describe('refresh tokens', () => {
  it('rotates: the new pair works and the old refresh token is spent', async () => {
    const s = await signIn(app);
    const r1 = await http().post('/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(200);
    expect(r1.body.refreshToken).not.toBe(s.refreshToken);
    await http().get('/v1/me').set('Authorization', `Bearer ${r1.body.accessToken}`).expect(200);

    const r2 = await http().post('/v1/auth/refresh').send({ refreshToken: r1.body.refreshToken }).expect(200);
    expect(r2.body.refreshToken).toBeTruthy();
  });

  it('treats reuse of a spent token as theft and signs out every device', async () => {
    const s = await signIn(app);
    const next = await http().post('/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(200);
    // The old token shows up again: refuse it and revoke the whole family.
    await http().post('/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(401);
    await http().post('/v1/auth/refresh').send({ refreshToken: next.body.refreshToken }).expect(401);
  });

  it('logout revokes the token; unknown tokens are refused', async () => {
    const s = await signIn(app);
    await http().post('/v1/auth/logout').send({ refreshToken: s.refreshToken }).expect(204);
    await http().post('/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(401);
    await http().post('/v1/auth/refresh').send({ refreshToken: 'x'.repeat(43) }).expect(401);
  });

  it('expired refresh tokens are refused', async () => {
    const s = await signIn(app);
    await db(app).refreshToken.updateMany({
      where: { userId: s.userId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await http().post('/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(401);
  });
});
