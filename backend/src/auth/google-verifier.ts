import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { ENV, type Env } from '../config/env.ts';

export type GoogleIdentity = { sub: string; email: string | null };

export interface IdTokenVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}

export const ID_TOKEN_VERIFIER = Symbol('ID_TOKEN_VERIFIER');

/**
 * Checks a Google ID token from One Tap / Credential Manager: Google's signature, expiry,
 * issuer, and that it was issued for one of OUR client ids. Only the stable account id (sub)
 * and a verified email are used.
 */
@Injectable()
export class GoogleIdTokenVerifier implements IdTokenVerifier {
  private readonly client = new OAuth2Client();

  constructor(@Inject(ENV) private readonly env: Env) {}

  async verify(idToken: string): Promise<GoogleIdentity> {
    if (this.env.googleClientIds.length === 0) {
      throw new ServiceUnavailableException('Google sign-in is not configured on this server.');
    }
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.env.googleClientIds,
      });
      const p = ticket.getPayload();
      if (!p?.sub) {
        throw new Error('no subject');
      }
      return { sub: p.sub, email: p.email && p.email_verified ? p.email : null };
    } catch {
      throw new UnauthorizedException('Google sign-in could not be verified.');
    }
  }
}
