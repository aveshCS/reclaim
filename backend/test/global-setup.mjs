// Starts a disposable PostgreSQL 17 for the test run and applies the real migrations to it.
import EmbeddedPostgres from 'embedded-postgres';
import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default async function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'reclaim-test-pg-'));
  const port = 55000 + Math.floor(Math.random() * 5000);
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'reclaim',
    password: 'test-only',
    port,
    persistent: false,
    onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('reclaim_test');
  const url = `postgresql://reclaim:test-only@localhost:${port}/reclaim_test`;
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  process.env.DATABASE_URL = url;
  globalThis.__RECLAIM_PG__ = pg;
}
