import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { createApp } from './app.factory.ts';
import { loadEnv } from './config/env.ts';

async function bootstrap() {
  const env = loadEnv(); // fails fast with a clear message if anything is missing
  const app = await createApp(env);
  await app.listen(env.PORT, '0.0.0.0');
  new Logger('RECLAIM').log(
    `API on port ${env.PORT} (${env.NODE_ENV})${env.docsEnabled ? ', docs at /v1/docs' : ''}`,
  );
}

bootstrap().catch(err => {
  // Startup errors (bad env, database down) end the process with a readable reason.
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
