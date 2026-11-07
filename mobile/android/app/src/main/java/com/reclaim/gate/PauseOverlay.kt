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
 * Shows a short breath, the user's own plan, then two clear choices. Backing out is the
 * default and is one tap. Nothing is blocked: the open button always works after the breath.
 */
class PauseOverlay(
    private val service: AccessibilityService,
    private val store: GateStore,
    /** Called with the pause's allow key whenever it is taken down, for any reason. */
    private val onDismissed: (String) -> Unit = {},
) {
  companion object {
    const val BREATH_SECONDS = 5
    private const val PAPER = "#FBF4EA"
    private const val INK = "#1F1A17"
    private const val ORANGE = "#F26A3D"
    private const val SKY = "#E3F1FA"
  }

  private val wm = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private var root: LinearLayout? = null
  private var timer: CountDownTimer? = null

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

  private fun pill(label: String, primary: Boolean, onClick: () -> Unit) =
      Button(service).apply {
        text = label
        isAllCaps = false
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
        typeface = font("Nunito_800ExtraBold")
        setTextColor(Color.parseColor(INK))
        background =
            GradientDrawable().apply {
              cornerRadius = dp(18).toFloat()
              setColor(Color.parseColor(if (primary) ORANGE else "#FFFDF8"))
              setStroke(dp(2), Color.parseColor(INK))
            }
        minHeight = dp(56)
        setOnClickListener { onClick() }
        layoutParams =
            LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(60)).apply {
              topMargin = dp(12)
            }
        contentDescription = label
      }

  /**
   * What the pause is about. [hostPkg] is the app in front (used to notice the user leaving);
   * [allowKey] is what "open" lets through for a while (an app, "web:site" or "reels").
   */
  data class Prompt(
      val hostPkg: String,
      val title: String,
      val question: String?,
      val openLabel: String,
      val allowKey: String,
  )

  fun appPrompt(pkg: String): Prompt {
    val appName = store.label(pkg) ?: "this app"
    return Prompt(pkg, "Pause. You're opening $appName.", null, "Open $appName for ${store.allowMinutes} min", pkg)
  }

  fun webPrompt(browserPkg: String, site: String) =
      Prompt(browserPkg, "Pause. You're opening $site.", null, "Open $site for ${store.allowMinutes} min", "web:$site")

  fun reelsPrompt(pkg: String, count: Int, limit: Int) =
      Prompt(
          pkg,
          "That's $count reels today.",
          "You set a limit of $limit. Want to stop here?",
          "Keep watching for ${store.allowMinutes} min",
          "reels")

  /** Returns false if the overlay could not be shown (the user then simply sees their app). */
  fun show(prompt: Prompt): Boolean {
    hide()
    val pkg = prompt.hostPkg

    val view =
        object : LinearLayout(service) {
          override fun dispatchKeyEvent(event: KeyEvent): Boolean {
            // Back counts as "Not now".
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
      setPadding(dp(28), dp(48), dp(28), dp(36))
      isFocusable = true
      isFocusableInTouchMode = true
    }

    val circle =
        TextView(service).apply {
          text = "🌱"
          setTextSize(TypedValue.COMPLEX_UNIT_SP, 64f)
          gravity = Gravity.CENTER
          background =
              GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor(SKY))
                setStroke(dp(2), Color.parseColor(INK))
              }
          layoutParams = LinearLayout.LayoutParams(dp(180), dp(180)).apply { bottomMargin = dp(24) }
        }

    val title = text(prompt.title, 26f, bold = true)
    val breath = text("Breathe in…", 22f, bold = true, color = ORANGE).apply { setPadding(0, dp(16), 0, 0) }
    val plan = store.plan
    val planText =
        when {
          prompt.question != null -> prompt.question
          plan.isNotBlank() -> "Your plan: “$plan”"
          else -> "Is this what you meant to do right now?"
        }
    val planView = text(planText, 16f).apply { setPadding(0, dp(16), 0, dp(8)) }

    val notNowBtn = pill("Not now", primary = true) { notNow() }
    val open =
        pill("Wait ${BREATH_SECONDS}s…", primary = false) {
          store.count("opened")
          store.allowFor(prompt.allowKey, System.currentTimeMillis())
          // The chosen app is already underneath; simply step aside.
          hide()
        }
    open.isEnabled = false
    open.alpha = 0.5f

    view.addView(circle)
    view.addView(title)
    view.addView(breath)
    view.addView(planView)
    view.addView(notNowBtn)
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

    // A short breath. The circle grows and shrinks; then the open button becomes available.
    circle.animate().scaleX(1.12f).scaleY(1.12f).setDuration(2500).withEndAction {
      breath.text = "…and out."
      circle.animate().scaleX(0.92f).scaleY(0.92f).setDuration(2500).start()
    }.start()
    timer =
        object : CountDownTimer(BREATH_SECONDS * 1000L, 1000L) {
          override fun onTick(ms: Long) {
            open.text = "Wait ${(ms / 1000) + 1}s…"
          }

          override fun onFinish() {
            open.isEnabled = true
            open.alpha = 1f
            open.text = prompt.openLabel
            open.contentDescription = open.text
          }
        }.start()
    return true
  }

  /**
   * "Not now": the user's own tap sends them to the home screen. Go home first and keep the
   * pause up until the home screen is in front (the service then takes it down), so the app
   * underneath never flashes. A fallback removes it if no home-screen event arrives.
   */
  private fun notNow() {
    val view = root ?: return
    if (leaving) return
    leaving = true
    store.count("notnow")
    service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_HOME)
    view.postDelayed({ if (root === view) hide() }, 800)
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
