package com.reclaim.gate

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
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

  /** Settings live in another process; re-read them at most once a second (and every 5 s). */
  private var lastConfigCheck = 0L
  private var appliedWeb: Boolean? = null
  private var appliedReels: Boolean? = null

  private fun watchConfig(force: Boolean = false) {
    val now = System.currentTimeMillis()
    if (!force && now - lastConfigCheck < 1_000) return
    lastConfigCheck = now
    val web = store.webEnabled
    val reel = store.reelsEnabled
    if (web != appliedWeb || reel != appliedReels) {
      appliedWeb = web
      appliedReels = reel
      applyEventTypes()
    }
    if (!reel || !store.reelBuddy) buddy.hide()
  }

  private val tick =
      object : Runnable {
        override fun run() {
          try {
            watchConfig()
          } catch (_: Exception) {}
          handler.postDelayed(this, 5_000)
        }
      }

  private fun ensureReady(): PauseOverlay {
    if (!::store.isInitialized) store = GateStore(this)
    return overlay
        ?: PauseOverlay(this, store) { key ->
              quietUntil[key] = System.currentTimeMillis() + GateDecider.QUIET_AFTER_DISMISS_MS
              Log.d(TAG, "dismissed $key")
              // A browser can be both a chosen app and showing a chosen site. While the app pause
              // was up the site check was skipped, and a loaded page sends no more events, so
              // check the address bar now (after "Open Brave", for example).
              if (store.webEnabled || store.reelsEnabled) scheduleUrlCheck()
            }
            .also { overlay = it }
  }

  override fun onServiceConnected() {
    ensureReady()
    store.migrateStatsOnce()
    store.prune()
    watchConfig(force = true)
    handler.postDelayed(tick, 5_000)
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
    watchConfig()
    val pkg = event.packageName?.toString() ?: return
    when (event.eventType) {
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> onWindowState(event, pkg, ov)
      AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
        if ((store.webEnabled || store.reelsEnabled) && WebMatcher.isBrowser(pkg)) scheduleUrlCheck()
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
    if ((store.webEnabled || store.reelsEnabled) && WebMatcher.isBrowser(pkg)) scheduleUrlCheck()
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
    val level = level(now)
    if (level == Intensity.AWARE) return // count-only: no pauses
    val prompt = ov.appPrompt(pkg, level, lockedReason(pkg, level, now))
    if (!ov.show(prompt)) return // never crash the service; the user sees their app
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
    if (!store.webEnabled && !store.reelsEnabled) return
    val ov = ensureReady()
    if (ov.showingFor != null) return
    val root = rootInActiveWindow
    val browser = root?.packageName?.toString()
    val ids = WebMatcher.URL_BAR_IDS[browser]
    if (root == null || browser == null || ids == null) {
      if (BuildConfig.DEBUG) store.addDiag("${System.currentTimeMillis() % 100000} web root=$browser")
      return
    }
    var text: String? = null
    var focused = false
    for (id in ids) {
      val node = root.findAccessibilityNodeInfosByViewId(id).firstOrNull() ?: continue
      focused = node.isFocused
      text = node.text?.toString()
      break
    }
    if (BuildConfig.DEBUG) {
      // Site name only, never the full address.
      store.addDiag(
          "${System.currentTimeMillis() % 100000} web $browser found=${text != null} focused=$focused host=${WebMatcher.hostOf(text)} short=${WebMatcher.shortVideo(text)?.site}")
    }
    if (focused) return // the user is typing; wait until they go somewhere
    if (store.reelsEnabled) browserReels(browser, text, ov)
    if (!store.webEnabled || ov.showingFor != null) return
    val site = WebMatcher.match(WebMatcher.hostOf(text), store.sites) ?: return
    val key = "web:$site"
    val now = System.currentTimeMillis()
    val cfg = GateDecider.Config(true, setOf(key), packageName)
    if (!GateDecider.shouldPause(
        cfg, key, now, store.allowedUntil(key), lastShownFor, lastShownAt, false, quietUntil[key] ?: 0L)) {
      return
    }
    val level = level(now)
    if (level == Intensity.AWARE) return
    if (!ov.show(ov.webPrompt(browser, site, level, lockedReason(key, level, now)))) return
    Log.d(TAG, "pause shown for site")
    lastShownFor = key
    lastShownAt = now
    store.count("shown", now)
    store.count("web", now)
  }

  /**
   * Shorts / Reels in a browser: each new video ID in the address (youtube.com/shorts/ID,
   * instagram.com/reel/ID, ...) is one reel. Only compared, never stored.
   */
  private fun browserReels(browser: String, text: String?, ov: PauseOverlay) {
    val sv = WebMatcher.shortVideo(text)
    if (sv == null) {
      if (buddyFor == browser) buddyMiss()
      return
    }
    if (strictReels(browser, ov)) return
    if (reels.onVisiblePage(browser, (sv.site + "/" + sv.id).hashCode())) countReels(browser, 1, ov)
    if (ov.showingFor == null) showBuddy(browser)
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
    val level = level(now)
    if (level == Intensity.AWARE || limit <= 0 || total < limit || ov.showingFor != null) return
    if (now < store.allowedUntil("reels") || now < (quietUntil["reels"] ?: 0L)) return
    buddy.hide()
    val prompt =
        lockedReason("reels", level, now)?.let { ov.reelsLockedPrompt(pkg, it) }
            ?: ov.reelsPrompt(pkg, total, limit, level)
    if (ov.show(prompt)) {
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
      if (strictReels(pkg, ov)) return
      if (isNew) countReels(pkg, 1, ov)
      showBuddy(pkg)
      return
    }
    // No short-video page in the middle right now. Mid-swipe this happens for a split second,
    // so Pip only steps away after a real gap (e.g. back on the home feed).
    buddyMiss()
  }

  /** Strict mode: Shorts / Reels themselves are paused (with the same emergency unlock). */
  private fun strictReels(pkg: String, ov: PauseOverlay): Boolean {
    val now = System.currentTimeMillis()
    if (level(now) != Intensity.STRICT) return false
    if (now < store.allowedUntil("reels") || now < (quietUntil["reels"] ?: 0L)) return false
    buddy.hide()
    val reason = lockedReason("reels", Intensity.STRICT, now) ?: return false
    if (ov.show(ov.reelsLockedPrompt(pkg, reason))) store.count("shown", now)
    return true
  }

  // ---- Intensity -------------------------------------------------------------------------

  private fun level(now: Long) = Intensity.effective(store.intensity, now)

  /** Why this is locked right now (Strict, or Firm's daily opens used up), or null. */
  private fun lockedReason(key: String, level: Int, now: Long): String? =
      when {
        level == Intensity.STRICT -> "Strict mode is on until ${whenText(store.intensity.strictUntil, now)}."
        Intensity.overBudget(level, store.opensToday(key, now)) ->
            "You've used today's ${Intensity.FIRM_DAILY_OPENS} opens. It opens again tomorrow."
        else -> null
      }

  private fun whenText(t: Long, now: Long): String {
    val sameDay = GateStore.day(t) == GateStore.day(now)
    val f = java.text.SimpleDateFormat(if (sameDay) "h:mm a" else "EEE d MMM, h:mm a", java.util.Locale.getDefault())
    return f.format(java.util.Date(t))
  }

  // ---- Pip over Shorts / Reels -----------------------------------------------------------

  private val buddy by lazy { PipBuddy(this) }
  private var buddyFor: String? = null
  private var lastPageSeenAt = 0L
  private val buddyGraceMs = 1_500L
  private val buddyHideCheck = Runnable {
    if (System.currentTimeMillis() - lastPageSeenAt >= buddyGraceMs) buddy.hide()
  }

  private fun buddyMiss() {
    if (!buddy.isShowing) return
    handler.removeCallbacks(buddyHideCheck)
    handler.postDelayed(buddyHideCheck, buddyGraceMs)
  }

  private fun showBuddy(pkg: String) {
    val ov = ensureReady()
    if (!store.reelBuddy || ov.showingFor != null) {
      buddy.hide()
      return
    }
    buddyFor = pkg
    lastPageSeenAt = System.currentTimeMillis()
    handler.removeCallbacks(buddyHideCheck)
    buddy.show(store.reelsOn(GateStore.day(System.currentTimeMillis())), store.reelLimit)
  }

  override fun onInterrupt() {}

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    overlay?.hide()
    buddy.hide()
    super.onDestroy()
  }
}
