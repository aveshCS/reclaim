package com.reclaim.sound

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/** Pip's sound effects for the app (see SoundFx). */
@ReactModule(name = SoundModule.NAME)
class SoundModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {
  companion object {
    const val NAME = "ReclaimSound"
  }

  override fun getName() = NAME

  init {
    SoundFx.warmUp(context)
  }

  /** name: pop */
  @ReactMethod
  fun play(name: String) {
    SoundFx.play(context, "sfx_$name")
  }
}
