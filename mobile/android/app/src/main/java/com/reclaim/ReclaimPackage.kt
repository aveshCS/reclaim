package com.reclaim

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.reclaim.auth.GoogleSignInModule
import com.reclaim.auth.SecureStoreModule
import com.reclaim.gate.PauseGateModule
import com.reclaim.sound.SoundModule

/** Registers RECLAIM's own native modules (legacy module API, loaded via the new-arch interop layer). */
class ReclaimPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      when (name) {
        UsageStatsModule.NAME -> UsageStatsModule(reactContext)
        PauseGateModule.NAME -> PauseGateModule(reactContext)
        SoundModule.NAME -> SoundModule(reactContext)
        GoogleSignInModule.NAME -> GoogleSignInModule(reactContext)
        SecureStoreModule.NAME -> SecureStoreModule(reactContext)
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
            ),
        SoundModule.NAME to
            ReactModuleInfo(
                name = SoundModule.NAME,
                className = SoundModule::class.java.name,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                isTurboModule = false,
            ),
        GoogleSignInModule.NAME to
            ReactModuleInfo(
                name = GoogleSignInModule.NAME,
                className = GoogleSignInModule::class.java.name,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                isTurboModule = false,
            ),
        SecureStoreModule.NAME to
            ReactModuleInfo(
                name = SecureStoreModule.NAME,
                className = SecureStoreModule::class.java.name,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                isTurboModule = false,
            ))
  }
}
