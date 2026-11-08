package com.reclaim.gate

/**
 * Pure helpers (JVM-testable) for the website pause. RECLAIM reads only the address-bar text
 * of known browsers, turns it into a bare site name ("reddit.com") and compares it with the
 * user's list on the phone. Nothing about browsing is stored.
 */
object WebMatcher {
  /**
   * Address-bar view ids of common browsers. Apps change these in updates, so each must be
   * re-checked on a real device. Chromium browsers share "url_bar".
   */
  val URL_BAR_IDS: Map<String, List<String>> =
      mapOf(
          "com.android.chrome" to listOf("com.android.chrome:id/url_bar"),
          "com.chrome.beta" to listOf("com.chrome.beta:id/url_bar"),
          "com.brave.browser" to listOf("com.brave.browser:id/url_bar"),
          "com.microsoft.emmx" to listOf("com.microsoft.emmx:id/url_bar"),
          "com.kiwibrowser.browser" to listOf("com.kiwibrowser.browser:id/url_bar"),
          "org.mozilla.firefox" to
              listOf(
                  "org.mozilla.firefox:id/mozac_browser_toolbar_url_view",
                  "org.mozilla.firefox:id/url_bar_title"),
          "com.sec.android.app.sbrowser" to
              listOf("com.sec.android.app.sbrowser:id/location_bar_edit_text"),
          "com.opera.browser" to listOf("com.opera.browser:id/url_field"),
          "com.duckduckgo.mobile.android" to
              listOf("com.duckduckgo.mobile.android:id/omnibarTextInput"),
      )

  fun isBrowser(pkg: String?): Boolean = pkg != null && pkg in URL_BAR_IDS

  private val HOST = Regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$")

  /**
   * "https://www.reddit.com/r/x?y" -> "reddit.com". Returns null for search text, blank text,
   * or anything that isn't a web address.
   */
  fun hostOf(text: String?): String? {
    var t = text?.trim()?.lowercase() ?: return null
    if (t.isEmpty() || t.contains(' ')) return null
    t = t.removePrefix("https://").removePrefix("http://")
    val end = t.indexOfFirst { it == '/' || it == '?' || it == '#' }
    if (end >= 0) t = t.substring(0, end)
    t = t.substringBefore(':') // port
    t = t.substringAfter('@') // user info
    for (p in listOf("www.", "m.", "mobile.")) {
      if (t.startsWith(p) && t.length > p.length + 3) t = t.removePrefix(p)
    }
    return if (HOST.matches(t)) t else null
  }

  /** A short video open in the browser: which site, and which video (only compared, never stored). */
  data class ShortVideo(val site: String, val id: String)

  /**
   * Is this address a single short video page? YouTube /shorts/ID, Instagram /reel(s)/ID,
   * Facebook /reel/ID, TikTok /@user/video/ID. Each new ID while scrolling = one new reel.
   */
  fun shortVideo(text: String?): ShortVideo? {
    val host = hostOf(text) ?: return null
    var t = text!!.trim()
    t = t.removePrefix("https://").removePrefix("http://").removePrefix("HTTPS://").removePrefix("HTTP://")
    val slash = t.indexOf('/')
    if (slash < 0) return null
    val path = t.substring(slash + 1).substringBefore('?').substringBefore('#')
    val segs = path.split('/').filter { it.isNotEmpty() }
    fun on(site: String) = host == site || host.endsWith(".$site")
    return when {
      on("youtube.com") && segs.size >= 2 && segs[0].equals("shorts", true) ->
          ShortVideo("youtube.com", segs[1])
      on("instagram.com") && segs.size >= 2 &&
          (segs[0].equals("reel", true) || segs[0].equals("reels", true)) ->
          ShortVideo("instagram.com", segs[1])
      on("facebook.com") && segs.size >= 2 && segs[0].equals("reel", true) ->
          ShortVideo("facebook.com", segs[1])
      on("tiktok.com") && segs.size >= 3 && segs[1].equals("video", true) ->
          ShortVideo("tiktok.com", segs[2])
      else -> null
    }
  }

  /** The user's site that [host] belongs to ("old.reddit.com" -> "reddit.com"), or null. */
  fun match(host: String?, sites: Set<String>): String? {
    if (host == null) return null
    return sites.firstOrNull { host == it || host.endsWith(".$it") }
  }
}
