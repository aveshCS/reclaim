package com.reclaim.sound

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.SoundPool

/**
 * Pip's sound effects (for now just the pop when you tap Pip), generated in code
 * (mobile/scripts/make_sounds.py). Quiet, and silent whenever the phone is on silent or
 * vibrate.
 */
object SoundFx {
  val NAMES = listOf("sfx_pop")
  private const val VOLUME = 0.55f

  private var pool: SoundPool? = null
  private val ids = HashMap<String, Int>()
  private val loaded = HashSet<Int>()
  private var pending: String? = null

  @Synchronized
  private fun ensure(ctx: Context): SoundPool {
    pool?.let { return it }
    val p =
        SoundPool.Builder()
            .setMaxStreams(3)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build())
            .build()
    p.setOnLoadCompleteListener { sp, id, status ->
      if (status != 0) return@setOnLoadCompleteListener
      loaded.add(id)
      val want = pending
      if (want != null && ids[want] == id) {
        pending = null
        sp.play(id, VOLUME, VOLUME, 1, 0, 1f)
      }
    }
    val app = ctx.applicationContext
    for (n in NAMES) {
      val res = app.resources.getIdentifier(n, "raw", app.packageName)
      if (res != 0) ids[n] = p.load(app, res, 1)
    }
    pool = p
    return p
  }

  /** Respect the phone: no sound in silent or vibrate mode. */
  fun phoneAllowsSound(ctx: Context): Boolean {
    val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    return am.ringerMode == AudioManager.RINGER_MODE_NORMAL
  }

  fun play(ctx: Context, name: String) {
    try {
      if (!phoneAllowsSound(ctx)) return
      val p = ensure(ctx)
      val id = ids[name] ?: return
      if (id in loaded) p.play(id, VOLUME, VOLUME, 1, 0, 1f) else pending = name
    } catch (_: Exception) {
      // Sound is a nicety; never let it break anything.
    }
  }

  /** Load the sounds early so the first one plays on time. */
  fun warmUp(ctx: Context) {
    try {
      ensure(ctx)
    } catch (_: Exception) {}
  }
}
