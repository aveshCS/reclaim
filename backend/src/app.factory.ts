import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.ts';
import type { IdTokenVerifier } from './auth/google-verifier.ts';
import { ErrorFilter } from './common/error.filter.ts';
import { requestId } from './common/request-id.ts';
import type { Env } from './config/env.ts';

/** Builds the app exactly as production runs it (tests use this too). */
export async function createApp(env: Env, opts: { verifier?: IdTokenVerifier; logger?: false } = {}) {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(env, opts.verifier),
    { bodyParser: false, logger: opts.logger === false ? false : undefined },
  );

  if (env.trustProxy) {
    app.set('trust proxy', 1);
  }
  app.use(helmet());
  app.use(requestId);
  app.useBodyParser('json', { limit: '1mb' });
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();

  if (env.allowedOrigins.length > 0) {
    app.enableCors({ origin: env.allowedOrigins, credentials: false });
  } else {
    // The mobile app doesn't need CORS; browsers get no cross-origin access at all.
    new Logger('CORS').log('Off (no ALLOWED_ORIGINS set).');
  }

  if (env.docsEnabled) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('RECLAIM API')
        .setDescription('Google sign-in, backup and restore for the RECLAIM app.')
        .setVersion('1')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('v1/docs', app, doc);
  }
  return app;
}
