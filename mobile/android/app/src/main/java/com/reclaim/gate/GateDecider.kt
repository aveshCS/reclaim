package com.reclaim.gate

/**
 * Pure rule (JVM-testable): should a pause screen be shown for this foreground app now?
 * Deterministic, user-configured: "if one of my chosen apps opens, pause first".
 */
object GateDecider {
  /**
   * Ignore repeated window events for the same app within this window. Apps often switch
   * screens during launch (splash -> home), which would otherwise re-trigger the pause.
   */
  const val DEBOUNCE_MS = 15_000L

  data class Config(
      val enabled: Boolean,
      val packages: Set<String>,
      val ownPackage: String,
  )

  fun shouldPause(
      cfg: Config,
      pkg: String?,
      now: Long,
      allowedUntil: Long,
      lastShownFor: String?,
      lastShownAt: Long,
      pauseShowing: Boolean = false,
  ): Boolean {
    if (!cfg.enabled || pkg.isNullOrBlank()) return false
    if (pauseShowing) return false // the pause screen is already up
    if (pkg == cfg.ownPackage) return false
    if (pkg !in cfg.packages) return false
    if (now < allowedUntil) return false // user chose to open it for a while
    if (pkg == lastShownFor && now - lastShownAt < DEBOUNCE_MS) return false
    return true
  }
}
