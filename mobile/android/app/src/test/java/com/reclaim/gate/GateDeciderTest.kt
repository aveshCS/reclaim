package com.reclaim.gate

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GateDeciderTest {
  private val IG = "com.instagram.android"
  private val cfg = GateDecider.Config(true, setOf(IG), "com.reclaim")

  @Test
  fun `pauses a chosen app`() {
    assertTrue(GateDecider.shouldPause(cfg, IG, 10_000, 0, null, 0))
  }

  @Test
  fun `never pauses when off, for other apps, or for RECLAIM itself`() {
    assertFalse(GateDecider.shouldPause(cfg.copy(enabled = false), IG, 10_000, 0, null, 0))
    assertFalse(GateDecider.shouldPause(cfg, "com.whatsapp", 10_000, 0, null, 0))
    assertFalse(GateDecider.shouldPause(cfg.copy(packages = setOf("com.reclaim")), "com.reclaim", 10_000, 0, null, 0))
    assertFalse(GateDecider.shouldPause(cfg, null, 10_000, 0, null, 0))
  }

  @Test
  fun `respects the open-anyway window`() {
    assertFalse(GateDecider.shouldPause(cfg, IG, 10_000, 20_000, null, 0))
    assertTrue(GateDecider.shouldPause(cfg, IG, 30_000, 20_000, null, 0))
  }

  @Test
  fun `debounces repeated events for the same app during launch`() {
    assertFalse(GateDecider.shouldPause(cfg, IG, 10_000, 0, IG, 9_000))
    assertFalse(GateDecider.shouldPause(cfg, IG, 20_000, 0, IG, 9_000))
    assertTrue(GateDecider.shouldPause(cfg, IG, 30_000, 0, IG, 9_000))
    // A different app was last: no debounce.
    assertTrue(GateDecider.shouldPause(cfg, IG, 10_000, 0, null, 9_000))
  }

  @Test
  fun `never stacks a second pause while one is showing`() {
    assertFalse(GateDecider.shouldPause(cfg, IG, 10_000, 0, null, 0, pauseShowing = true))
  }

  @Test
  fun `ignores late events right after the pause is dismissed`() {
    // e.g. "Not now" -> home screen resets the debounce, then the app sends one more event.
    assertFalse(GateDecider.shouldPause(cfg, IG, 10_000, 0, null, 0, quietUntil = 12_000))
    assertTrue(GateDecider.shouldPause(cfg, IG, 13_000, 0, null, 0, quietUntil = 12_000))
  }

  @Test
  fun `a small leftover event right after reaching home is not a real open`() {
    val home = "com.miui.home"
    // Full-screen open always counts.
    assertTrue(GateDecider.isRealOpen(true, IG, home, 10_000, 10_100))
    // Small event 0.3 s after the home screen appeared: leftover, ignore.
    assertFalse(GateDecider.isRealOpen(false, IG, home, 10_000, 10_300))
    // Small event after being on home for a while (stock Android open): counts.
    assertTrue(GateDecider.isRealOpen(false, IG, home, 10_000, 12_000))
    // Small event while already in the app, or with nothing seen yet: counts.
    assertTrue(GateDecider.isRealOpen(false, IG, IG, 10_000, 10_100))
    assertTrue(GateDecider.isRealOpen(false, IG, null, 0, 10_100))
  }

  @Test
  fun `keyboard and system panels are not the user leaving`() {
    assertTrue(GateDecider.isSystemWindow("com.google.android.inputmethod.latin", "android.inputmethodservice.SoftInputWindow"))
    assertTrue(GateDecider.isSystemWindow("miui.systemui.plugin", "com.android.systemui.miui.volume.MiuiVolumeDialogImpl\$CustomDialog"))
    assertTrue(GateDecider.isSystemWindow("com.android.systemui", null))
    assertFalse(GateDecider.isSystemWindow("com.microsoft.launcher", "com.microsoft.launcher.LauncherActivity"))
    assertFalse(GateDecider.isSystemWindow(IG, "com.instagram.mainactivity.MainActivity"))
  }

  @Test
  fun `takes the pause down when the user goes elsewhere`() {
    val own = "com.reclaim"
    assertTrue(GateDecider.shouldDismiss(IG, "com.miui.home", own))
    assertTrue(GateDecider.shouldDismiss(IG, "com.whatsapp", own))
    // Same app switching screens, our own window, or system pop-ups: keep it up.
    assertFalse(GateDecider.shouldDismiss(IG, IG, own))
    assertFalse(GateDecider.shouldDismiss(IG, own, own))
    assertFalse(GateDecider.shouldDismiss(IG, "com.android.systemui", own))
    assertFalse(GateDecider.shouldDismiss(null, "com.miui.home", own))
  }
}
