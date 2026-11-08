package com.reclaim.gate

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class IntensityTest {
  private val H = 3_600_000L

  @Test
  fun `strict wins until its end, then the base level returns`() {
    val p = Intensity.Plan(base = Intensity.GENTLE, strictUntil = 10 * H)
    assertEquals(Intensity.STRICT, Intensity.effective(p, 9 * H))
    assertEquals(Intensity.GENTLE, Intensity.effective(p, 10 * H))
  }

  @Test
  fun `a scheduled loosening only applies once its time comes`() {
    val p = Intensity.Plan(base = Intensity.FIRM, pendingLevel = Intensity.GENTLE, pendingAt = 24 * H)
    assertEquals(Intensity.FIRM, Intensity.effective(p, 23 * H))
    assertEquals(Intensity.GENTLE, Intensity.effective(p, 24 * H))
  }

  @Test
  fun `bad stored values fall back safely`() {
    assertEquals(Intensity.FIRM, Intensity.effective(Intensity.Plan(base = 9), 0))
    assertEquals(Intensity.AWARE, Intensity.effective(Intensity.Plan(base = -2), 0))
    assertEquals(Intensity.GENTLE, Intensity.effective(Intensity.Plan(pendingLevel = 7, pendingAt = 0), 5))
  }

  @Test
  fun `firm is slower, shorter and budgeted`() {
    assertEquals(5, Intensity.breathSeconds(Intensity.GENTLE))
    assertEquals(15, Intensity.breathSeconds(Intensity.FIRM))
    assertEquals(10, Intensity.allowMinutes(Intensity.GENTLE, 10))
    assertEquals(2, Intensity.allowMinutes(Intensity.FIRM, 10))
    assertFalse(Intensity.overBudget(Intensity.FIRM, 4))
    assertTrue(Intensity.overBudget(Intensity.FIRM, 5))
    assertFalse(Intensity.overBudget(Intensity.GENTLE, 50))
  }
}
