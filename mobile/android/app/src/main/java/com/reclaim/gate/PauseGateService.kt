package com.reclaim.gate

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import com.reclaim.BuildConfig

/**
 * Mindful pause, plus two optional features the user switches on separately.
 *
 * - App pause (always): learns only which app's window came to the front (event.packageName).
 * - Website pause (opt-in): in known browsers only, reads the address-bar text, reduces it to
 *   a site name and compares it with the user's list. Nothing about browsing is stored.
 * - Reels counter (opt-in): in YouTube and Instagram only, notices scrolls of the short-video
 *   pager (by view id) and adds one to a daily count. Nothing about the videos is read.
 *
 * With both options off the service asks Android only for window-change events, exactly as
 * before. It never performs actions inside other apps; the only system action is "Home" when
 * the user taps "Not now".
 */
class PauseGateService : AccessibilityService() {
  private companion object {
    const val TAG = "ReclaimPause"
    const val URL_CHECK_DELAY_MS = 500L
  }

  private lateinit var store: GateStore
  private var overlay: PauseOverlay? = null
  private var lastShownFor: String? = null
  private var lastShownAt = 0L
  /** Per pause key: ignore it until this time (set when the pause is dismissed). */
  private val quietUntil = HashMap<String, Long>()
  /** The app last seen full-screen (not RECLAIM or system pop-ups), and when. */
  private var lastFullPkg: String? = null
  private var lastFullAt = 0L
  private val reels = ReelTracker()
  private val handler = Handler(Looper.getMainLooper())
  private var urlCheckPending = false

