export default async function teardown() {
  await globalThis.__RECLAIM_PG__?.stop();
}
