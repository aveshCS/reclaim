package com.reclaim.gate

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = PauseGateModule.NAME)
class PauseGateModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {
  companion object {
    const val NAME = "ReclaimPauseGate"
  }

  override fun getName() = NAME

  private fun serviceEnabled(): Boolean {
    val expected = ComponentName(context, PauseGateService::class.java)
    val enabled =
        Settings.Secure.getString(
            context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
            ?: return false
    val splitter = TextUtils.SimpleStringSplitter(':')
    splitter.setString(enabled)
    for (s in splitter) {
      val c = ComponentName.unflattenFromString(s)
      if (c != null && c == expected) return true
    }
    return false
  }

  @ReactMethod
  fun isServiceEnabled(promise: Promise) {
    try {
      promise.resolve(serviceEnabled())
    } catch (e: Exception) {
      promise.reject("GATE_CHECK_FAILED", e)
    }
  }

  @ReactMethod
  fun openAccessibilitySettings(promise: Promise) {
    try {
      val i = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
      val a = context.currentActivity
      if (a != null) a.startActivity(i)
      else context.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SETTINGS_OPEN_FAILED", e)
    }
  }

  /** packages: [{packageName, label}] */
  @ReactMethod
  fun configure(
      enabled: Boolean,
      packages: ReadableArray,
      allowMinutes: Double,
      plan: String,
      promise: Promise
  ) {
    try {
      val store = GateStore(context)
      val set = HashSet<String>()
      val labels = HashMap<String, String>()
      for (i in 0 until minOf(packages.size(), 50)) {
        val m = packages.getMap(i) ?: continue
        val p = m.getString("packageName") ?: continue
        if (p.isBlank() || p == context.packageName) continue
        set.add(p)
        labels[p] = m.getString("label") ?: p
      }
      store.packages = set
      store.setLabels(labels)
      store.allowMinutes = allowMinutes.toInt()
      store.plan = plan
      store.enabled = enabled
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("GATE_CONFIG_FAILED", e)
    }
  }

  /** Website pause and reels counter options. sites: ["reddit.com", ...] */
  @ReactMethod
  fun configureExtras(
      webEnabled: Boolean,
      sites: ReadableArray,
      reelsEnabled: Boolean,
      reelLimit: Double,
      showPip: Boolean,
      promise: Promise
  ) {
    try {
      val store = GateStore(context)
      val set = HashSet<String>()
      for (i in 0 until minOf(sites.size(), 100)) {
        val host = WebMatcher.hostOf(sites.getString(i)) ?: continue
        set.add(host)
      }
      store.sites = set
      store.reelLimit = reelLimit.toInt()
      store.reelBuddy = showPip
      // Write the switches last: the running service re-reads its event types when they change.
      store.webEnabled = webEnabled
      store.reelsEnabled = reelsEnabled
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("GATE_CONFIG_FAILED", e)
    }
  }

  /** Reels counted per local date: [{date, total, byApp: {pkg: n}}]. */
  @ReactMethod
  fun getReelStats(dates: ReadableArray, promise: Promise) {
    try {
      val store = GateStore(context)
      val out = Arguments.createArray()
      for (i in 0 until dates.size()) {
        val d = dates.getString(i) ?: continue
        val by = store.reelsByApp(d)
        val m = Arguments.createMap()
        m.putString("date", d)
        m.putInt("total", by.values.sum())
        val apps = Arguments.createMap()
        by.forEach { (k, v) -> apps.putInt(k, v) }
        m.putMap("byApp", apps)
        out.pushMap(m)
      }
      promise.resolve(out)
    } catch (e: Exception) {
      promise.reject("GATE_STATS_FAILED", e)
    }
  }

  /** Daily counts for the given local dates. */
  @ReactMethod
  fun getStats(dates: ReadableArray, promise: Promise) {
    try {
      val store = GateStore(context)
      val out = Arguments.createArray()
      val keep = HashSet<String>()
      for (i in 0 until dates.size()) {
        val d = dates.getString(i) ?: continue
        keep.add(d)
        val (shown, notNow, opened) = store.countsFor(d)
        val m = Arguments.createMap()
        m.putString("date", d)
        m.putInt("shown", shown)
        m.putInt("notNow", notNow)
        m.putInt("opened", opened)
        out.pushMap(m)
      }
      promise.resolve(out)
    } catch (e: Exception) {
      promise.reject("GATE_STATS_FAILED", e)
    }
  }

  @ReactMethod
  fun clearStats(promise: Promise) {
    GateStore(context).clearCounts()
    promise.resolve(true)
  }
}
