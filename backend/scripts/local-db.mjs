// A real PostgreSQL 17 for local development, run from this project's node_modules
// (embedded-postgres): no Docker or system install needed. Data lives in backend/.pgdata
// (git-ignored). Stop with Ctrl+C.
//
//   npm run db:local
//   then, in another terminal:  $env:DATABASE_URL = "<printed url>"; npm run db:migrate
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, '.pgdata');
const port = Number(process.env.LOCAL_PG_PORT ?? 5433);
const password = process.env.LOCAL_PG_PASSWORD ?? 'reclaim-local-only';

const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'reclaim',
  password,
  port,
  persistent: true,
  onLog: () => {},
});

if (!existsSync(join(dir, 'PG_VERSION'))) {
  await pg.initialise();
}
await pg.start();
try {
  await pg.createDatabase('reclaim');
} catch {
  // already exists
}
console.log(`PostgreSQL is running.\nDATABASE_URL=postgresql://reclaim:${password}@localhost:${port}/reclaim`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
