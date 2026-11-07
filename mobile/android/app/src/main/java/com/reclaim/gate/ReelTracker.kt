package com.reclaim.gate

/**
 * Counts short videos (Reels, Shorts) the user moves past. Pure (JVM-testable).
 *
 * RECLAIM only looks at scroll events whose source is the app's short-video pager (matched by
 * view id) and counts each time the pager moves forward to a new item. Nothing about the
 * videos themselves is read or stored, only the number.
 */
class ReelTracker {
  companion object {
    /**
     * View ids of the vertical short-video pagers. These change with app updates, so they must
     * be re-checked on a real device. Facebook and Snapchat hide their ids, so they are not
     * supported.
     */
    val REEL_PAGER_IDS: Map<String, Set<String>> =
        mapOf(
            "com.google.android.youtube" to
                setOf(
                    "com.google.android.youtube:id/reel_recycler",
                    "com.google.android.youtube:id/reel_player_page_container",
                    "com.google.android.youtube:id/reel_watch_player"),
            "com.instagram.android" to
                setOf(
                    "com.instagram.android:id/clips_viewer_view_pager",
                    "com.instagram.android:id/clips_viewer_pager",
                    "com.instagram.android:id/clips_video_container"),
        )

    /**
     * View ids of one short-video page (one Short / Reel). Each swipe brings a different page
     * view to the middle of the screen. Verified for YouTube on a POCO M4 Pro, 2026-11-08:
     * YouTube Shorts sends no usable scroll events, but its page containers change.
     */
    val PAGE_IDS: Map<String, List<String>> =
        mapOf(
            "com.google.android.youtube" to
                listOf("com.google.android.youtube:id/reel_player_page_container"),
            "com.instagram.android" to
                listOf(
                    "com.instagram.android:id/clips_video_container",
                    "com.instagram.android:id/clips_viewer_video_layout"),
        )

    fun supports(pkg: String?): Boolean = pkg != null && pkg in REEL_PAGER_IDS

    /** Fallback: the short-video views of each app share a word in their ids. */
    private val ID_WORD = mapOf("com.google.android.youtube" to "reel", "com.instagram.android" to "clips")

    fun isReelPager(pkg: String, viewId: String?): Boolean {
      if (viewId == null) return false
      if (REEL_PAGER_IDS[pkg]?.contains(viewId) == true) return true
      val word = ID_WORD[pkg] ?: return false
      return viewId.startsWith("$pkg:id/") && viewId.substringAfter(":id/").contains(word)
    }
  }

  private val furthest = HashMap<String, Int>()
  private val offset = HashMap<String, Long>()
  private val furthestPage = HashMap<String, Int>()
  private val lastCountAt = HashMap<String, Long>()
  private val sessionStart = HashMap<String, Long>()
  private val visiblePage = HashMap<String, Int>()

  /**
   * The page view now in the middle of the short-video player, identified only by which view
   * it is ([pageKey]), never by what it shows. A different page than before means the user
   * moved to another Short. The first page of a visit isn't counted.
   */
  fun onVisiblePage(pkg: String, pageKey: Int): Boolean {
    val prev = visiblePage.put(pkg, pageKey)
    return prev != null && prev != pageKey
  }

  /** True once page tracking works for [pkg] in this visit; scroll-based counting then stops. */
  fun tracksPages(pkg: String): Boolean = pkg in visiblePage

  /**
   * YouTube reports Shorts scrolls without item positions (fromIndex = -1), but with the scroll
   * distance. Each Short fills the pager, so the page reached is distance / pager height.
   * Returns how many new reels were reached (usually 0 or 1).
   */
  fun onPagerDelta(pkg: String, dy: Int, pageHeight: Int): Int {
    if (pageHeight <= 0) return 0
    val off = (offset[pkg] ?: 0L) + dy
    offset[pkg] = off
    val page = Math.round(off.toDouble() / pageHeight).toInt()
    val prev = furthestPage[pkg] ?: 0
    if (page <= prev) return 0
    furthestPage[pkg] = page
    return page - prev
  }

  /**
   * Last resort when an app reports neither positions nor distances: one reel per scroll burst,
   * at most one per [gapMs], ignoring the first moments of a visit (the pager settling).
   */
  fun onPagerScrollBurst(pkg: String, now: Long, gapMs: Long = 1_200, settleMs: Long = 1_500): Boolean {
    val start = sessionStart.getOrPut(pkg) { now }
    if (now - start < settleMs) return false
    val last = lastCountAt[pkg] ?: 0L
    if (now - last < gapMs) return false
    lastCountAt[pkg] = now
    return true
  }

  /**
   * A scroll on the short-video pager of [pkg], with the first visible item index. Returns
   * true when it reached an item further than any seen in this viewing session: one new reel.
   * Scrolling back and forth over the same reels doesn't count again.
   */
  fun onPagerScrolled(pkg: String, fromIndex: Int): Boolean {
    if (fromIndex < 0) return false
    val prev = furthest[pkg]
    if (prev == null) {
      furthest[pkg] = fromIndex
      return false
    }
    if (fromIndex > prev) {
      furthest[pkg] = fromIndex
      return true
    }
    if (fromIndex + 50 < prev) {
      // The list was rebuilt (e.g. a fresh Shorts feed); start a new session.
      furthest[pkg] = fromIndex
    }
    return false
  }

  /** The user left the app: the next visit starts a new viewing session. */
  fun endSession(pkg: String) {
    for (m in listOf(furthest, offset, furthestPage, lastCountAt, sessionStart, visiblePage)) m.remove(pkg)
  }

  fun endAllExcept(pkg: String?) {
    for (m in listOf(furthest, offset, furthestPage, lastCountAt, sessionStart, visiblePage)) {
      m.keys.retainAll { it == pkg }
    }
  }
}
