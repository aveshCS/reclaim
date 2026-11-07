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

  fun label(pkg: String): String? = prefs.getString("label_$pkg", null)

  fun setLabels(labels: Map<String, String>) {
    val e = prefs.edit()
    labels.forEach { (k, v) -> e.putString("label_$k", v.take(60)) }
    e.apply()
  }

  fun allowedUntil(pkg: String): Long = prefs.getLong("allow_$pkg", 0L)

  fun allowFor(pkg: String, now: Long) {
    prefs.edit().putLong("allow_$pkg", now + allowMinutes * 60_000L).apply()
  }

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

  /** Remove counters older than ~60 days. */
  fun prune(keepDates: Set<String>) {
    val e = prefs.edit()
    prefs.all.keys
        .filter { it.startsWith("c_") && it.split("_").getOrNull(1) !in keepDates }
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
