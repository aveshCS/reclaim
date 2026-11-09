package com.reclaim.gate

import android.content.Context
import android.content.SharedPreferences
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * On-device settings and counters for the mindful pause.
 * Stores only: on/off, chosen package names, labels, allow-minutes, an optional plan line,
 * chosen sites, the intensity level, and per-day counts. No content, no browsing history.
 *
 * The pause service runs in its own process (":pause") so that clearing RECLAIM from Recents,
 * which some phones (e.g. Xiaomi HyperOS "SwipeUpClean") do by killing the app's process, does
 * not stop it. Two files keep the processes from overwriting each other:
 * - CONFIG ("reclaim_gate"): the user's choices. Written only by the app (PauseGateModule).
 * - STATS ("reclaim_gate_stats"): counts and "open for N min" windows. Written only by the
 *   service (the app writes it only to clear history on request).
 * Both are opened with MODE_MULTI_PROCESS so each process re-reads the file when the other
 * process has changed it.
 */
@Suppress("DEPRECATION") // MODE_MULTI_PROCESS: still honoured; the simplest fit for 2 processes.
class GateStore(context: Context) {
  private val ctx = context.applicationContext

  private val config: SharedPreferences
    get() = ctx.getSharedPreferences(CONFIG, Context.MODE_MULTI_PROCESS)

  private val stats: SharedPreferences
    get() = ctx.getSharedPreferences(STATS, Context.MODE_MULTI_PROCESS)

  // ---- Config (written by the app) -------------------------------------------------------

  var enabled: Boolean
    get() = config.getBoolean("enabled", false)
    set(v) = config.edit().putBoolean("enabled", v).apply()

  var packages: Set<String>
    get() = config.getStringSet("packages", emptySet())?.toSet() ?: emptySet()
    set(v) = config.edit().putStringSet("packages", v).apply()

  var allowMinutes: Int
    get() = config.getInt("allowMinutes", 5)
    set(v) = config.edit().putInt("allowMinutes", v.coerceIn(1, 60)).apply()

  /** The user's own if-then plan, shown on the pause screen. */
  var plan: String
    get() = config.getString("plan", "") ?: ""
    set(v) = config.edit().putString("plan", v.take(160)).apply()

  /** Website pause: on/off and the user's sites ("reddit.com"). */
  var webEnabled: Boolean
    get() = config.getBoolean("webEnabled", false)
    set(v) = config.edit().putBoolean("webEnabled", v).apply()

  var sites: Set<String>
    get() = config.getStringSet("sites", emptySet())?.toSet() ?: emptySet()
    set(v) = config.edit().putStringSet("sites", v).apply()

  /** Reels counter: on/off and an optional daily limit (0 = no limit, just count). */
  var reelsEnabled: Boolean
    get() = config.getBoolean("reelsEnabled", false)
    set(v) = config.edit().putBoolean("reelsEnabled", v).apply()

  /** Show Pip with today's count floating over Shorts / Reels. */
  var reelBuddy: Boolean
    get() = config.getBoolean("reelBuddy", true)
    set(v) = config.edit().putBoolean("reelBuddy", v).apply()

  var reelLimit: Int
    get() = config.getInt("reelLimit", 0)
    set(v) = config.edit().putInt("reelLimit", v.coerceIn(0, 1000)).apply()

  fun label(pkg: String): String? = config.getString("label_$pkg", null)

  fun setLabels(labels: Map<String, String>) {
    val e = config.edit()
    labels.forEach { (k, v) -> e.putString("label_$k", v.take(60)) }
    e.apply()
  }

  /** The intensity ladder, written by RECLAIM (see Intensity.kt). */
  var intensity: Intensity.Plan
    get() =
        config.let {
          Intensity.Plan(
              it.getInt("level", Intensity.GENTLE),
              it.getInt("pendingLevel", 0),
              it.getLong("pendingAt", 0L),
              it.getLong("strictUntil", 0L))
        }
    set(p) =
        config.edit()
            .putInt("level", p.base)
            .putInt("pendingLevel", p.pendingLevel)
            .putLong("pendingAt", p.pendingAt)
            .putLong("strictUntil", p.strictUntil)
            .apply()

