import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.ts';
import { TokensService } from './tokens.service.ts';

type AuthedRequest = Request & { userId?: string };

/**
 * Requires "Authorization: Bearer <access token>" for a user that still exists (a deleted
 * account's unexpired token stops working at once). Every query then uses only this id.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokensService,
    private readonly db: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.header('authorization') ?? '';
    const match = /^Bearer ([A-Za-z0-9._-]+)$/.exec(header);
    if (!match) {
      throw new UnauthorizedException('Sign in first.');
    }
    const userId = await this.tokens.verifyAccess(match[1]);
    const exists = await this.db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) {
      throw new UnauthorizedException('Sign in again.');
    }
    req.userId = userId;
    return true;
  }
}

/** The signed-in user's id (only available behind AuthGuard). */
export const UserId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const id = ctx.switchToHttp().getRequest<AuthedRequest>().userId;
  if (!id) {
    throw new UnauthorizedException('Sign in first.');
  }
  return id;
});
