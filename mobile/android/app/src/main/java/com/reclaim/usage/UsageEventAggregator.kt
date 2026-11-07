package com.reclaim.usage

/**
 * Pure (Android-free) aggregation of foreground transitions into per-app
 * foreground time and "opens", so it can be unit-tested on the JVM.
 *
 * Definitions:
 * - An app is in the foreground while at least one of its activities is resumed.
 * - An "open" is a transition into the foreground from a different app, the launcher,
 *   or a screen-off/lock. Moving between activities of the same app is not an open, and
 *   neither is returning to the same app within [CONTINUATION_GAP_MS] of leaving it
 *   (activity recreation, permission dialogs, rotation).
 * - Screen off, keyguard and shutdown end any foreground interval.
 *
 * Limitations (documented, not hidden): Android only keeps detailed events for a limited
 * period (typically days), and an app already in the foreground at [rangeStart] is only
 * credited from [rangeStart]. Results are estimates of foreground time, not attention.
 */
object UsageEventAggregator {

  const val CONTINUATION_GAP_MS = 2_000L

  enum class Kind {
    RESUMED,
    PAUSED,
    SCREEN_OFF,
  }

  data class Event(
      val kind: Kind,
      val packageName: String?,
      val className: String?,
      val timeMs: Long,
  )

  data class AppUsage(val foregroundMs: Long, val opens: Int)

  fun aggregate(
      events: List<Event>,
      rangeStart: Long,
      rangeEnd: Long,
      include: Set<String>,
  ): Map<String, AppUsage> {
    require(rangeEnd >= rangeStart) { "rangeEnd must be >= rangeStart" }

    val time = HashMap<String, Long>()
    val opens = HashMap<String, Int>()
    val resumed = HashMap<String, MutableSet<String>>()

    var fg: String? = null
    var fgStart = 0L
    var lastPkg: String? = null
    var lastLeftAt = Long.MIN_VALUE
    var seenAny = false

    fun clamp(t: Long) = t.coerceIn(rangeStart, rangeEnd)

    fun close(at: Long) {
      val p = fg ?: return
      time[p] = (time[p] ?: 0L) + (at - fgStart).coerceAtLeast(0L)
      lastPkg = p
      lastLeftAt = at
      fg = null
    }

    for (e in events.sortedBy { it.timeMs }) {
      val t = clamp(e.timeMs)
      when (e.kind) {
        Kind.RESUMED -> {
          val p = e.packageName ?: continue
          resumed.getOrPut(p) { mutableSetOf() }.add(e.className ?: "")
          seenAny = true
          if (fg == p) continue
          if (fg != null) {
            // Another app came to the front without us seeing its pause.
            resumed[fg!!]?.clear()
            close(t)
          }
          val continuation = lastPkg == p && t - lastLeftAt <= CONTINUATION_GAP_MS
          if (!continuation) opens[p] = (opens[p] ?: 0) + 1
          fg = p
          fgStart = t
        }
        Kind.PAUSED -> {
          val p = e.packageName ?: continue
          if (!seenAny) {
            // The app was already in front when the range began: credit time, no open.
            time[p] = (time[p] ?: 0L) + (t - rangeStart)
            lastPkg = p
            lastLeftAt = t
            seenAny = true
            continue
          }
          seenAny = true
          val set = resumed[p]
          set?.remove(e.className ?: "")
          if (fg == p && (set == null || set.isEmpty())) close(t)
        }
        Kind.SCREEN_OFF -> {
          seenAny = true
          resumed.values.forEach { it.clear() }
          close(t)
          // A screen-off always ends the session: coming back is a new open.
          lastPkg = null
        }
      }
    }
    close(rangeEnd)

    return include.associateWith { p -> AppUsage(time[p] ?: 0L, opens[p] ?: 0) }
  }
}
