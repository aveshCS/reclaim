package com.reclaim

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.module.annotations.ReactModule
import com.reclaim.usage.UsageEventAggregator
import com.reclaim.usage.UsageEventAggregator.Event
import com.reclaim.usage.UsageEventAggregator.Kind

/**
 * Android Usage Access bridge.
 *
 * Privacy rules enforced here (not in JS):
 * - Only the package names the user selected are ever returned for usage data.
 * - RECLAIM itself is excluded.
 * - Only foreground time and open counts are computed. No notifications, messages,
 *   screen content, keystrokes or browsing data are read; Usage Access does not expose them.
 * - Data is read on demand when JS asks; there is no background collection.
 */
@ReactModule(name = UsageStatsModule.NAME)
class UsageStatsModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

  companion object {
    const val NAME = "ReclaimUsageStats"
    /** Longest range we accept in one call. Android keeps detailed events only for days. */
    const val MAX_RANGE_MS = 31L * 24 * 60 * 60 * 1000
    const val MAX_PACKAGES = 200

    // UsageEvents.Event constants that are not available at minSdk 24.
    private const val ACTIVITY_STOPPED = 23
    private const val SCREEN_NON_INTERACTIVE = 16
    private const val KEYGUARD_SHOWN = 17
    private const val DEVICE_SHUTDOWN = 26
  }

  override fun getName() = NAME

  private fun hasAccess(): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          appOps.unsafeCheckOpNoThrow(
              AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        } else {
          @Suppress("DEPRECATION")
          appOps.checkOpNoThrow(
              AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        }
    return if (mode == AppOpsManager.MODE_DEFAULT) {
      context.checkCallingOrSelfPermission(android.Manifest.permission.PACKAGE_USAGE_STATS) ==
          PackageManager.PERMISSION_GRANTED
    } else {
      mode == AppOpsManager.MODE_ALLOWED
    }
  }

  @ReactMethod
  fun hasUsageAccess(promise: Promise) {
    try {
      promise.resolve(hasAccess())
    } catch (e: Exception) {
      promise.reject("USAGE_ACCESS_CHECK_FAILED", e)
    }
  }

  @ReactMethod
  fun openUsageAccessSettings(promise: Promise) {
    val activity = context.currentActivity
    val starter: (Intent) -> Unit = { intent ->
      if (activity != null) activity.startActivity(intent)
      else context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    try {
      // Many devices open RECLAIM's own row directly with a package URI; fall back to the list.
      try {
        starter(
            Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
                .setData(Uri.parse("package:${context.packageName}")))
      } catch (e: Exception) {
        starter(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SETTINGS_OPEN_FAILED", e)
    }
  }

  /**
   * Apps that appear in the launcher (needs the launcher <queries> entry in the manifest on
   * Android 11+). No broad QUERY_ALL_PACKAGES permission is used. Nothing is pre-labelled.
   */
  @ReactMethod
  fun getLaunchableApps(promise: Promise) {
    try {
      val pm = context.packageManager
      val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      val infos =
          if (Build.VERSION.SDK_INT >= 33) {
            pm.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(0L))
          } else {
            @Suppress("DEPRECATION") pm.queryIntentActivities(intent, 0)
          }
      val seen = HashSet<String>()
      val result = Arguments.createArray()
      infos
          .mapNotNull { info ->
            val pkg = info.activityInfo?.packageName ?: return@mapNotNull null
            if (pkg == context.packageName || !seen.add(pkg)) return@mapNotNull null
            pkg to info.loadLabel(pm).toString()
          }
          .sortedBy { it.second.lowercase() }
          .forEach { (pkg, label) ->
            val item = Arguments.createMap()
            item.putString("packageName", pkg)
            item.putString("label", label)
            result.pushMap(item)
          }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("APP_LIST_FAILED", e)
    }
  }

  /**
   * Foreground time and opens for the given packages over [startMillis, endMillis].
   * endMillis is clamped to now. Packages not in the list are never returned.
   */
  @ReactMethod
  fun getUsageSummary(
      startMillis: Double,
      endMillis: Double,
      packageNames: ReadableArray,
      promise: Promise
  ) {
    try {
      val now = System.currentTimeMillis()
      val start = startMillis.toLong()
      val end = minOf(endMillis.toLong(), now)
      if (start <= 0 || end <= start) {
        promise.reject("INVALID_RANGE", "End must be after start.")
        return
      }
      if (end - start > MAX_RANGE_MS) {
        promise.reject("RANGE_TOO_LONG", "Ask for at most 31 days at a time.")
        return
      }
      if (packageNames.size() > MAX_PACKAGES) {
        promise.reject("TOO_MANY_APPS", "Ask for at most $MAX_PACKAGES apps at a time.")
        return
      }
      if (!hasAccess()) {
        promise.reject("USAGE_ACCESS_NOT_GRANTED", "Usage Access is not enabled for RECLAIM.")
        return
      }

      val include = HashSet<String>()
      for (i in 0 until packageNames.size()) {
        val p = packageNames.getString(i)
        if (!p.isNullOrBlank() && p != context.packageName) include.add(p)
      }

      val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val events = ArrayList<Event>()
      var earliest = Long.MAX_VALUE
      val raw = manager.queryEvents(start, end)
      val e = UsageEvents.Event()
      while (raw != null && raw.hasNextEvent()) {
        raw.getNextEvent(e)
        val kind =
            when (e.eventType) {
              UsageEvents.Event.MOVE_TO_FOREGROUND -> Kind.RESUMED // == ACTIVITY_RESUMED
              UsageEvents.Event.MOVE_TO_BACKGROUND,
              ACTIVITY_STOPPED -> Kind.PAUSED // MOVE_TO_BACKGROUND == ACTIVITY_PAUSED
              SCREEN_NON_INTERACTIVE,
              KEYGUARD_SHOWN,
              DEVICE_SHUTDOWN -> Kind.SCREEN_OFF
              else -> null
            } ?: continue
        if (e.timeStamp < earliest) earliest = e.timeStamp
        events.add(Event(kind, e.packageName, e.className, e.timeStamp))
      }

      val usage = UsageEventAggregator.aggregate(events, start, end, include)
      val apps = Arguments.createArray()
      usage.forEach { (pkg, u) ->
        val item = Arguments.createMap()
        item.putString("packageName", pkg)
        item.putDouble("foregroundMs", u.foregroundMs.toDouble())
        item.putInt("openCount", u.opens)
        apps.pushMap(item)
      }
      val out = Arguments.createMap()
      out.putDouble("rangeStartMs", start.toDouble())
      out.putDouble("rangeEndMs", end.toDouble())
      out.putString("source", "android_usage_events")
      out.putInt("eventCount", events.size)
      if (earliest != Long.MAX_VALUE) out.putDouble("earliestEventMs", earliest.toDouble())
      out.putArray("apps", apps)
      promise.resolve(out)
    } catch (e: SecurityException) {
      promise.reject("USAGE_ACCESS_NOT_GRANTED", e)
    } catch (e: Exception) {
      promise.reject("USAGE_QUERY_FAILED", e)
    }
  }
}
