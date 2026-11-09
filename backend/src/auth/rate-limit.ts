/**
 * Sign-in endpoints get a tighter per-address limit than the rest of the API.
 * Read from the environment when the module loads (tests lower or raise it).
 */
export function authLimit() {
  const n = Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE ?? 10);
  return { default: { limit: Number.isFinite(n) && n > 0 ? n : 10, ttl: 60_000 } };
}
