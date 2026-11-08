package com.reclaim.gate

import android.content.Context
import android.content.SharedPreferences
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * On-device settings and counters for the mindful pause.
 * Stores only: on/off, chosen package names, labels, allow-minutes, an optional plan line,
 * and per-day counts of pauses shown / "not now" / "open anyway". No content, no timestamps
 * beyond the current allow window.
 */
class GateStore(context: Context) {
  private val prefs: SharedPreferences =
      context.applicationContext.getSharedPreferences("reclaim_gate", Context.MODE_PRIVATE)

  var enabled: Boolean
    get() = prefs.getBoolean("enabled", false)
    set(v) = prefs.edit().putBoolean("enabled", v).apply()

  var packages: Set<String>
    get() = prefs.getStringSet("packages", emptySet())?.toSet() ?: emptySet()
    set(v) = prefs.edit().putStringSet("packages", v).apply()

  var allowMinutes: Int
    get() = prefs.getInt("allowMinutes", 5)
    set(v) = prefs.edit().putInt("allowMinutes", v.coerceIn(1, 60)).apply()

  /** The user's own if-then plan, shown on the pause screen. */
  var plan: String
    get() = prefs.getString("plan", "") ?: ""
    set(v) = prefs.edit().putString("plan", v.take(160)).apply()

  /** Website pause: on/off and the user's sites ("reddit.com"). */
  var webEnabled: Boolean
    get() = prefs.getBoolean("webEnabled", false)
    set(v) = prefs.edit().putBoolean("webEnabled", v).apply()

  var sites: Set<String>
    get() = prefs.getStringSet("sites", emptySet())?.toSet() ?: emptySet()
    set(v) = prefs.edit().putStringSet("sites", v).apply()

  /** Reels counter: on/off and an optional daily limit (0 = no limit, just count). */
  var reelsEnabled: Boolean
    get() = prefs.getBoolean("reelsEnabled", false)
    set(v) = prefs.edit().putBoolean("reelsEnabled", v).apply()

  /** Show Pip with today's count floating over Shorts / Reels. */
  var reelBuddy: Boolean
    get() = prefs.getBoolean("reelBuddy", true)
    set(v) = prefs.edit().putBoolean("reelBuddy", v).apply()

  var reelLimit: Int
    get() = prefs.getInt("reelLimit", 0)
    set(v) = prefs.edit().putInt("reelLimit", v.coerceIn(0, 1000)).apply()

  fun addReel(pkg: String, now: Long = System.currentTimeMillis()): Int {
    count("reels_$pkg", now)
    return reelsOn(day(now))
  }

  /** Reels counted on a local date, total and per app. */
  fun reelsByApp(date: String): Map<String, Int> {
    val prefix = "c_${date}_reels_"
    return prefs.all
        .filter { it.key.startsWith(prefix) && it.value is Int }
        .map { it.key.removePrefix(prefix) to it.value as Int }
        .toMap()
  }

  fun reelsOn(date: String): Int = reelsByApp(date).values.sum()

  fun registerListener(l: SharedPreferences.OnSharedPreferenceChangeListener) =
      prefs.registerOnSharedPreferenceChangeListener(l)

  fun unregisterListener(l: SharedPreferences.OnSharedPreferenceChangeListener) =
      prefs.unregisterOnSharedPreferenceChangeListener(l)

  /**
   * Debug builds only: the last few scroll readings in supported apps (view id, class, index),
   * so reel detection can be checked on a phone even when logcat is unavailable.
   */
  fun addDiag(line: String) {
    val lines = (prefs.getString("diag", "") ?: "").split('\n').filter { it.isNotBlank() }
    prefs.edit().putString("diag", (lines + line.take(200)).takeLast(30).joinToString("\n")).apply()
  }

  /** Debug builds only: distinct view ids first seen in supported apps (ids only, no text). */
  fun addDiagId(id: String) {
    val set = prefs.getStringSet("diag_ids", emptySet())?.toMutableSet() ?: mutableSetOf()
    if (id in set || set.size >= 150) return
    set.add(id.take(120))
    prefs.edit().putStringSet("diag_ids", set).apply()
  }

  fun label(pkg: String): String? = prefs.getString("label_$pkg", null)

  fun setLabels(labels: Map<String, String>) {
    val e = prefs.edit()
    labels.forEach { (k, v) -> e.putString("label_$k", v.take(60)) }
    e.apply()
  }

  /** [pkg] is an app package, or a key like "web:reddit.com" or "reels". */
  fun allowedUntil(pkg: String): Long = prefs.getLong("allow_$pkg", 0L)

  fun allowFor(pkg: String, now: Long, minutes: Int = allowMinutes) {
    prefs.edit().putLong("allow_$pkg", now + minutes.coerceIn(1, 60) * 60_000L).apply()
  }

  /** How many times today the user opened [key] through a pause (Firm's daily budget). */
  fun opensToday(key: String, now: Long = System.currentTimeMillis()): Int =
      prefs.getInt("c_${day(now)}_opened_$key", 0)

  /** The intensity ladder, written by RECLAIM (see Intensity.kt). */
  var intensity: Intensity.Plan
    get() =
        Intensity.Plan(
            prefs.getInt("level", Intensity.GENTLE),
            prefs.getInt("pendingLevel", 0),
            prefs.getLong("pendingAt", 0L),
            prefs.getLong("strictUntil", 0L))
    set(p) =
        prefs.edit()
            .putInt("level", p.base)
            .putInt("pendingLevel", p.pendingLevel)
            .putLong("pendingAt", p.pendingAt)
            .putLong("strictUntil", p.strictUntil)
            .apply()

  fun count(kind: String, now: Long = System.currentTimeMillis()) {
    val key = "c_${day(now)}_$kind"
    prefs.edit().putInt(key, prefs.getInt(key, 0) + 1).apply()
  }

  fun countsFor(date: String): Triple<Int, Int, Int> =
      Triple(
          prefs.getInt("c_${date}_shown", 0),
          prefs.getInt("c_${date}_notnow", 0),
          prefs.getInt("c_${date}_opened", 0),
      )

  /** Remove daily counters older than [days] days. */
  fun prune(now: Long = System.currentTimeMillis(), days: Int = 60) {
    val cutoff = day(now - days * 86_400_000L) // yyyy-MM-dd compares correctly as text
    val e = prefs.edit()
    prefs.all.keys
        .filter { it.startsWith("c_") && (it.split("_").getOrNull(1) ?: "") < cutoff }
        .forEach { e.remove(it) }
    e.apply()
  }

  fun clearCounts() {
    val e = prefs.edit()
    prefs.all.keys.filter { it.startsWith("c_") }.forEach { e.remove(it) }
    e.apply()
  }

  companion object {
    fun day(t: Long): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(t))
  }
}
