package com.reclaim.gate

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.CountDownTimer
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * The pause screen, drawn by the accessibility service as its own overlay window
 * (TYPE_ACCESSIBILITY_OVERLAY). Some phone makers (Xiaomi/POCO/Redmi, and others) block apps
 * from opening screens in the background, which silently stopped an Activity-based pause.
 * An accessibility overlay needs no extra permission and isn't affected by that block.
 *
 * Three variants, set by the user's intensity level (see Intensity.kt):
 * - PAUSE (Gentle): a breath, the user's plan, "Not now" or "Open for N min".
 * - FIRM: a longer breath and a "why?" choice before opening, for a short time.
 * - LOCKED (Strict, or Firm's daily budget used): "Go back", or an emergency unlock that costs
 *   a 60 s wait. Never a dead end.
 * Backing out is the default and is always one tap.
 */
class PauseOverlay(
    private val service: AccessibilityService,
    private val store: GateStore,
    /** Called with the pause's allow key whenever it is taken down, for any reason. */
    private val onDismissed: (String) -> Unit = {},
) {
  companion object {
    private const val PAPER = "#FBF4EA"
    private const val INK = "#1F1A17"
    private const val ORANGE = "#F26A3D"
    private const val SKY = "#E3F1FA"
    private const val BUTTER = "#FFF1C7"
    val REASONS = listOf("Reply to someone", "Look something up", "A planned break", "Just bored")
  }

  enum class Mode { PAUSE, FIRM, LOCKED }

  /**
   * What the pause is about. [hostPkg] is the app in front (used to notice the user leaving);
   * [allowKey] is what "open" lets through for a while (an app, "web:site" or "reels").
   * [goBack] is the system action for "Not now" / "Go back".
   */
  data class Prompt(
      val hostPkg: String,
      val title: String,
      val question: String?,
      val openLabel: String,
      val allowKey: String,
      val mode: Mode = Mode.PAUSE,
      val breathSeconds: Int = 5,
      val allowMinutes: Int = 5,
      val goBack: Int = AccessibilityService.GLOBAL_ACTION_HOME,
  )

  private val wm = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private var root: LinearLayout? = null
  private var timer: CountDownTimer? = null
  private var goBackAction = AccessibilityService.GLOBAL_ACTION_HOME

  /** Package the pause is currently shown for, or null when hidden. */
  var showingFor: String? = null
    private set

  private fun dp(v: Int) =
      TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), service.resources.displayMetrics)
          .toInt()

  private fun font(name: String): Typeface? =
      try {
        Typeface.createFromAsset(service.assets, "fonts/$name.ttf")
      } catch (_: Exception) {
        null
      }

  private fun text(t: String, size: Float, bold: Boolean = false, color: String = INK) =
      TextView(service).apply {
        text = t
        setTextColor(Color.parseColor(color))
        setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
        gravity = Gravity.CENTER
        typeface = font(if (bold) "Fredoka_700Bold" else "Nunito_700Bold")
      }

  private fun pill(label: String, primary: Boolean, height: Int = 60, onClick: () -> Unit) =
      Button(service).apply {
        text = label
        isAllCaps = false
        setTextSize(TypedValue.COMPLEX_UNIT_SP, if (height < 60) 15f else 17f)
        typeface = font("Nunito_800ExtraBold")
        setTextColor(Color.parseColor(INK))
        background =
            GradientDrawable().apply {
              cornerRadius = dp(18).toFloat()
              setColor(Color.parseColor(if (primary) ORANGE else "#FFFDF8"))
              setStroke(dp(2), Color.parseColor(INK))
            }
        minHeight = dp(height - 4)
        setOnClickListener { onClick() }
        layoutParams =
            LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(height)).apply {
              topMargin = dp(if (height < 60) 8 else 12)
            }
        contentDescription = label
      }

  private fun setEnabled(b: Button, on: Boolean) {
    b.isEnabled = on
    b.alpha = if (on) 1f else 0.5f
  }

  // ---- Prompts ---------------------------------------------------------------------------

  private fun build(
      hostPkg: String,
      subject: String,
      allowKey: String,
      level: Int,
      lockedReason: String?,
      title: String,
      question: String?,
      openVerb: (Int) -> String,
      goBack: Int = AccessibilityService.GLOBAL_ACTION_HOME,
  ): Prompt {
    if (lockedReason != null) {
      return Prompt(
          hostPkg, "$subject is paused for now.", lockedReason,
          openVerb(Intensity.EMERGENCY_ALLOW_MINUTES), allowKey, Mode.LOCKED,
          Intensity.EMERGENCY_WAIT_SECONDS, Intensity.EMERGENCY_ALLOW_MINUTES, goBack)
    }
    val minutes = Intensity.allowMinutes(level, store.allowMinutes)
    return Prompt(
        hostPkg, title, question, openVerb(minutes), allowKey,
        if (level >= Intensity.FIRM) Mode.FIRM else Mode.PAUSE,
        Intensity.breathSeconds(level), minutes, goBack)
  }

  fun appPrompt(pkg: String, level: Int, lockedReason: String?): Prompt {
    val appName = store.label(pkg) ?: "This app"
    return build(pkg, appName, pkg, level, lockedReason, "Pause. You're opening $appName.", null,
        { m -> "Open $appName for $m min" })
  }

  fun webPrompt(browserPkg: String, site: String, level: Int, lockedReason: String?) =
      build(browserPkg, site, "web:$site", level, lockedReason, "Pause. You're opening $site.", null,
          { m -> "Open $site for $m min" })

  fun reelsPrompt(pkg: String, count: Int, limit: Int, level: Int) =
      build(pkg, "Reels", "reels", level, null, "That's $count reels today.",
          "You set a limit of $limit. Want to stop here?", { m -> "Keep watching for $m min" })

  /** Strict mode with the reels counter on: Shorts / Reels themselves are paused. */
  fun reelsLockedPrompt(pkg: String, lockedReason: String) =
      build(pkg, "Shorts and Reels", "reels", Intensity.STRICT, lockedReason, "", null,
          { m -> "Watch for $m min" })

  // ---- Showing ---------------------------------------------------------------------------

  /** Returns false if the overlay could not be shown (the user then simply sees their app). */
  fun show(prompt: Prompt): Boolean {
    hide()
    val pkg = prompt.hostPkg
    goBackAction = prompt.goBack

    val view =
        object : LinearLayout(service) {
          override fun dispatchKeyEvent(event: KeyEvent): Boolean {
            // Back counts as "Not now" / "Go back".
            if (event.keyCode == KeyEvent.KEYCODE_BACK) {
              if (event.action == KeyEvent.ACTION_UP) notNow()
              return true
            }
            return super.dispatchKeyEvent(event)
          }
        }
    view.apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.parseColor(PAPER))
      setPadding(dp(28), dp(40), dp(28), dp(32))
      isFocusable = true
      isFocusableInTouchMode = true
    }

    val locked = prompt.mode == Mode.LOCKED
    val circle =
        TextView(service).apply {
          text = if (locked) "🌙" else "🌱"
          setTextSize(TypedValue.COMPLEX_UNIT_SP, 56f)
          gravity = Gravity.CENTER
          background =
              GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor(if (locked) BUTTER else SKY))
                setStroke(dp(2), Color.parseColor(INK))
              }
          layoutParams = LinearLayout.LayoutParams(dp(156), dp(156)).apply { bottomMargin = dp(20) }
        }

    val title = text(prompt.title, 25f, bold = true)
    val breath =
        text(if (locked) "You chose this to protect your time." else "Breathe in…", if (locked) 17f else 22f,
            bold = true, color = ORANGE)
            .apply { setPadding(0, dp(14), 0, 0) }
    val plan = store.plan
    val planText =
        when {
          prompt.question != null -> prompt.question
          plan.isNotBlank() -> "Your plan: “$plan”"
          else -> "Is this what you meant to do right now?"
        }
    val planView = text(planText, 16f).apply { setPadding(0, dp(14), 0, dp(6)) }

    val primary = pill(if (locked) "Go back" else "Not now", primary = true) { notNow() }
    val open = pill("", primary = false) {}
    setEnabled(open, false)

    view.addView(circle)
    view.addView(title)
    view.addView(breath)
    view.addView(planView)

    // Firm: say why before opening. Only a count of each reason is kept.
    var reasonChosen = prompt.mode != Mode.FIRM
    var breathDone = false
    val reasonRow = LinearLayout(service).apply { orientation = LinearLayout.VERTICAL }
    if (prompt.mode == Mode.FIRM) {
      reasonRow.addView(text("Why are you opening it?", 15f, bold = true).apply { setPadding(0, dp(8), 0, 0) })
      val buttons = mutableListOf<Button>()
      REASONS.forEachIndexed { i, r ->
        val b = pill(r, primary = false, height = 46) {}
        b.setOnClickListener {
          reasonChosen = true
          store.count("why$i")
          buttons.forEach { o ->
            (o.background as? GradientDrawable)?.setColor(
                Color.parseColor(if (o === b) BUTTER else "#FFFDF8"))
          }
          if (i == REASONS.lastIndex) planView.text = "Bored is okay. A 2-minute walk might feel better."
          if (breathDone) setEnabled(open, true)
        }
        buttons.add(b)
        reasonRow.addView(b)
      }
      view.addView(reasonRow)
    }
    view.addView(primary)
    view.addView(open)

    val params =
        WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.OPAQUE)
            .apply { gravity = Gravity.TOP or Gravity.START }

    try {
      wm.addView(view, params)
    } catch (_: Exception) {
      return false
    }
    root = view
    showingFor = pkg
    showingKey = prompt.allowKey
    view.requestFocus()

    val doOpen = {
      store.count(if (locked) "emergency" else "opened")
      store.count("opened_${prompt.allowKey}")
      store.allowFor(prompt.allowKey, System.currentTimeMillis(), prompt.allowMinutes)
      // The app is already underneath; simply step aside.
      hide()
    }

    if (locked) {
      // Emergency unlock: always possible, never instant.
      open.text = "Emergency unlock"
      setEnabled(open, true)
      open.setOnClickListener {
        open.setOnClickListener(null)
        setEnabled(open, false)
        startCountdown(prompt.breathSeconds, open) {
          setEnabled(open, true)
          open.text = prompt.openLabel
          open.contentDescription = open.text
          open.setOnClickListener { doOpen() }
        }
      }
    } else {
      breathe(circle, breath)
      open.setOnClickListener { doOpen() }
      startCountdown(prompt.breathSeconds, open) {
        breathDone = true
        open.text = prompt.openLabel
        open.contentDescription = open.text
        setEnabled(open, reasonChosen)
      }
    }
    return true
  }

  private fun startCountdown(seconds: Int, button: Button, onDone: () -> Unit) {
    timer?.cancel()
    button.text = "Wait ${seconds}s…"
    timer =
        object : CountDownTimer(seconds * 1000L, 1000L) {
          override fun onTick(ms: Long) {
            button.text = "Wait ${(ms / 1000) + 1}s…"
          }

          override fun onFinish() = onDone()
        }.start()
  }

  /** The circle grows and shrinks, 5 s per breath, for as long as the pause is up. */
  private fun breathe(circle: View, label: TextView) {
    val view = root ?: return
    label.text = "Breathe in…"
    circle.animate().scaleX(1.12f).scaleY(1.12f).setDuration(2500).withEndAction {
      if (root !== view) return@withEndAction
      label.text = "…and out."
      circle.animate().scaleX(0.92f).scaleY(0.92f).setDuration(2500).withEndAction {
        if (root === view) breathe(circle, label)
      }.start()
    }.start()
  }

  /**
   * "Not now" / "Go back": the user's own tap. Home: go home first and keep the pause up until
   * the home screen is in front (the service then takes it down), so the app underneath never
   * flashes; a fallback removes it. (Back is not used for Shorts: YouTube turns Back on a Short
   * into its mini-player, so the video kept playing in a corner.)
   */
  private fun notNow() {
    val view = root ?: return
    if (leaving) return
    leaving = true
    store.count("notnow")
    service.performGlobalAction(goBackAction)
    val delay = if (goBackAction == AccessibilityService.GLOBAL_ACTION_HOME) 800L else 250L
    view.postDelayed({ if (root === view) hide() }, delay)
  }

  private var leaving = false

  fun hide() {
    timer?.cancel()
    timer = null
    root?.let {
      try {
        wm.removeView(it)
      } catch (_: Exception) {}
    }
    root = null
    leaving = false
    val key = showingKey
    showingFor = null
    showingKey = null
    if (key != null) onDismissed(key)
  }

  /** The allow key of the pause on screen ("com.x", "web:site", "reels"), or null. */
  private var showingKey: String? = null
}
