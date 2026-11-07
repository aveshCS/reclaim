package com.reclaim.gate

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WebAndReelsTest {
  @Test
  fun `turns address-bar text into a bare site name`() {
    assertEquals("reddit.com", WebMatcher.hostOf("https://www.reddit.com/r/android?x=1"))
    assertEquals("reddit.com", WebMatcher.hostOf("reddit.com/r/android"))
    assertEquals("old.reddit.com", WebMatcher.hostOf("old.reddit.com"))
    assertEquals("youtube.com", WebMatcher.hostOf("m.youtube.com/shorts/abc"))
    assertEquals("x.com", WebMatcher.hostOf("HTTPS://X.COM/home"))
    assertEquals("example.com", WebMatcher.hostOf("example.com:8080/path"))
  }

  @Test
  fun `ignores search text and non-addresses`() {
    assertNull(WebMatcher.hostOf("funny cat videos"))
    assertNull(WebMatcher.hostOf(""))
    assertNull(WebMatcher.hostOf(null))
    assertNull(WebMatcher.hostOf("reddit"))
    assertNull(WebMatcher.hostOf("Search or type web address"))
  }

  @Test
  fun `matches a site and its subdomains, not look-alikes`() {
    val sites = setOf("reddit.com", "x.com")
    assertEquals("reddit.com", WebMatcher.match("reddit.com", sites))
    assertEquals("reddit.com", WebMatcher.match("old.reddit.com", sites))
    assertNull(WebMatcher.match("notreddit.com", sites))
    assertNull(WebMatcher.match("box.com", sites))
    assertNull(WebMatcher.match(null, sites))
  }

  @Test
  fun `knows the supported browsers`() {
    assertTrue(WebMatcher.isBrowser("com.android.chrome"))
    assertTrue(WebMatcher.isBrowser("com.brave.browser"))
    assertFalse(WebMatcher.isBrowser("com.google.android.youtube"))
  }

  @Test
  fun `counts each new reel once`() {
    val t = ReelTracker()
    val yt = "com.google.android.youtube"
    assertFalse(t.onPagerScrolled(yt, 0)) // first sight: session starts
    assertFalse(t.onPagerScrolled(yt, 0)) // still swiping off the first one
    assertTrue(t.onPagerScrolled(yt, 1))
    assertFalse(t.onPagerScrolled(yt, 1))
    assertTrue(t.onPagerScrolled(yt, 2))
    // Back to an earlier reel and forward again: no double counting.
    assertFalse(t.onPagerScrolled(yt, 1))
    assertFalse(t.onPagerScrolled(yt, 2))
    assertTrue(t.onPagerScrolled(yt, 3))
    assertFalse(t.onPagerScrolled(yt, -1))
  }

  @Test
  fun `counts by scroll distance when the app gives no positions (YouTube Shorts)`() {
    val t = ReelTracker()
    val yt = "com.google.android.youtube"
    val h = 2000
    // One swipe arrives as several partial scrolls.
    assertEquals(0, t.onPagerDelta(yt, 600, h))
    assertEquals(1, t.onPagerDelta(yt, 700, h)) // past half a page: next Short
    assertEquals(0, t.onPagerDelta(yt, 700, h)) // settles on page 1
    assertEquals(1, t.onPagerDelta(yt, 2000, h))
    // Back one and forward again: no double counting.
    assertEquals(0, t.onPagerDelta(yt, -2000, h))
    assertEquals(0, t.onPagerDelta(yt, 2000, h))
    assertEquals(1, t.onPagerDelta(yt, 2000, h))
    assertEquals(0, t.onPagerDelta(yt, 500, 0)) // unknown height: ignore
  }

  @Test
  fun `last resort counts spaced scroll bursts after the pager settles`() {
    val t = ReelTracker()
    val yt = "com.google.android.youtube"
    assertFalse(t.onPagerScrollBurst(yt, 10_000)) // opening Shorts: settling
    assertFalse(t.onPagerScrollBurst(yt, 10_500))
    assertTrue(t.onPagerScrollBurst(yt, 13_000))
    assertFalse(t.onPagerScrollBurst(yt, 13_300)) // same swipe
    assertTrue(t.onPagerScrollBurst(yt, 15_000))
  }

  @Test
  fun `counts a new Short each time a different page is in the middle`() {
    val t = ReelTracker()
    val yt = "com.google.android.youtube"
    assertFalse(t.tracksPages(yt))
    assertFalse(t.onVisiblePage(yt, 111)) // first Short of the visit
    assertTrue(t.tracksPages(yt))
    assertFalse(t.onVisiblePage(yt, 111)) // same Short, redrawn
    assertTrue(t.onVisiblePage(yt, 222))
    assertTrue(t.onVisiblePage(yt, 333))
    assertTrue(t.onVisiblePage(yt, 111)) // page views are reused; still a new Short
    t.endSession(yt)
    assertFalse(t.onVisiblePage(yt, 222)) // new visit
  }

  @Test
  fun `Pip's face follows the count, against the limit if there is one`() {
    assertEquals(0, BuddyMood.stage(0, 0))
    assertEquals(0, BuddyMood.stage(9, 0))
    assertEquals(1, BuddyMood.stage(10, 0))
    assertEquals(2, BuddyMood.stage(25, 0))
    assertEquals(3, BuddyMood.stage(50, 0))
    assertEquals(0, BuddyMood.stage(6, 20))
    assertEquals(1, BuddyMood.stage(7, 20))
    assertEquals(2, BuddyMood.stage(14, 20))
    assertEquals(3, BuddyMood.stage(20, 20))
    for (s in 0..3) assertFalse(BuddyMood.line(s).contains(Regex("rot|damag|lazy|bad|shame", RegexOption.IGNORE_CASE)))
  }

  @Test
  fun `a new visit starts a new session`() {
    val t = ReelTracker()
    val ig = "com.instagram.android"
    t.onPagerScrolled(ig, 0)
    assertTrue(t.onPagerScrolled(ig, 1))
    t.endSession(ig)
    assertFalse(t.onPagerScrolled(ig, 0))
    assertTrue(t.onPagerScrolled(ig, 1))
  }

  @Test
  fun `only the short-video pager counts`() {
    val yt = "com.google.android.youtube"
    assertTrue(ReelTracker.isReelPager(yt, "com.google.android.youtube:id/reel_recycler"))
    assertFalse(ReelTracker.isReelPager(yt, "com.google.android.youtube:id/results"))
    // Renamed pager in a newer app version still matches by its id word.
    assertTrue(ReelTracker.isReelPager(yt, "com.google.android.youtube:id/reel_pager_v2"))
    assertTrue(ReelTracker.isReelPager("com.instagram.android", "com.instagram.android:id/clips_tab_pager"))
    assertFalse(ReelTracker.isReelPager(yt, "com.instagram.android:id/reel_x"))
    assertFalse(ReelTracker.isReelPager(yt, null))
    assertFalse(ReelTracker.supports("com.whatsapp"))
  }
}
