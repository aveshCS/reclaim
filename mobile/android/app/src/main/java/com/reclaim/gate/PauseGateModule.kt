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

  /** Known at start-up, so onboarding can decide which steps to show. */
  override fun getConstants(): Map<String, Any> = mapOf("maker" to maker())

  private fun maker(): String {
    val m = android.os.Build.MANUFACTURER.lowercase()
    return when {
      m.contains("xiaomi") || m.contains("redmi") || m.contains("poco") -> "xiaomi"
      else -> m
    }
  }

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

  /**
   * Switched on in Settings, and actually running? Android lists only bound (running)
   * services here, so "enabled but not running" means the phone stopped it (Xiaomi does this
   * when RECLAIM is cleared from Recents with Autostart off).
   */
  @ReactMethod
  fun getServiceState(promise: Promise) {
    try {
      val enabled = serviceEnabled()
      val am = context.getSystemService(android.content.Context.ACCESSIBILITY_SERVICE)
          as android.view.accessibility.AccessibilityManager
      val me = ComponentName(context, PauseGateService::class.java).flattenToShortString()
      val running =
          am.getEnabledAccessibilityServiceList(
                  android.accessibilityservice.AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
              .any {
                val c = ComponentName.unflattenFromString(it.id)
                c != null && c.flattenToShortString() == me
              }
      val m = Arguments.createMap()
      m.putBoolean("enabled", enabled)
      m.putBoolean("running", running)
      m.putString("maker", maker())
      promise.resolve(m)
    } catch (e: Exception) {
      promise.reject("GATE_CHECK_FAILED", e)
    }
  }

  private fun launch(i: Intent): Boolean =
      try {
        val a = context.currentActivity
        if (a != null) a.startActivity(i)
        else context.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
      } catch (_: Exception) {
        false
      }

  private fun appDetails() =
      Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
          .setData(android.net.Uri.fromParts("package", context.packageName, null))

  /** Xiaomi's Autostart list (lets RECLAIM's pause restart); falls back to App info. */
  @ReactMethod
  fun openAutostartSettings(promise: Promise) {
    val miui =
        Intent().setComponent(
            ComponentName(
                "com.miui.securitycenter",
                "com.miui.permcenter.autostart.AutoStartManagementActivity"))
    promise.resolve(launch(miui) || launch(appDetails()))
  }

  /** App info, where Xiaomi shows "Battery saver" (choose "No restrictions"). */
  @ReactMethod
  fun openAppSettings(promise: Promise) {
    promise.resolve(launch(appDetails()))
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

  /** The intensity ladder (see Intensity.kt). Times are epoch ms; 0 = none. */
  @ReactMethod
  fun configureIntensity(
      base: Double,
      pendingLevel: Double,
      pendingAt: Double,
      strictUntil: Double,
      promise: Promise
  ) {
    try {
      GateStore(context).intensity =
          Intensity.Plan(
              base.toInt().coerceIn(Intensity.AWARE, Intensity.FIRM),
              pendingLevel.toInt(),
              pendingAt.toLong(),
              strictUntil.toLong())
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
