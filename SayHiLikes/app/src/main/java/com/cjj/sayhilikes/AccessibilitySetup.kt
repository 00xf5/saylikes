package com.cjj.sayhilikes

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity

object AccessibilitySetup {

    fun openAppSettings(context: Context) {
        context.startActivity(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", context.packageName, null)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        )
    }

    fun openAccessibilitySettings(context: Context) {
        context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
    }

    fun showGuide(activity: AppCompatActivity) {
        AlertDialog.Builder(activity)
            .setTitle(R.string.a11y_guide_title)
            .setMessage(R.string.a11y_guide_body)
            .setPositiveButton(R.string.a11y_open_app_settings) { _, _ ->
                openAppSettings(activity)
            }
            .setNeutralButton(R.string.a11y_open_accessibility) { _, _ ->
                openAccessibilitySettings(activity)
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }
}
