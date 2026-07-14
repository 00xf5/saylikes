package com.cjj.sayhilikes

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Intent
import android.graphics.Path
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo
import kotlin.random.Random

/**
 * On-device like bot using Accessibility (same flow as the Python Appium script).
 */
class LikeAccessibilityService : AccessibilityService() {

    companion object {
        @Volatile var instance: LikeAccessibilityService? = null
        @Volatile var stopRequested: Boolean = false

        private const val PKG = "com.unearby.sayhi"
        private const val ID_SEARCH = "$PKG:id/action_search"
        private const val ID_LOGIN = "$PKG:id/sp_time_appeared"
        private const val ID_OK = "$PKG:id/bt_ok"
        private const val ID_CANCEL = "$PKG:id/bt_cancel"
        private const val ID_LAST_SEEN = "$PKG:id/tv_last_seen"
        private const val ID_NAME = "android:id/text1"
        private const val ID_AVATAR = "android:id/icon"
        private const val ID_DISPLAY = "$PKG:id/tv_display_name"
        private const val ID_START_CHAT = "$PKG:id/bt_start_chat"
        private const val ID_PHOTO_LIST = "$PKG:id/rv_photo_list"
        private const val ID_BT_LIKE = "$PKG:id/bt_like"
    }

    private var workerThread: HandlerThread? = null
    private var worker: Handler? = null
    private val seen = linkedSetOf<String>()

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        val t = HandlerThread("sayhi-likes-bot").also { it.start() }
        workerThread = t
        worker = Handler(t.looper)
        log("Accessibility connected")
    }

    override fun onDestroy() {
        stopRequested = true
        workerThread?.quitSafely()
        instance = null
        super.onDestroy()
    }

    override fun onAccessibilityEvent(event: android.view.accessibility.AccessibilityEvent?) = Unit
    override fun onInterrupt() {
        stopRequested = true
    }

    fun startBot(maxLikes: Int, loginWithin: String, speed: String) {
        stopRequested = false
        seen.clear()
        val (dMin, dMax) = when (speed) {
            "Normal" -> 800L to 1600L
            "Slow" -> 1600L to 2800L
            else -> 250L to 550L
        }
        worker?.post {
            var liked = 0
            var names = ArrayList<String>()
            try {
                val result = runBot(maxLikes, loginWithin, dMin, dMax)
                liked = result.first
                names = ArrayList(result.second)
            } catch (e: Exception) {
                log("ERROR: ${e.message}")
                status("Error — see log")
            } finally {
                getSharedPreferences(Prefs.PREFS, MODE_PRIVATE)
                    .edit().putBoolean(Prefs.KEY_RUNNING, false).apply()
                status("Ready — press Start when SayHi is open")
                log("Done")
                sendBroadcast(
                    Intent(Prefs.ACTION_FINISHED)
                        .setPackage(packageName)
                        .putExtra(Prefs.EXTRA_LIKED, liked)
                        .putStringArrayListExtra(Prefs.EXTRA_NAMES, names)
                )
            }
        }
    }

    fun requestStop() {
        stopRequested = true
        log("Stop requested")
    }

    private fun runBot(
        maxLikes: Int,
        loginWithin: String,
        dMin: Long,
        dMax: Long
    ): Pair<Int, List<String>> {
        status("Running… leave SayHi on screen")
        log("Start: max=$maxLikes within=$loginWithin")
        sleep(600)
        if (stopRequested) return 0 to emptyList()

        if (!doSearchSetup(loginWithin)) {
            log("Search setup failed — open SayHi find tab and retry")
            return 0 to emptyList()
        }

        var liked = 0
        val likedNames = mutableListOf<String>()
        var idleScrolls = 0
        while (liked < maxLikes && idleScrolls < 40 && !stopRequested) {
            ensureList()
            val rows = listRows()
            val fresh = rows.filter { row ->
                val key = row.name.lowercase()
                key.isNotBlank() && key != "?" && key !in seen && !row.alreadyLiked
            }
            log("rows=${rows.size} fresh=${fresh.size} liked=$liked/$maxLikes")

            val target = fresh.firstOrNull()
            if (target == null) {
                val allLiked = rows.isNotEmpty() && rows.all { it.alreadyLiked || it.name.lowercase() in seen }
                scrollList(skipCluster = allLiked)
                idleScrolls++
                if (rows.any { it.alreadyLiked }) idleScrolls = (idleScrolls - 1).coerceAtLeast(0)
                continue
            }

            idleScrolls = 0
            seen += target.name.lowercase()
            if (target.alreadyLiked) {
                log("skip already-liked: ${target.name}")
                continue
            }

            log("open NEW: ${target.name}")
            tap(target.cx, target.cy)
            sleep(450)
            if (!onProfile()) {
                log("  profile not open")
                goBackToList()
                continue
            }
            if (!openPhotoAndLike()) {
                log("  like failed")
                goBackToList()
                continue
            }
            goBackToList()
            liked++
            likedNames += target.name
            log("  liked NEW ($liked/$maxLikes): ${target.name}")
            status("Liked $liked / $maxLikes")
            sleep(Random.nextLong(dMin, dMax + 1))
        }
        log("Finished new likes=$liked")
        return liked to likedNames
    }

    private fun doSearchSetup(loginWithin: String): Boolean {
        // Dismiss open filter
        findId(ID_CANCEL)?.let { click(it); sleep(300) }

        val search = findId(ID_SEARCH) ?: run {
            log("Search button missing")
            return false
        }
        click(search)
        sleep(700)
        val spinner = findId(ID_LOGIN) ?: run {
            log("Login within spinner missing")
            return false
        }
        // If already correct, skip reopening
        val cur = collectText(spinner)
        if (!cur.contains(loginWithin, ignoreCase = true)) {
            click(spinner)
            sleep(400)
            val opt = findText(loginWithin) ?: run {
                log("Option not found: $loginWithin")
                return false
            }
            click(opt)
            sleep(300)
        }
        val ok = findId(ID_OK) ?: findText("SEARCH") ?: run {
            log("SEARCH button missing")
            return false
        }
        click(ok)
        sleep(1200)
        return findId(ID_LAST_SEEN) != null || waitForId(ID_LAST_SEEN, 8000)
    }

    data class Row(val name: String, val cx: Float, val cy: Float, val alreadyLiked: Boolean)

    private fun listRows(): List<Row> {
        val root = rootInActiveWindow ?: return emptyList()
        val lasts = root.findAccessibilityNodeInfosByViewId(ID_LAST_SEEN) ?: emptyList()
        val names = root.findAccessibilityNodeInfosByViewId(ID_NAME) ?: emptyList()
        val icons = root.findAccessibilityNodeInfosByViewId(ID_AVATAR) ?: emptyList()
        val likedLabels = mutableListOf<Float>()
        for (n in listOf("liked him", "Liked him", "You liked")) {
            root.findAccessibilityNodeInfosByText(n)?.forEach { node ->
                val r = android.graphics.Rect()
                node.getBoundsInScreen(r)
                likedLabels += r.exactCenterY()
            }
        }

        fun midY(n: AccessibilityNodeInfo): Float {
            val r = android.graphics.Rect()
            n.getBoundsInScreen(r)
            return r.exactCenterY()
        }

        fun nearest(pool: List<AccessibilityNodeInfo>, y: Float, tol: Float = 100f): AccessibilityNodeInfo? {
            var best: AccessibilityNodeInfo? = null
            var bestD = tol
            for (n in pool) {
                val d = kotlin.math.abs(midY(n) - y)
                if (d < bestD) {
                    bestD = d
                    best = n
                }
            }
            return best
        }

        val dm = resources.displayMetrics
        val rows = mutableListOf<Row>()
        for (ls in lasts) {
            val y = midY(ls)
            val nameNode = nearest(names, y)
            val name = nameNode?.text?.toString()?.trim().orEmpty().ifBlank { "?" }
            val icon = nearest(icons, y, 120f)
            val (cx, cy) = if (icon != null) {
                val r = android.graphics.Rect()
                icon.getBoundsInScreen(r)
                if (r.height() < 30) continue
                r.exactCenterX() to r.exactCenterY()
            } else {
                100f to y
            }
            if (cy < 100 || cy > dm.heightPixels - 80) continue
            val blob = buildString {
                append(ls.text ?: "")
                append(" | ")
                append(name)
                nameNode?.parent?.let { p ->
                    // pull sibling texts loosely
                }
            }
            val already = likedLabels.any { kotlin.math.abs(it - cy) < 110f || kotlin.math.abs(it - y) < 110f } ||
                blob.contains("liked him", ignoreCase = true)
            rows += Row(name, cx, cy, already)
        }
        return rows.sortedBy { it.cy }
    }

    private fun openPhotoAndLike(): Boolean {
        if (findId(ID_BT_LIKE) != null) {
            return tapLike()
        }
        // Tap header photo area
        val photo = findId(ID_PHOTO_LIST)
        if (photo != null) {
            val r = android.graphics.Rect()
            photo.getBoundsInScreen(r)
            tap(r.exactCenterX(), r.centerY().toFloat().coerceAtMost(r.exactCenterY()))
        } else {
            val dm = resources.displayMetrics
            tap(dm.widthPixels / 2f, dm.widthPixels * 0.35f)
        }
        sleep(500)
        if (!waitForId(ID_BT_LIKE, 2500)) {
            log("  bt_like missing")
            return false
        }
        return tapLike()
    }

    private fun tapLike(): Boolean {
        val btn = findId(ID_BT_LIKE) ?: return false
        click(btn)
        sleep(250)
        log("  tapped bt_like")
        return true
    }

    private fun onProfile(): Boolean =
        findId(ID_START_CHAT) != null || findId(ID_DISPLAY) != null

    private fun onList(): Boolean = findId(ID_LAST_SEEN) != null

    private fun onLikePage(): Boolean = findId(ID_BT_LIKE) != null

    private fun ensureList() {
        if (!onList()) goBackToList()
    }

    private fun goBackToList() {
        repeat(3) {
            if (onList()) return
            if (onLikePage() || onProfile()) {
                performGlobalAction(GLOBAL_ACTION_BACK)
                sleep(280)
            } else {
                performGlobalAction(GLOBAL_ACTION_BACK)
                sleep(280)
            }
        }
    }

    private fun scrollList(skipCluster: Boolean) {
        val dm = resources.displayMetrics
        val cx = dm.widthPixels / 2f
        val (y1, y2) = if (skipCluster) {
            dm.heightPixels * 0.70f to dm.heightPixels * 0.40f
        } else {
            dm.heightPixels * 0.65f to dm.heightPixels * 0.52f
        }
        swipe(cx, y1, cx, y2, 250)
        sleep(if (skipCluster) 350 else 450)
    }

    // ---- helpers ----

    private fun findId(id: String): AccessibilityNodeInfo? {
        val root = rootInActiveWindow ?: return null
        return root.findAccessibilityNodeInfosByViewId(id)?.firstOrNull()
    }

    private fun findText(text: String): AccessibilityNodeInfo? {
        val root = rootInActiveWindow ?: return null
        return root.findAccessibilityNodeInfosByText(text)?.firstOrNull {
            it.text?.toString()?.equals(text, ignoreCase = true) == true ||
                it.text?.toString()?.contains(text, ignoreCase = true) == true
        }
    }

    private fun waitForId(id: String, timeoutMs: Long): Boolean {
        val end = SystemClock.uptimeMillis() + timeoutMs
        while (SystemClock.uptimeMillis() < end) {
            if (stopRequested) return false
            if (findId(id) != null) return true
            sleep(120)
        }
        return false
    }

    private fun collectText(node: AccessibilityNodeInfo): String {
        val sb = StringBuilder()
        fun walk(n: AccessibilityNodeInfo?) {
            if (n == null) return
            n.text?.let { sb.append(it).append(' ') }
            for (i in 0 until n.childCount) walk(n.getChild(i))
        }
        walk(node)
        return sb.toString()
    }

    private fun click(node: AccessibilityNodeInfo): Boolean {
        var n: AccessibilityNodeInfo? = node
        while (n != null) {
            if (n.isClickable) {
                return n.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            }
            n = n.parent
        }
        return node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
    }

    private fun tap(x: Float, y: Float) {
        if (Build.VERSION.SDK_INT < 24) return
        val path = Path().apply { moveTo(x, y) }
        val stroke = GestureDescription.StrokeDescription(path, 0, 50)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        dispatchGesture(gesture, null, null)
        sleep(80)
    }

    private fun swipe(x1: Float, y1: Float, x2: Float, y2: Float, durationMs: Long) {
        if (Build.VERSION.SDK_INT < 24) return
        val path = Path().apply {
            moveTo(x1, y1)
            lineTo(x2, y2)
        }
        val stroke = GestureDescription.StrokeDescription(path, 0, durationMs)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        dispatchGesture(gesture, null, null)
    }

    private fun sleep(ms: Long) {
        var left = ms
        while (left > 0 && !stopRequested) {
            val step = minOf(left, 100L)
            SystemClock.sleep(step)
            left -= step
        }
    }

    private fun log(msg: String) {
        sendBroadcast(Intent(Prefs.ACTION_LOG).setPackage(packageName).putExtra(Prefs.EXTRA_TEXT, msg))
    }

    private fun status(msg: String) {
        sendBroadcast(Intent(Prefs.ACTION_STATUS).setPackage(packageName).putExtra(Prefs.EXTRA_TEXT, msg))
    }
}
