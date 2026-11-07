package com.reclaim.gate

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.CountDownTimer
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * The pause screen, shown before a chosen app. A short breath, the user's own plan, then two
 * clear choices. Backing out is the default and is always one tap. Nothing is blocked:
 * "Open anyway" always works.
 */
class PauseActivity : Activity() {
  companion object {
    const val EXTRA_PACKAGE = "pkg"
    /** True while the pause screen is in front, so the service doesn't stack another one. */
    @Volatile var showing = false
    const val BREATH_SECONDS = 5
    private const val PAPER = "#FBF4EA"
    private const val INK = "#1F1A17"
    private const val ORANGE = "#F26A3D"
    private const val SKY = "#E3F1FA"
  }

  private lateinit var store: GateStore
  private var pkg: String = ""
  private var timer: CountDownTimer? = null

  private fun dp(v: Int) =
      TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics)
          .toInt()

  private fun font(name: String): Typeface? =
      try {
        Typeface.createFromAsset(assets, "fonts/$name.ttf")
      } catch (_: Exception) {
        null
      }

  private fun text(t: String, size: Float, bold: Boolean = false, color: String = INK) =
      TextView(this).apply {
        text = t
        setTextColor(Color.parseColor(color))
        setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
        gravity = Gravity.CENTER
        typeface = font(if (bold) "Fredoka_700Bold" else "Nunito_700Bold")
      }

  private fun pill(label: String, primary: Boolean, onClick: () -> Unit) =
      Button(this).apply {
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

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    store = GateStore(this)
    pkg = intent.getStringExtra(EXTRA_PACKAGE) ?: ""
    val appName = store.label(pkg) ?: "this app"

    val root =
        LinearLayout(this).apply {
          orientation = LinearLayout.VERTICAL
          gravity = Gravity.CENTER
          setBackgroundColor(Color.parseColor(PAPER))
          setPadding(dp(28), dp(48), dp(28), dp(36))
        }

    val circle =
        TextView(this).apply {
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

    val title = text("Pause. You're opening $appName.", 26f, bold = true)
    val breath = text("Breathe in…", 22f, bold = true, color = ORANGE).apply { setPadding(0, dp(16), 0, 0) }
    val plan = store.plan
    val planView =
        text(if (plan.isNotBlank()) "Your plan: “$plan”" else "Is this what you meant to do right now?", 16f)
            .apply { setPadding(0, dp(16), 0, dp(8)) }

    val notNow =
        pill("Not now", primary = true) {
          store.count("notnow")
          goHome()
        }
    val open =
        pill("Wait ${BREATH_SECONDS}s…", primary = false) {
          store.count("opened")
          store.allowFor(pkg, System.currentTimeMillis())
          packageManager.getLaunchIntentForPackage(pkg)?.let {
            it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(it)
          }
          finish()
        }
    open.isEnabled = false
    open.alpha = 0.5f

    root.addView(circle)
    root.addView(title)
    root.addView(breath)
    root.addView(planView)
    root.addView(notNow)
    root.addView(open)
    setContentView(root)

    // A short breath. The circle grows and shrinks; then "Open anyway" becomes available.
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
            open.text = "Open $appName for ${store.allowMinutes} min"
            open.contentDescription = open.text
          }
        }.start()
  }

  private fun goHome() {
    startActivity(
        Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    finish()
  }

  @Deprecated("Back counts as Not now")
  override fun onBackPressed() {
    store.count("notnow")
    goHome()
  }

  override fun onResume() {
    super.onResume()
    showing = true
  }

  override fun onPause() {
    showing = false
    super.onPause()
  }

  override fun onDestroy() {
    timer?.cancel()
    super.onDestroy()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
  }
}
