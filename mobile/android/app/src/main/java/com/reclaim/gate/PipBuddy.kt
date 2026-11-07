package com.reclaim.gate

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView

/** Pure (JVM-testable): how Pip feels about today's reel count. 0 happy … 3 sleepy. */
object BuddyMood {
  fun stage(count: Int, limit: Int): Int {
    if (limit > 0) {
      val r = count.toDouble() / limit
      return when {
        r < 0.34 -> 0
        r < 0.67 -> 1
        r < 1.0 -> 2
        else -> 3
      }
    }
    return when {
      count < 10 -> 0
      count < 25 -> 1
      count < 50 -> 2
      else -> 3
    }
  }

  /** Short, kind lines. Never shaming. */
  fun line(stage: Int): String =
      when (stage) {
        0 -> "I'm counting with you"
        1 -> "Still enjoying these?"
        2 -> "My eyes are getting tired…"
        else -> "Shall we take a break?"
      }
}

/**
 * Pip, floating over Shorts / Reels with today's count. Drawn by the accessibility service as a
 * small overlay that ignores touches, so it never gets in the way of the app.
 */
class PipBuddy(private val service: AccessibilityService) {
  private companion object {
    const val INK = "#1F1A17"
  }

  private val wm = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private var root: LinearLayout? = null
  private var pip: PipView? = null
  private var countView: TextView? = null
  private var lineView: TextView? = null
  private var shownCount = -1

  val isShowing: Boolean
    get() = root != null

  private fun dp(v: Int) =
      TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), service.resources.displayMetrics)
          .toInt()

  private fun font(name: String): Typeface? =
      try {
        Typeface.createFromAsset(service.assets, "fonts/$name.ttf")
      } catch (_: Exception) {
        null
      }

  /** Shows Pip (if needed) and updates the count and face. */
  fun show(count: Int, limit: Int) {
    if (root == null && !create()) return
    val stage = BuddyMood.stage(count, limit)
    pip?.stage = stage
    countView?.text = if (limit > 0) "$count / $limit" else "$count"
    lineView?.text = BuddyMood.line(stage)
    root?.contentDescription = "Pip: $count reels today. ${BuddyMood.line(stage)}"
    if (shownCount >= 0 && count > shownCount) bounce()
    shownCount = count
  }

  private fun bounce() {
    val p = pip ?: return
    p.animate().cancel()
    p.animate().scaleX(1.18f).scaleY(1.18f).translationY(-dp(4).toFloat()).setDuration(140).withEndAction {
      p.animate().scaleX(1f).scaleY(1f).translationY(0f).setDuration(220).start()
    }.start()
  }

  private fun create(): Boolean {
    val view =
        LinearLayout(service).apply {
          orientation = LinearLayout.HORIZONTAL
          gravity = Gravity.CENTER_VERTICAL
          setPadding(dp(6), dp(4), dp(12), dp(4))
          background =
              GradientDrawable().apply {
                cornerRadius = dp(22).toFloat()
                setColor(Color.parseColor("#F2FBF4EA"))
                setStroke(dp(2), Color.parseColor(INK))
              }
          importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        }
    val pv = PipView(service).apply { layoutParams = LinearLayout.LayoutParams(dp(46), dp(50)) }
    val texts =
        LinearLayout(service).apply {
          orientation = LinearLayout.VERTICAL
          setPadding(dp(6), 0, 0, 0)
        }
    val c =
        TextView(service).apply {
          setTextColor(Color.parseColor(INK))
          setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
          typeface = font("Fredoka_700Bold")
        }
    val l =
        TextView(service).apply {
          setTextColor(Color.parseColor(INK))
          setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
          typeface = font("Nunito_700Bold")
          maxWidth = dp(150)
        }
    texts.addView(c)
    texts.addView(l)
    view.addView(pv)
    view.addView(texts)

    val params =
        WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT)
            .apply {
              gravity = Gravity.TOP or Gravity.START
              x = dp(12)
              y = dp(96)
            }
    return try {
      wm.addView(view, params)
      root = view
      pip = pv
      countView = c
      lineView = l
      shownCount = -1
      true
    } catch (_: Exception) {
      false
    }
  }

  fun hide() {
    root?.let {
      try {
        wm.removeView(it)
      } catch (_: Exception) {}
    }
    root = null
    pip = null
    countView = null
    lineView = null
    shownCount = -1
  }
}

/** Pip drawn with Canvas, matching the app's SVG (viewBox 200x220). Face changes with [stage]. */
class PipView(context: Context) : View(context) {
  var stage: Int = 0
    set(v) {
      if (field != v) {
        field = v
        invalidate()
      }
    }

