import { defineConfig } from 'prisma/config';

// DATABASE_URL comes from the environment (Render, a local .env loaded by your shell, or the
// test setup). `prisma generate` doesn't need it, so an empty value is allowed there.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
