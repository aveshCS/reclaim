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
}
