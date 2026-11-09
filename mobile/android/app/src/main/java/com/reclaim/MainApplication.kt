package com.reclaim

import android.app.Application
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // RECLAIM's own native modules (Usage Access bridge).
          add(ReclaimPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // The pause service runs in its own small ":pause" process and needs no React Native.
    // Keeping that process light also makes it less likely to be cleared by the phone.
    if (isPauseProcess()) return
    loadReactNative(this)
  }

  private fun isPauseProcess(): Boolean {
    val name =
        if (Build.VERSION.SDK_INT >= 28) {
          Application.getProcessName()
        } else {
          try {
            java.io.File("/proc/self/cmdline").readText().trim('\u0000', ' ')
          } catch (_: Exception) {
            ""
          }
        }
    return name.endsWith(":pause")
  }
}