  private val prefsListener =
      SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == "webEnabled" || key == "reelsEnabled") applyEventTypes()
        if ((key == "reelsEnabled" || key == "reelBuddy") && (!store.reelsEnabled || !store.reelBuddy)) {
          buddy.hide()
        }
      }

  private fun ensureReady(): PauseOverlay {
    if (!::store.isInitialized) store = GateStore(this)
    return overlay
        ?: PauseOverlay(this, store) { key ->
              quietUntil[key] = System.currentTimeMillis() + GateDecider.QUIET_AFTER_DISMISS_MS
              Log.d(TAG, "dismissed $key")
            }
            .also { overlay = it }
  }

  override fun onServiceConnected() {
    ensureReady()
    store.prune()
    store.registerListener(prefsListener)
    applyEventTypes()
  }

  /** Ask Android only for the events the switched-on features need. */
  private fun applyEventTypes() {
    val info = serviceInfo ?: return
    val web = store.webEnabled
    val reel = store.reelsEnabled
    var types = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
    if (web) types = types or AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
    // Reels: scrolls, plus redraws (YouTube Shorts sends no usable scroll events).
    if (reel) {
      types = types or AccessibilityEvent.TYPE_VIEW_SCROLLED or AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
    }
    info.eventTypes = types
    info.flags =
        if (web || reel) AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
        else AccessibilityServiceInfo.DEFAULT
    serviceInfo = info
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return
    val ov = ensureReady()
    val pkg = event.packageName?.toString() ?: return
    when (event.eventType) {
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> onWindowState(event, pkg, ov)
      AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
        if (store.webEnabled && WebMatcher.isBrowser(pkg)) scheduleUrlCheck()
        if (store.reelsEnabled && ReelTracker.supports(pkg)) scheduleReelScan(pkg)
      }
      AccessibilityEvent.TYPE_VIEW_SCROLLED ->
          if (store.reelsEnabled && ReelTracker.supports(pkg)) onScrolled(event, pkg, ov)
    }
  }

  private fun onWindowState(event: AccessibilityEvent, pkg: String, ov: PauseOverlay) {
    val now = System.currentTimeMillis()
    if (BuildConfig.DEBUG) Log.d(TAG, "event $pkg class=${event.className} full=${event.isFullScreen}")

    // Only a full-screen window from another app means "the user went elsewhere". Small windows
    // (Xiaomi's floating video toolbox, other apps' pop-ups) must not take the pause down or
    // reset it; on a POCO M4 Pro they did both. A chosen app's own events may still be small
    // (seen on stock Android), so they can still trigger the pause below.
    // The keyboard and system panels can claim to be full-screen; they never mean "left".
    if (GateDecider.isSystemWindow(pkg, event.className?.toString())) return
    val full = event.isFullScreen
    val otherApp = pkg != packageName

    // The user left (home, recents, another app): take the pause down so it never covers them.
    if (full && GateDecider.shouldDismiss(ov.showingFor, pkg, packageName)) {
      Log.d(TAG, "left to $pkg")
      ov.hide()
    }
    if (full && otherApp) {
      reels.endAllExcept(pkg)
      if (pkg != buddyFor) buddy.hide()
    }

    // Moving to an app that isn't chosen makes the next open of a chosen app a fresh one.
    if (full && otherApp && ov.showingFor == null && pkg !in store.packages) {
      lastShownFor = null
    }

    val realOpen = GateDecider.isRealOpen(full, pkg, lastFullPkg, lastFullAt, now)
    if (full && otherApp) {
      lastFullPkg = pkg
      lastFullAt = now
    }
    if (store.webEnabled && WebMatcher.isBrowser(pkg)) scheduleUrlCheck()
    if (!realOpen) return

    val cfg = GateDecider.Config(store.enabled, store.packages, packageName)
    val showing = ov.showingFor != null
    // The short quiet time after a dismissal only filters small leftover events; a full-screen
    // open (the user tapping the app again) always counts.
    val quiet = if (full) 0L else quietUntil[pkg] ?: 0L
    if (!GateDecider.shouldPause(
        cfg, pkg, now, store.allowedUntil(pkg), lastShownFor, lastShownAt, showing, quiet)) {
      return
    }
    if (!ov.show(ov.appPrompt(pkg))) return // never crash the service; the user sees their app
    Log.d(TAG, "pause shown for $pkg")
    lastShownFor = pkg
    lastShownAt = now
    store.count("shown", now)
  }

  // ---- Website pause -------------------------------------------------------------------

  /** Browsers fire many content events; check the address bar at most every half second. */
  private fun scheduleUrlCheck() {
    if (urlCheckPending) return
    urlCheckPending = true
    handler.postDelayed(
        {
          urlCheckPending = false
          try {
            checkUrl()
          } catch (_: Exception) {
            // Never crash the service over a browser's layout.
          }
        },
        URL_CHECK_DELAY_MS)
  }

  private fun checkUrl() {
    if (!store.webEnabled) return
    val ov = ensureReady()
    if (ov.showingFor != null) return
    val root = rootInActiveWindow ?: return
    val browser = root.packageName?.toString() ?: return
    val ids = WebMatcher.URL_BAR_IDS[browser] ?: return
    var text: String? = null
    for (id in ids) {
      val node = root.findAccessibilityNodeInfosByViewId(id).firstOrNull() ?: continue
      if (node.isFocused) return // the user is typing; wait until they go somewhere
      text = node.text?.toString()
      break
    }
    val site = WebMatcher.match(WebMatcher.hostOf(text), store.sites) ?: return
    val key = "web:$site"
    val now = System.currentTimeMillis()
    val cfg = GateDecider.Config(true, setOf(key), packageName)
    if (!GateDecider.shouldPause(
        cfg, key, now, store.allowedUntil(key), lastShownFor, lastShownAt, false, quietUntil[key] ?: 0L)) {
      return
    }
    if (!ov.show(ov.webPrompt(browser, site))) return
    Log.d(TAG, "pause shown for site")
    lastShownFor = key
    lastShownAt = now
    store.count("shown", now)
    store.count("web", now)
  }

  // ---- Reels counter -------------------------------------------------------------------

  private fun onScrolled(event: AccessibilityEvent, pkg: String, ov: PauseOverlay) {
    val source = event.source
    val id = source?.viewIdResourceName
    val now = System.currentTimeMillis()
    if (!ReelTracker.isReelPager(pkg, id)) return
    val height =
        source?.let {
          val r = android.graphics.Rect()
          it.getBoundsInScreen(r)
          r.height()
        } ?: 0
    val dy = if (android.os.Build.VERSION.SDK_INT >= 28) event.scrollDeltaY else -1
    // Prefer item positions, then scroll distance, then (last resort) spaced scroll bursts.
    val added =
        when {
          event.fromIndex >= 0 -> if (reels.onPagerScrolled(pkg, event.fromIndex)) 1 else 0
          dy != -1 && dy != 0 && height > 0 -> reels.onPagerDelta(pkg, dy, height)
          dy == 0 -> 0
          else -> if (reels.onPagerScrollBurst(pkg, now)) 1 else 0
        }
    if (BuildConfig.DEBUG) {
      val line = "${now % 100000} $id from=${event.fromIndex} dy=$dy h=$height +$added"
      Log.d(TAG, "scroll $line")
      store.addDiag(line)
    }
    if (added <= 0 || reels.tracksPages(pkg)) return // page tracking is more reliable when it works
    countReels(pkg, added, ov)
  }

  private fun countReels(pkg: String, added: Int, ov: PauseOverlay) {
    val now = System.currentTimeMillis()
    var total = 0
    repeat(added) { total = store.addReel(pkg, now) }
    if (BuildConfig.DEBUG) Log.d(TAG, "reel counted in $pkg, today $total")

    val limit = store.reelLimit
    if (limit <= 0 || total < limit || ov.showingFor != null) return
    if (now < store.allowedUntil("reels") || now < (quietUntil["reels"] ?: 0L)) return
    buddy.hide()
    if (ov.show(ov.reelsPrompt(pkg, total, limit))) {
      store.count("shown", now)
      store.count("reellimit", now)
    }
  }

  /** The short-video player redraws often; look at which page is in the middle at most 4x/s. */
  private var reelScanPending = false

  private fun scheduleReelScan(pkg: String) {
    if (reelScanPending) return
    reelScanPending = true
    handler.postDelayed(
        {
          reelScanPending = false
          try {
            scanReelPage(pkg)
          } catch (_: Exception) {
            // Never crash the service over an app's layout.
          }
        },
        250)
  }

  /**
   * Finds the short-video page view in the middle of the screen (by view id and position only,
   * never text) and counts a new reel when it is a different page than before.
   */
  private fun scanReelPage(pkg: String) {
    if (!store.reelsEnabled) return
    val ov = ensureReady()
    if (ov.showingFor != null) return
    val ids = ReelTracker.PAGE_IDS[pkg] ?: return
    val root = rootInActiveWindow ?: return
    if (root.packageName?.toString() != pkg) return
    val dm = resources.displayMetrics
    val cx = dm.widthPixels / 2
    val cy = dm.heightPixels / 2
    val r = android.graphics.Rect()
    for (id in ids) {
      val nodes = root.findAccessibilityNodeInfosByViewId(id)
      val mid =
          nodes.firstOrNull {
            it.getBoundsInScreen(r)
            it.isVisibleToUser && r.contains(cx, cy)
          } ?: continue
      val isNew = reels.onVisiblePage(pkg, mid.hashCode())
      if (BuildConfig.DEBUG) {
        store.addDiag("${System.currentTimeMillis() % 100000} page n=${nodes.size} key=${mid.hashCode()} new=$isNew")
      }
      if (isNew) countReels(pkg, 1, ov)
      showBuddy(pkg)
      return
    }
    // No short-video page on screen (e.g. back on the home feed): Pip steps away.
    buddy.hide()
  }

  // ---- Pip over Shorts / Reels -----------------------------------------------------------

  private val buddy by lazy { PipBuddy(this) }
  private var buddyFor: String? = null

  private fun showBuddy(pkg: String) {
    val ov = ensureReady()
    if (!store.reelBuddy || ov.showingFor != null) {
      buddy.hide()
      return
    }
    buddyFor = pkg
    buddy.show(store.reelsOn(GateStore.day(System.currentTimeMillis())), store.reelLimit)
  }

  override fun onInterrupt() {}

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    if (::store.isInitialized) store.unregisterListener(prefsListener)
    overlay?.hide()
    buddy.hide()
    super.onDestroy()
  }
}
