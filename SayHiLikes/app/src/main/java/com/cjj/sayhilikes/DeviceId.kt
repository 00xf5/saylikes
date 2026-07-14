package com.cjj.sayhilikes

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import java.io.File
import java.util.UUID

/**
 * Stable device id that survives uninstall when the Documents backup file remains.
 * Order: prefs → MediaStore Documents backup → create new + write both.
 */
object DeviceId {
    private const val PREF_KEY = "device_uuid"
    private const val FILE_NAME = "sayhilikes_device_id.txt"
    private const val REL_PATH = "Documents/SayHiLikes"

    fun get(context: Context): String {
        val prefs = context.getSharedPreferences(Prefs.PREFS, Context.MODE_PRIVATE)
        prefs.getString(PREF_KEY, null)?.takeIf { it.isNotBlank() }?.let { return it }

        val recovered = readFromMediaStore(context) ?: readFromLegacyFile()
        if (!recovered.isNullOrBlank()) {
            prefs.edit().putString(PREF_KEY, recovered).apply()
            return recovered
        }

        val created = UUID.randomUUID().toString()
        prefs.edit().putString(PREF_KEY, created).apply()
        writeBackup(context, created)
        return created
    }

    private fun writeBackup(context: Context, uuid: String) {
        try {
            writeMediaStore(context, uuid)
        } catch (_: Exception) {
        }
        try {
            val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), "SayHiLikes")
            if (!dir.exists()) dir.mkdirs()
            File(dir, FILE_NAME).writeText(uuid)
        } catch (_: Exception) {
        }
    }

    private fun writeMediaStore(context: Context, uuid: String) {
        if (Build.VERSION.SDK_INT < 29) return
        // Update existing if present
        val existing = findMediaUri(context)
        if (existing != null) {
            context.contentResolver.openOutputStream(existing, "wt")?.use { it.write(uuid.toByteArray()) }
            return
        }
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, FILE_NAME)
            put(MediaStore.MediaColumns.MIME_TYPE, "text/plain")
            put(MediaStore.MediaColumns.RELATIVE_PATH, REL_PATH)
        }
        val uri = context.contentResolver.insert(MediaStore.Files.getContentUri("external"), values)
            ?: return
        context.contentResolver.openOutputStream(uri)?.use { it.write(uuid.toByteArray()) }
    }

    private fun readFromMediaStore(context: Context): String? {
        if (Build.VERSION.SDK_INT < 29) return null
        val uri = findMediaUri(context) ?: return null
        return context.contentResolver.openInputStream(uri)?.bufferedReader()?.readText()?.trim()
    }

    private fun findMediaUri(context: Context): Uri? {
        val collection = MediaStore.Files.getContentUri("external")
        val projection = arrayOf(MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME)
        context.contentResolver.query(
            collection,
            projection,
            "${MediaStore.MediaColumns.DISPLAY_NAME}=?",
            arrayOf(FILE_NAME),
            null
        )?.use { c ->
            if (c.moveToFirst()) {
                val id = c.getLong(0)
                return Uri.withAppendedPath(collection, id.toString())
            }
        }
        return null
    }

    private fun readFromLegacyFile(): String? {
        return try {
            val f = File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS),
                "SayHiLikes/$FILE_NAME"
            )
            if (f.exists()) f.readText().trim().ifBlank { null } else null
        } catch (_: Exception) {
            null
        }
    }
}
