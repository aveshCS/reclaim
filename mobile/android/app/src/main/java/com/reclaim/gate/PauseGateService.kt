package com.reclaim.gate

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent

/**
 * Mindful pause. Uses the Accessibility API ONLY to learn which app's window came to the
 * front (event.packageName). It never reads window content (canRetrieveWindowContent=false
 * in the config), never performs actions in other apps, and stores nothing about what the
 * user does. Rule: if one of the user's chosen apps opens, show RECLAIM's pause screen.
 */
class PauseGateService : AccessibilityService() {
  private lateinit var store: GateStore
  private var lastShownFor: String? = null
  private var lastShownAt = 0L

  override fun onServiceConnected() {
    store = GateStore(this)
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    if (!::store.isInitialized) store = GateStore(this)
    val pkg = event.packageName?.toString() ?: return
    val now = System.currentTimeMillis()
    if (pkg != lastShownFor && pkg != packageName && lastShownFor != null && !PauseActivity.showing) {
      // User moved to a different app: the next open of a chosen app is a fresh one.
      if (pkg !in store.packages) lastShownFor = null
    }
    val cfg = GateDecider.Config(store.enabled, store.packages, packageName)
    if (!GateDecider.shouldPause(cfg, pkg, now, store.allowedUntil(pkg), lastShownFor, lastShownAt, PauseActivity.showing)) {
      return
    }
    // Leaving to the launcher or another app resets the debounce, so a real re-open pauses again.
    lastShownFor = pkg
    lastShownAt = now
    store.count("shown", now)
    val intent =
        Intent(this, PauseActivity::class.java)
            .putExtra(PauseActivity.EXTRA_PACKAGE, pkg)
            .addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_NO_ANIMATION or
                    Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
    try {
      startActivity(intent)
    } catch (_: Exception) {
      // Never crash the service; the user simply sees their app.
    }
  }

  override fun onInterrupt() {}
}
