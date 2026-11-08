package com.reclaim.gate

/**
 * The intensity ladder (pure, JVM-testable). Mirrors src/state/intensity.ts.
 *
 * 1 Aware  - count only (reels + Pip), no pauses.
 * 2 Gentle - 5 s breath, "Not now" or "Open for N min".
 * 3 Firm   - 15 s breath, say why, 2 min allowed, at most FIRM_DAILY_OPENS opens per app/site a day.
 * 4 Strict - locked until a time the user chose; an emergency unlock always exists but costs a
 *            60 s wait.
 *
 * Tightening takes effect at once; loosening is scheduled (pendingLevel at pendingAt) so a
 * tired late-night self can't undo a calm decision. Strict always has an end (strictUntil).
 */
object Intensity {
  const val AWARE = 1
  const val GENTLE = 2
  const val FIRM = 3
  const val STRICT = 4

  const val FIRM_DAILY_OPENS = 5
  const val FIRM_ALLOW_MINUTES = 2
  const val EMERGENCY_WAIT_SECONDS = 60
  const val EMERGENCY_ALLOW_MINUTES = 5

  data class Plan(
      val base: Int = GENTLE,
      val pendingLevel: Int = 0,
      val pendingAt: Long = 0,
      val strictUntil: Long = 0,
  )

  fun effective(p: Plan, now: Long): Int {
    if (now < p.strictUntil) return STRICT
    if (p.pendingLevel in AWARE..FIRM && now >= p.pendingAt) return p.pendingLevel
    return p.base.coerceIn(AWARE, FIRM)
  }

  fun breathSeconds(level: Int): Int = if (level >= FIRM) 15 else 5

  fun allowMinutes(level: Int, userMinutes: Int): Int =
      if (level >= FIRM) minOf(FIRM_ALLOW_MINUTES, userMinutes) else userMinutes

  /** Firm: the daily open budget for one app or site is used up. */
  fun overBudget(level: Int, opensToday: Int): Boolean = level == FIRM && opensToday >= FIRM_DAILY_OPENS
}
