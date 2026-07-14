package com.cjj.sayhilikes

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object ApiClient {
    var baseUrl: String = "https://saylikes.vercel.app"

    data class HowTo(
        val text: String,
        val videoUrl: String?,
        val adminTelegram: String,
        val priceWeeklyNgn: Int,
        val priceMonthlyNgn: Int
    )

    data class License(
        val active: Boolean,
        val expiresAt: Long?,
        val message: String,
        val trialLikesRemaining: Int = 0,
        val subscription: Boolean = false,
        /** False when talking to an older API that doesn't know about trial likes. */
        val supportsTrial: Boolean = true
    )

    fun registerAndStatus(uuid: String): License {
        val body = JSONObject().put("uuid", uuid).toString()
        val json = request("POST", "/api/device/register", body, null)
        return parseLicense(json)
    }

    fun status(uuid: String): License {
        val json = request("GET", "/api/device/status?uuid=${uri(uuid)}", null, null)
        return parseLicense(json)
    }

    fun consume(uuid: String, count: Int): License {
        val body = JSONObject().put("uuid", uuid).put("count", count).toString()
        val json = request("POST", "/api/device/consume", body, null)
        return parseLicense(json)
    }

    fun howTo(): HowTo {
        val json = request("GET", "/api/howto", null, null)
        return HowTo(
            text = json.optString("text", defaultHowToText()),
            videoUrl = json.optString("videoUrl", "").takeIf { it.isNotBlank() },
            adminTelegram = json.optString("adminTelegram", "OOxf5").removePrefix("@"),
            priceWeeklyNgn = json.optInt("priceWeeklyNgn", 7000),
            priceMonthlyNgn = json.optInt("priceMonthlyNgn", 20000)
        )
    }

    fun defaultHowTo(): HowTo = HowTo(
        text = defaultHowToText(),
        videoUrl = null,
        adminTelegram = "OOxf5",
        priceWeeklyNgn = 7000,
        priceMonthlyNgn = 20000
    )

    private fun parseLicense(json: JSONObject): License {
        return License(
            active = json.optBoolean("active", false),
            expiresAt = if (json.has("expiresAt") && !json.isNull("expiresAt")) json.optLong("expiresAt") else null,
            message = json.optString("message", if (json.optBoolean("active")) "Active" else "No active subscription"),
            trialLikesRemaining = json.optInt("trialLikesRemaining", 0),
            subscription = json.optBoolean("subscription", false),
            supportsTrial = json.has("trialLikesRemaining") || json.has("subscription")
        )
    }

    private fun request(method: String, path: String, body: String?, adminToken: String?): JSONObject {
        val conn = (URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15000
            readTimeout = 20000
            setRequestProperty("Accept", "application/json")
            if (adminToken != null) setRequestProperty("x-admin-token", adminToken)
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                outputStream.use { it.write(body.toByteArray()) }
            }
        }
        val code = conn.responseCode
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        val text = stream?.bufferedReader()?.readText().orEmpty().ifBlank { "{}" }
        conn.disconnect()
        val json = try {
            JSONObject(text)
        } catch (_: Exception) {
            JSONObject().put("error", text).put("active", false)
        }
        if (code !in 200..299 && !json.has("message")) {
            json.put("message", json.optString("error", "HTTP $code"))
            json.put("active", false)
        }
        return json
    }

    private fun uri(s: String) = java.net.URLEncoder.encode(s, "UTF-8")

    fun defaultHowToText(): String = """
        1) Enable Accessibility for SayHi Likes
        2) Open SayHi on the Find tab
        3) Come back here and press Start
        4) Tap Contact Admin on Telegram — your Device ID is sent automatically
        5) Each new device gets 5 free likes for testing
    """.trimIndent()
}
