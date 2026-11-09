import 'reflect-metadata';
import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/app.factory.ts';
import type { GoogleIdentity, IdTokenVerifier } from '../src/auth/google-verifier.ts';
import { loadEnv } from '../src/config/env.ts';
import { PrismaService } from '../src/prisma/prisma.service.ts';

/**
 * Stands in for Google in tests. A "token" looks like  test-google:<sub>:<email>
 * Anything else is rejected, like a forged or expired Google token would be.
 */
export const fakeGoogle: IdTokenVerifier = {
  async verify(idToken: string): Promise<GoogleIdentity> {
    const m = /^test-google:([A-Za-z0-9_-]+):(.*)$/.exec(idToken);
    if (!m) {
      throw new UnauthorizedException('Google sign-in could not be verified.');
    }
    return { sub: m[1], email: m[2] || null };
  },
};

export const googleToken = (sub: string, email = `${sub}@example.com`) =>
  `test-google:${sub}:${email}`.padEnd(24, '_');

export async function makeApp(extraEnv: Record<string, string> = {}): Promise<INestApplication> {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: 'test-secret-that-is-long-enough-1234567890',
    RATE_LIMIT_PER_MINUTE: '100000',
    ...extraEnv,
  });
  const app = await createApp(env, { verifier: fakeGoogle, logger: false });
  await app.init();
  return app;
}

export const db = (app: INestApplication) => app.get(PrismaService);

let n = 0;
/** A fresh user signed in through the real /auth/google endpoint. */
export async function signIn(app: INestApplication, sub = `user${Date.now()}${n++}`) {
  const res = await request(app.getHttpServer())
    .post('/v1/auth/google')
    .send({ idToken: googleToken(sub) })
    .expect(200);
  const auth = { Authorization: `Bearer ${res.body.accessToken}` };
  return { ...res.body, sub, auth } as {
    accessToken: string;
    refreshToken: string;
    userId: string;
    created: boolean;
    sub: string;
    auth: { Authorization: string };
  };
}

export const T0 = Date.UTC(2026, 10, 9, 9, 0, 0);

export const focusItem = (clientId: string, startedAt = T0, extra: object = {}) => ({
  clientId,
  intention: 'Read chapter 3',
  plannedMs: 25 * 60_000,
  actualMs: 25 * 60_000,
  startedAt,
  endedAt: startedAt + 25 * 60_000,
  status: 'completed',
  pauses: 0,
  reflection: null,
  ...extra,
});

export const attemptItem = (clientId: string, extra: object = {}) => ({
  clientId,
  drill: 'reason',
  date: '2026-11-09',
  at: T0,
  score: 0.8,
  correct: 4,
  total: 5,
  durationMs: 60_000,
  detail: { skill: 'inference' },
  ...extra,
});
