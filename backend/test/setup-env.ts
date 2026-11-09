// Each test file builds its own app; keep the sign-in limit out of the way except in the
// rate-limit spec, which lowers it before loading the app.
process.env.AUTH_RATE_LIMIT_PER_MINUTE ??= '100000';
