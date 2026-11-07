package com.reclaim

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.reclaim.gate.PauseGateModule

/** Registers RECLAIM's own native modules (legacy module API, loaded via the new-arch interop layer). */
class ReclaimPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      when (name) {
        UsageStatsModule.NAME -> UsageStatsModule(reactContext)
        PauseGateModule.NAME -> PauseGateModule(reactContext)
        else -> null
      }

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
        UsageStatsModule.NAME to
            ReactModuleInfo(
                name = UsageStatsModule.NAME,
                className = UsageStatsModule::class.java.name,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                isTurboModule = false,
            ),
        PauseGateModule.NAME to
            ReactModuleInfo(
                name = PauseGateModule.NAME,
                className = PauseGateModule::class.java.name,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                isTurboModule = false,
            ))
  }
}
