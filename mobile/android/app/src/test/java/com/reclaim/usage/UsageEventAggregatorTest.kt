package com.reclaim.usage

import com.reclaim.usage.UsageEventAggregator.AppUsage
import com.reclaim.usage.UsageEventAggregator.Event
import com.reclaim.usage.UsageEventAggregator.Kind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class UsageEventAggregatorTest {

  private val IG = "com.instagram.android"
  private val YT = "com.google.android.youtube"
  private val LAUNCHER = "com.android.launcher"
  private val S = 1_000L

  private fun r(p: String, c: String, t: Long) = Event(Kind.RESUMED, p, c, t)
  private fun pa(p: String, c: String, t: Long) = Event(Kind.PAUSED, p, c, t)
  private fun off(t: Long) = Event(Kind.SCREEN_OFF, null, null, t)

  private fun run(events: List<Event>, start: Long = 0, end: Long = 1_000 * S, vararg apps: String) =
      UsageEventAggregator.aggregate(events, start, end, apps.toSet())

  @Test
  fun `single session counts one open and its duration`() {
    val out = run(listOf(r(IG, "Main", 10 * S), pa(IG, "Main", 70 * S)), apps = arrayOf(IG))
    assertEquals(AppUsage(60 * S, 1), out[IG])
  }

  @Test
  fun `switching activities inside the same app is not a new open`() {
    val out =
        run(
            listOf(
                r(IG, "Feed", 0),
                pa(IG, "Feed", 30 * S),
                r(IG, "Reels", 30 * S + 50), // next activity right after
                pa(IG, "Reels", 90 * S),
            ),
            apps = arrayOf(IG))
    assertEquals(1, out[IG]!!.opens)
    assertEquals(90 * S - 50, out[IG]!!.foregroundMs)
  }

  @Test
  fun `overlapping activities of one app keep it in the foreground`() {
    // Some apps resume the new activity before pausing the old one.
    val out =
        run(
            listOf(r(IG, "A", 0), r(IG, "B", 10 * S), pa(IG, "A", 10 * S), pa(IG, "B", 40 * S)),
            apps = arrayOf(IG))
    assertEquals(AppUsage(40 * S, 1), out[IG])
  }

  @Test
  fun `leaving via the launcher and coming back is two opens`() {
    val out =
        run(
            listOf(
                r(IG, "Main", 0),
                pa(IG, "Main", 10 * S),
                r(LAUNCHER, "Home", 10 * S),
                pa(LAUNCHER, "Home", 20 * S),
                r(IG, "Main", 20 * S),
                pa(IG, "Main", 30 * S),
            ),
            apps = arrayOf(IG))
    assertEquals(AppUsage(20 * S, 2), out[IG])
  }

  @Test
  fun `a quick return within the gap is not a new open`() {
    val out =
        run(
            listOf(r(IG, "Main", 0), pa(IG, "Main", 10 * S), r(IG, "Main", 11 * S), pa(IG, "Main", 20 * S)),
            apps = arrayOf(IG))
    assertEquals(1, out[IG]!!.opens)
    assertEquals(19 * S, out[IG]!!.foregroundMs)
  }

  @Test
  fun `screen off ends the session and unlocking back is a new open`() {
    val out =
        run(
            listOf(r(YT, "Watch", 0), off(60 * S), r(YT, "Watch", 61 * S), pa(YT, "Watch", 120 * S)),
            apps = arrayOf(YT))
    assertEquals(AppUsage(119 * S, 2), out[YT])
  }

  @Test
  fun `app already in front at range start is credited from the start without an open`() {
    val out = run(listOf(pa(IG, "Main", 100 * S)), start = 40 * S, apps = arrayOf(IG))
    assertEquals(AppUsage(60 * S, 0), out[IG])
  }

  @Test
  fun `app still in front at range end is credited until the end`() {
    val out = run(listOf(r(IG, "Main", 900 * S)), apps = arrayOf(IG))
    assertEquals(AppUsage(100 * S, 1), out[IG])
  }

  @Test
  fun `only requested packages are returned and others read as zero`() {
    val out =
        run(
            listOf(r(IG, "Main", 0), pa(IG, "Main", 10 * S)),
            apps = arrayOf(YT))
    assertFalse(out.containsKey(IG))
    assertEquals(AppUsage(0, 0), out[YT])
  }

  @Test
  fun `events are clipped to the range`() {
    val out =
        run(
            listOf(r(IG, "Main", 5 * S), pa(IG, "Main", 50 * S)),
            start = 20 * S,
            end = 40 * S,
            apps = arrayOf(IG))
    assertEquals(20 * S, out[IG]!!.foregroundMs)
  }

  @Test
  fun `empty input gives zeros`() {
    assertEquals(AppUsage(0, 0), run(emptyList(), apps = arrayOf(IG))[IG])
  }

  @Test(expected = IllegalArgumentException::class)
  fun `inverted range is rejected`() {
    UsageEventAggregator.aggregate(emptyList(), 10, 5, setOf(IG))
  }
}