  // ---- Stats (written by the service) ----------------------------------------------------

  fun addReel(pkg: String, now: Long = System.currentTimeMillis()): Int {
    count("reels_$pkg", now)
    return reelsOn(day(now))
  }

  /** Reels counted on a local date, total and per app. */
  fun reelsByApp(date: String): Map<String, Int> {
    val prefix = "c_${date}_reels_"
    return stats.all
        .filter { it.key.startsWith(prefix) && it.value is Int }
        .map { it.key.removePrefix(prefix) to it.value as Int }
        .toMap()
  }

  fun reelsOn(date: String): Int = reelsByApp(date).values.sum()

  /** [pkg] is an app package, or a key like "web:reddit.com" or "reels". */
  fun allowedUntil(pkg: String): Long = stats.getLong("allow_$pkg", 0L)

  fun allowFor(pkg: String, now: Long, minutes: Int = allowMinutes) {
    stats.edit().putLong("allow_$pkg", now + minutes.coerceIn(1, 60) * 60_000L).apply()
  }

  /** How many times today the user opened [key] through a pause (Firm's daily budget). */
  fun opensToday(key: String, now: Long = System.currentTimeMillis()): Int =
      stats.getInt("c_${day(now)}_opened_$key", 0)

  fun count(kind: String, now: Long = System.currentTimeMillis()) {
    val key = "c_${day(now)}_$kind"
    val s = stats
    s.edit().putInt(key, s.getInt(key, 0) + 1).apply()
  }

  fun countsFor(date: String): Triple<Int, Int, Int> =
      stats.let {
        Triple(
            it.getInt("c_${date}_shown", 0),
            it.getInt("c_${date}_notnow", 0),
            it.getInt("c_${date}_opened", 0),
        )
      }

  /** Remove daily counters older than [days] days. */
  fun prune(now: Long = System.currentTimeMillis(), days: Int = 60) {
    val cutoff = day(now - days * 86_400_000L) // yyyy-MM-dd compares correctly as text
    val s = stats
    val e = s.edit()
    s.all.keys
        .filter { it.startsWith("c_") && (it.split("_").getOrNull(1) ?: "") < cutoff }
        .forEach { e.remove(it) }
    e.apply()
  }

  fun clearCounts() {
    val s = stats
    val e = s.edit()
    s.all.keys.filter { it.startsWith("c_") }.forEach { e.remove(it) }
    e.apply()
  }

  /**
   * Debug builds only: the last few scroll readings in supported apps (view id, class, index),
   * so reel detection can be checked on a phone even when logcat is unavailable.
   */
  fun addDiag(line: String) {
    val s = stats
    val lines = (s.getString("diag", "") ?: "").split('\n').filter { it.isNotBlank() }
    s.edit().putString("diag", (lines + line.take(200)).takeLast(30).joinToString("\n")).apply()
  }

  /** Debug builds only: distinct view ids first seen in supported apps (ids only, no text). */
  fun addDiagId(id: String) {
    val s = stats
    val set = s.getStringSet("diag_ids", emptySet())?.toMutableSet() ?: mutableSetOf()
    if (id in set || set.size >= 150) return
    set.add(id.take(120))
    s.edit().putStringSet("diag_ids", set).apply()
  }

  /**
   * Older versions kept counts and allow windows in the config file. Copy them over once
   * (run by the service, the only writer of STATS). Old keys are left untouched.
   */
  fun migrateStatsOnce() {
    val s = stats
    if (s.getBoolean("migrated", false)) return
    val e = s.edit()
    for ((k, v) in config.all) {
      if (!(k.startsWith("c_") || k.startsWith("allow_"))) continue
      when (v) {
        is Int -> e.putInt(k, v)
        is Long -> e.putLong(k, v)
      }
    }
    e.putBoolean("migrated", true).apply()
  }

  companion object {
    const val CONFIG = "reclaim_gate"
    const val STATS = "reclaim_gate_stats"

    fun day(t: Long): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(t))
  }
}
