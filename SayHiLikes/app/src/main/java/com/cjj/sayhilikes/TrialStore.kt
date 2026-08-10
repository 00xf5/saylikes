package com.cjj.sayhilikes

import android.content.Context

/** Trial likes — enforced on device; synced to server when possible. */
object TrialStore {
    const val DEFAULT_TRIAL = 5

    fun left(context: Context): Int =
        context.getSharedPreferences(Prefs.PREFS, Context.MODE_PRIVATE)
            .getInt(Prefs.KEY_TRIAL_LEFT, DEFAULT_TRIAL)

    fun save(context: Context, left: Int) {
        context.getSharedPreferences(Prefs.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putInt(Prefs.KEY_TRIAL_LEFT, left.coerceAtLeast(0))
            .apply()
    }

    /** Call when a run finishes — returns likes remaining after deducting [liked]. */
    fun consume(context: Context, liked: Int, isSubscription: Boolean): Int {
        if (liked <= 0 || isSubscription) return left(context)
        val after = (left(context) - liked).coerceAtLeast(0)
        save(context, after)
        val uuid = DeviceId.get(context)
        Thread {
            try {
                ApiClient.consume(uuid, liked)
            } catch (_: Exception) {
                /* local count already saved */
            }
        }.start()
        return after
    }

    fun mergeWithServer(local: Int, server: Int, subscription: Boolean): Int {
        if (subscription) return server
        // Server must never raise trial above what the phone already used.
        return minOf(local, server)
    }
}
