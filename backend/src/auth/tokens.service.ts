import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { ENV, type Env } from '../config/env.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

const ISSUER = 'reclaim-api';
const AUDIENCE = 'reclaim-app';
export const ACCESS_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TTL_DAYS = 60;

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Short-lived access tokens (JWT, 1 h) plus refresh tokens that rotate on every use.
 * Refresh tokens are stored only as hashes. Re-using an already-used refresh token means it
 * was copied, so every session of that user is revoked.
 */
@Injectable()
export class TokensService {
  private readonly key: Uint8Array;

  constructor(
    @Inject(ENV) env: Env,
    private readonly db: PrismaService,
  ) {
    this.key = new TextEncoder().encode(env.JWT_SECRET);
  }

  async issue(userId: string): Promise<TokenPair> {
    const accessToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
      .sign(this.key);
    const refreshToken = randomBytes(32).toString('base64url');
    await this.db.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000),
      },
    });
    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS };
  }

  /** The user id in a valid access token, or 401. */
  async verifyAccess(token: string): Promise<string> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      });
      if (!payload.sub) {
        throw new Error('no subject');
      }
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Sign in again.');
    }
  }

  async rotate(refreshToken: string): Promise<TokenPair> {
    const row = await this.db.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
    });
    if (!row) {
      throw new UnauthorizedException('Sign in again.');
    }
    if (row.revokedAt) {
      // Reuse of a spent token: someone else may hold it. End every session for this user.
      await this.db.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Sign in again.');
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Sign in again.');
    }
    // Spend it only if nobody else did in the meantime.
    const spent = await this.db.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (spent.count !== 1) {
      throw new UnauthorizedException('Sign in again.');
    }
    return this.issue(row.userId);
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
