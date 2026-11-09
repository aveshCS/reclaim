import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('sign-in rate limit', () => {
  let app: INestApplication;
  beforeAll(async () => {
    process.env.AUTH_RATE_LIMIT_PER_MINUTE = '3'; // read when the auth module loads
    const { makeApp } = await import('./helpers.ts');
    app = await makeApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('answers 429 after too many sign-in attempts, without blocking the rest of the API', async () => {
    const http = () => request(app.getHttpServer());
    const { googleToken } = await import('./helpers.ts');
    for (let i = 0; i < 3; i++) {
      await http().post('/v1/auth/google').send({ idToken: googleToken('rl-user') }).expect(200);
    }
    const res = await http().post('/v1/auth/google').send({ idToken: googleToken('rl-user') }).expect(429);
    expect(res.body.error.code).toBe('too_many_requests');
    await http().get('/v1/health').expect(200);
  });
});

describe('API docs and hardening', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const { makeApp } = await import('./helpers.ts');
    app = await makeApp({ DOCS_ENABLED: 'true' });
  });
  afterAll(async () => {
    await app.close();
  });

  it('OpenAPI lists every implemented route', async () => {
    const res = await request(app.getHttpServer()).get('/v1/docs-json').expect(200);
    const routes = Object.entries(res.body.paths as Record<string, object>).flatMap(([path, ops]) =>
      Object.keys(ops).map(m => `${m.toUpperCase()} ${path}`),
    );
    expect(routes.sort()).toEqual(
      [
        'GET /v1/health',
        'POST /v1/auth/google',
        'POST /v1/auth/refresh',
        'POST /v1/auth/logout',
        'GET /v1/me',
        'DELETE /v1/me',
        'GET /v1/me/export',
        'GET /v1/me/settings',
        'PUT /v1/me/settings',
        'GET /v1/me/consents',
        'POST /v1/me/consents',
        'GET /v1/me/focus-sessions',
        'POST /v1/me/focus-sessions',
        'GET /v1/me/gym/attempts',
        'POST /v1/me/gym/attempts',
        'GET /v1/me/gym/workouts',
        'POST /v1/me/gym/workouts',
      ].sort(),
    );
  });

  it('sends security headers, no CORS by default, and a clean 404', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/nothing-here')
      .set('Origin', 'https://evil.example')
      .expect(404);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.body.error.code).toBe('not_found');
  });

  it('refuses to start with a weak secret or, in production, without Google configured', async () => {
    const { loadEnv } = await import('../src/config/env.ts');
    const base = { DATABASE_URL: 'postgresql://x@y/z', JWT_SECRET: 's'.repeat(32) };
    expect(() => loadEnv({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' })).toThrow(/GOOGLE_CLIENT_IDS/);
    const prod = loadEnv({ ...base, NODE_ENV: 'production', GOOGLE_CLIENT_IDS: 'a.apps.googleusercontent.com' });
    expect(prod.docsEnabled).toBe(false);
    expect(prod.trustProxy).toBe(true);
  });
});