  private val ink = Color.parseColor("#1F1A17")
  private val butter = Color.parseColor("#FFD66B")
  private val leaf = Color.parseColor("#3F8F5B")
  private val blush = Color.parseColor("#F5A99A")
  private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
  private val line =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        color = ink
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
      }

  private fun stroke(w: Float) = line.apply { strokeWidth = w }

  private fun filled(c: Int, alpha: Int = 255) = fill.apply {
    color = c
    this.alpha = alpha
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val s = minOf(width / 200f, height / 220f)
    canvas.save()
    canvas.translate((width - 200 * s) / 2, (height - 220 * s) / 2)
    canvas.scale(s, s)

    // Sprout: droops a little when Pip is tired.
    val droop = if (stage >= 3) 10f else 0f
    canvas.drawPath(Path().apply { moveTo(100f, 66f); quadTo(95f, 50f, 100f, 30f + droop) }, stroke(4f))
    val top = 30f + droop
    val leafL = Path().apply {
      moveTo(100f, top); cubicTo(86f, top - 16 + droop, 68f, top - 8 + droop * 1.5f, 64f, top + 6 + droop * 1.5f)
      cubicTo(80f, top + 12, 94f, top + 8, 100f, top); close()
    }
    val leafR = Path().apply {
      moveTo(100f, top); cubicTo(114f, top - 16 + droop, 132f, top - 8 + droop * 1.5f, 136f, top + 6 + droop * 1.5f)
      cubicTo(120f, top + 12, 106f, top + 8, 100f, top); close()
    }
    for (p in listOf(leafL, leafR)) {
      canvas.drawPath(p, filled(leaf))
      canvas.drawPath(p, stroke(3.5f))
    }

    // Feet.
    for (cx in listOf(78f, 122f)) {
      val r = RectF(cx - 15, 194f, cx + 15, 210f)
      canvas.drawOval(r, filled(butter))
      canvas.drawOval(r, stroke(4f))
    }
    // Arms.
    canvas.drawPath(Path().apply { moveTo(30f, 152f); quadTo(16f, 160f, 18f, 172f) }, stroke(5f))
    canvas.drawPath(Path().apply { moveTo(170f, 152f); quadTo(184f, 160f, 182f, 172f) }, stroke(5f))

    // Body.
    val body = Path().apply {
      moveTo(100f, 62f); cubicTo(150f, 62f, 178f, 98f, 178f, 140f)
      cubicTo(178f, 182f, 146f, 204f, 100f, 204f); cubicTo(54f, 204f, 22f, 182f, 22f, 140f)
      cubicTo(22f, 98f, 50f, 62f, 100f, 62f); close()
    }
    canvas.drawPath(body, filled(butter))
    canvas.drawPath(body, stroke(4.5f))
    canvas.drawOval(RectF(56f, 148f, 144f, 196f), filled(Color.WHITE, 90))

    // Brows when concerned or tired.
    if (stage >= 2) {
      canvas.drawPath(Path().apply { moveTo(66f, 110f); quadTo(74f, 106f, 82f, 110f) }, stroke(3.5f))
      canvas.drawPath(Path().apply { moveTo(118f, 110f); quadTo(126f, 106f, 134f, 110f) }, stroke(3.5f))
    }
    // Cheeks.
    for (cx in listOf(60f, 140f)) canvas.drawOval(RectF(cx - 11, 141.5f, cx + 11, 154.5f), filled(blush, 204))

    // Eyes.
    for (cx in listOf(76f, 124f)) {
      when (stage) {
        3 -> { // sleepy: heavy lids
          canvas.drawPath(Path().apply { moveTo(cx - 9, 128f); quadTo(cx, 134f, cx + 9, 128f) }, stroke(4.5f))
          canvas.drawLine(cx - 9, 124f, cx + 9, 124f, stroke(3f))
        }
        else -> {
          val lookUp = if (stage == 1) -3f else 0f
          canvas.drawOval(RectF(cx - 7.5f, 118f + lookUp, cx + 7.5f, 138f + lookUp), filled(ink))
          canvas.drawCircle(cx + 2.5f, 123f + lookUp, 3f, filled(Color.WHITE))
        }
      }
    }

    // Mouth.
    when (stage) {
      0 -> canvas.drawPath(Path().apply { moveTo(88f, 151f); quadTo(100f, 163f, 112f, 151f) }, stroke(4.5f))
      1 -> canvas.drawPath(Path().apply { moveTo(93f, 156f); quadTo(100f, 152f, 108f, 155f) }, stroke(4f))
      2 -> canvas.drawPath(
          Path().apply { moveTo(90f, 158f); quadTo(95f, 153f, 100f, 157f); quadTo(105f, 161f, 110f, 156f) },
          stroke(4f))
      else -> canvas.drawOval(RectF(95f, 150f, 105f, 160f), stroke(3.5f)) // small yawn
    }

    // "z" when sleepy.
    if (stage >= 3) {
      val z = Path().apply { moveTo(150f, 70f); lineTo(166f, 70f); lineTo(150f, 86f); lineTo(166f, 86f) }
      canvas.drawPath(z, stroke(4f))
    }
    canvas.restore()
  }
}
