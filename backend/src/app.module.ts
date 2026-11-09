import { DynamicModule, Module, Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController, AuthService } from './auth/auth.controller.ts';
import { AuthGuard } from './auth/auth.guard.ts';
import { GoogleIdTokenVerifier, ID_TOKEN_VERIFIER, type IdTokenVerifier } from './auth/google-verifier.ts';
import { TokensService } from './auth/tokens.service.ts';
import { ENV, type Env } from './config/env.ts';
import { HealthController } from './health.controller.ts';
import { MeController } from './me/me.controller.ts';
import { MeService } from './me/me.service.ts';
import { PrismaService } from './prisma/prisma.service.ts';

@Module({})
export class AppModule {
  /**
   * @param verifier Tests pass a fake Google verifier; production uses Google's.
   */
  static register(env: Env, verifier?: IdTokenVerifier): DynamicModule {
    const verifierProvider: Provider = verifier
      ? { provide: ID_TOKEN_VERIFIER, useValue: verifier }
      : { provide: ID_TOKEN_VERIFIER, useClass: GoogleIdTokenVerifier };
    return {
      module: AppModule,
      imports: [
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: env.RATE_LIMIT_PER_MINUTE }]),
      ],
      controllers: [HealthController, AuthController, MeController],
      providers: [
        { provide: ENV, useValue: env },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        verifierProvider,
        PrismaService,
        TokensService,
        AuthService,
        AuthGuard,
        MeService,
      ],
    };
  }
}
