package com.cjj.sayhilikes

import android.content.Context

/** Last bot run — saved by AccessibilityService so UI updates when user returns from SayHi. */
object RunStore {
    fun saveFinished(context: Context, liked: Int, names: List<String>) {
        context.getSharedPreferences(Prefs.PREFS, Context.MODE_PRIVATE).edit()
            .putInt(Prefs.KEY_LAST_LIKED, liked)
            .putString(Prefs.KEY_LAST_NAMES, names.joinToString("\n"))
            .putLong(Prefs.KEY_LAST_RUN_AT, System.currentTimeMillis())
            .apply()
    }

    fun lastLiked(context: Context): Int =
        context.getSharedPreferences(Prefs.PREFS, Context.MODE_PRIVATE)
            .getInt(Prefs.KEY_LAST_LIKED, 0)

    fun lastNames(context: Context): List<String> {
        val raw = context.getSharedPreferences(Prefs.PREFS, Context.MODE_PRIVATE)
            .getString(Prefs.KEY_LAST_NAMES, null) ?: return emptyList()
        if (raw.isBlank()) return emptyList()
        return raw.split("\n").filter { it.isNotBlank() }
    }

    fun isSubscription(context: Context): Boolean =
        context.getSharedPreferences(Prefs.PREFS, Context.MODE_PRIVATE)
            .getBoolean(Prefs.KEY_SUBSCRIPTION, false)
}
