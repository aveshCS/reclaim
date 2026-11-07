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

  /** After the pause is dismissed, ignore that app briefly while it closes or settles. */
  const val QUIET_AFTER_DISMISS_MS = 3_000L

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
      quietUntil: Long = 0,
  ): Boolean {
    if (!cfg.enabled || pkg.isNullOrBlank()) return false
    if (pauseShowing) return false // the pause screen is already up
    // Just dismissed: the app sends late window events while it closes. Ignore them.
    if (now < quietUntil) return false
    if (pkg == cfg.ownPackage) return false
    if (pkg !in cfg.packages) return false
    if (now < allowedUntil) return false // user chose to open it for a while
    if (pkg == lastShownFor && now - lastShownAt < DEBOUNCE_MS) return false
    return true
  }

  /** How long the user must have been in another full-screen app before a small event counts. */
  const val SETTLE_MS = 1_500L

  /**
   * Is this event a real open of [pkg]? A full-screen window always is. A small window (pop-up,
   * leftover event while the app closes) only counts if the user is already in that app, or has
   * been somewhere else for a while. Seen on a POCO: YouTube sends a small event ~0.3 s after
   * the home screen appears; on stock Android a real open can arrive as a small event.
   */
  fun isRealOpen(fullScreen: Boolean, pkg: String, lastFullPkg: String?, lastFullAt: Long, now: Long): Boolean =
      fullScreen || lastFullPkg == null || lastFullPkg == pkg || now - lastFullAt >= SETTLE_MS

  /** System windows that can briefly come to the front without the user leaving the app. */
  val IGNORED_WHILE_SHOWING = setOf("android", "com.android.systemui", "com.google.android.gms", "com.google.android.gsf")

  /**
   * System windows that report themselves as full-screen but aren't the user switching apps:
   * the keyboard, and Xiaomi's volume panel (seen on a POCO M4 Pro).
   */
  fun isSystemWindow(pkg: String, className: String?): Boolean =
      pkg in IGNORED_WHILE_SHOWING ||
          pkg.startsWith("miui.systemui") ||
          pkg.startsWith("com.android.systemui") ||
          className == "android.inputmethodservice.SoftInputWindow"

  /**
   * While the pause is up for [shownFor], should a window from [pkg] take it down? Yes when the
   * user has clearly moved elsewhere (home screen, recents, another app), so the pause never
   * sits on top of something else.
   */
  fun shouldDismiss(shownFor: String?, pkg: String?, ownPackage: String): Boolean {
    if (shownFor == null || pkg.isNullOrBlank()) return false
    if (pkg == shownFor || pkg == ownPackage) return false
    return pkg !in IGNORED_WHILE_SHOWING
  }
}
