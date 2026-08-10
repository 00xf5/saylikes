package com.cjj.sayhilikes

import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import android.accessibilityservice.AccessibilityService

/**
 * Tiny non-focus-stealing bubble shown while the bot runs.
 * Uses TYPE_ACCESSIBILITY_OVERLAY (no SYSTEM_ALERT_WINDOW needed).
 */
class BotOverlay(private val service: AccessibilityService) {

    private val main = Handler(Looper.getMainLooper())
    private var root: LinearLayout? = null
    private var countView: TextView? = null
    private var params: WindowManager.LayoutParams? = null
    private var wm: WindowManager? = null

    private var dragDx = 0f
    private var dragDy = 0f

    fun show(maxLikes: Int) {
        main.post {
            try {
                if (root != null) {
                    setCount(0, maxLikes)
                    return@post
                }
                val windowManager = service.getSystemService(WindowManager::class.java) ?: return@post
                wm = windowManager

                val density = service.resources.displayMetrics.density
                fun dp(v: Int) = (v * density).toInt()

                val pill = LinearLayout(service).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    setPadding(dp(10), dp(6), dp(8), dp(6))
                    background = GradientDrawable().apply {
                        cornerRadius = dp(20).toFloat()
                        setColor(Color.argb(200, 20, 20, 20))
                        setStroke(dp(1), Color.argb(160, 0, 163, 155))
                    }
                    elevation = dp(4).toFloat()
                }

                val count = TextView(service).apply {
                    setTextColor(Color.WHITE)
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                    typeface = Typeface.DEFAULT_BOLD
                    text = "♥ 0/$maxLikes"
                    setPadding(0, 0, dp(8), 0)
                }
                countView = count

                val stop = TextView(service).apply {
                    text = "STOP"
                    setTextColor(Color.WHITE)
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
                    typeface = Typeface.DEFAULT_BOLD
                    setPadding(dp(10), dp(4), dp(10), dp(4))
                    background = GradientDrawable().apply {
                        cornerRadius = dp(14).toFloat()
                        setColor(Color.argb(230, 198, 40, 40))
                    }
                    isClickable = true
                    isFocusable = true
                    setOnClickListener {
                        LikeAccessibilityService.stopRequested = true
                        LikeAccessibilityService.instance?.requestStop()
                        setStopping()
                    }
                }

                pill.addView(count)
                pill.addView(stop)

                // Drag by holding the count area; Stop stays a clean tap target
                count.setOnTouchListener { _, event ->
                    val lp = params ?: return@setOnTouchListener false
                    when (event.actionMasked) {
                        MotionEvent.ACTION_DOWN -> {
                            dragDx = event.rawX - lp.x
                            dragDy = event.rawY - lp.y
                            true
                        }
                        MotionEvent.ACTION_MOVE -> {
                            lp.x = (event.rawX - dragDx).toInt().coerceAtLeast(0)
                            lp.y = (event.rawY - dragDy).toInt().coerceAtLeast(0)
                            try {
                                wm?.updateViewLayout(pill, lp)
                            } catch (_: Exception) {
                            }
                            true
                        }
                        else -> false
                    }
                }

                val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                    WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY
                } else {
                    @Suppress("DEPRECATION")
                    WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
                }

                val lp = WindowManager.LayoutParams(
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    type,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                    PixelFormat.TRANSLUCENT
                ).apply {
                    gravity = Gravity.TOP or Gravity.START
                    x = dp(12)
                    y = dp(80)
                }

                params = lp
                root = pill
                windowManager.addView(pill, lp)
            } catch (_: Exception) {
                // Overlay is best-effort — never crash the bot
                safeDetach()
            }
        }
    }

    fun setCount(liked: Int, maxLikes: Int) {
        main.post {
            try {
                countView?.text = "♥ $liked/$maxLikes"
            } catch (_: Exception) {
            }
        }
    }

    fun setStopping() {
        main.post {
            try {
                countView?.text = "Stopping…"
            } catch (_: Exception) {
            }
        }
    }

    fun hide() {
        main.post { safeDetach() }
    }

    private fun safeDetach() {
        try {
            val view = root
            val manager = wm
            if (view != null && manager != null) {
                manager.removeView(view)
            }
        } catch (_: Exception) {
        }
        root = null
        countView = null
        params = null
        wm = null
    }
}
