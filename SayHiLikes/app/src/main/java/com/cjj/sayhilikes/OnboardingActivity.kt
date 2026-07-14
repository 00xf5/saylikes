package com.cjj.sayhilikes

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.MediaController
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.cjj.sayhilikes.databinding.ActivityOnboardingBinding
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

class OnboardingActivity : AppCompatActivity() {

    private lateinit var binding: ActivityOnboardingBinding
    private val io = Executors.newSingleThreadExecutor()
    private var howTo: ApiClient.HowTo = ApiClient.defaultHowTo()
    private lateinit var deviceUuid: String

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityOnboardingBinding.inflate(layoutInflater)
        setContentView(binding.root)
        ApiClient.baseUrl = getString(R.string.api_base_url)

        deviceUuid = DeviceId.get(this)
        binding.txtUuid.text = deviceUuid
        renderPricing(howTo)

        binding.btnCopyUuid.setOnClickListener {
            val cm = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
            cm.setPrimaryClip(ClipData.newPlainText("device-id", deviceUuid))
            Toast.makeText(this, "Device ID copied", Toast.LENGTH_SHORT).show()
        }

        binding.btnContactAdmin.setOnClickListener { contactAdmin() }

        binding.btnContinue.isEnabled = true
        binding.btnContinue.setOnClickListener {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }

        loadRemote()
    }

    private fun contactAdmin() {
        val weekly = howTo.priceWeeklyNgn
        val monthly = howTo.priceMonthlyNgn
        val msg = """
            Hi Admin, I want SayHi Likes subscription.

            Device ID: $deviceUuid

            Plans:
            • Weekly: ₦${formatNgn(weekly)}
            • Monthly: ₦${formatNgn(monthly)}

            Please activate my Device ID. I will pay Weekly / Monthly (tell me which).
        """.trimIndent()

        val tg = howTo.adminTelegram.ifBlank {
            getString(R.string.default_admin_telegram)
        }.removePrefix("@").trim()

        if (tg.isBlank()) {
            val share = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, msg)
            }
            startActivity(Intent.createChooser(share, "Contact admin"))
            return
        }

        val url = "https://t.me/$tg?text=${Uri.encode(msg)}"
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (_: Exception) {
            val share = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, msg)
            }
            startActivity(Intent.createChooser(share, "Contact admin"))
        }
    }

    private fun formatNgn(n: Int): String =
        NumberFormat.getNumberInstance(Locale.US).format(n)

    private fun renderPricing(how: ApiClient.HowTo) {
        binding.txtPricing.text =
            "Weekly: ₦${formatNgn(how.priceWeeklyNgn)}\nMonthly: ₦${formatNgn(how.priceMonthlyNgn)}\n\n5 free likes for testing per device"
    }

    private fun loadRemote() {
        io.execute {
            try {
                val how = try {
                    ApiClient.howTo()
                } catch (_: Exception) {
                    ApiClient.defaultHowTo()
                }
                val license = try {
                    ApiClient.registerAndStatus(deviceUuid)
                } catch (e: Exception) {
                    ApiClient.License(false, null, "Offline / server unreachable: ${e.message}")
                }
                runOnUiThread {
                    howTo = how
                    bind(how, license)
                }
            } catch (e: Exception) {
                runOnUiThread {
                    binding.txtHowTo.text = ApiClient.defaultHowToText()
                    binding.txtLicense.text = "Could not reach server: ${e.message}"
                }
            }
        }
    }

    private fun bind(how: ApiClient.HowTo, license: ApiClient.License) {
        binding.txtHowTo.text = how.text
        renderPricing(how)
        binding.txtLicense.text = buildString {
            when {
                license.subscription -> append("Subscription: ACTIVE")
                license.trialLikesRemaining > 0 ->
                    append("Trial: ${license.trialLikesRemaining} free likes left")
                else -> append("Subscription: INACTIVE")
            }
            append("\n")
            append(license.message)
            license.expiresAt?.let {
                val fmt = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US)
                append("\nExpires: ")
                append(fmt.format(Date(it)))
            }
            if (!license.subscription) {
                append("\n\nTap Contact Admin (Telegram @OOxf5) — Device ID is included.")
            }
        }

        val url = how.videoUrl
        if (!url.isNullOrBlank()) {
            binding.txtVideoPlaceholder.visibility = android.view.View.GONE
            try {
                val vv = binding.videoHowTo
                vv.setMediaController(MediaController(this).also { it.setAnchorView(vv) })
                vv.setVideoURI(Uri.parse(url))
                vv.setOnPreparedListener { it.isLooping = false }
            } catch (_: Exception) {
                binding.txtVideoPlaceholder.visibility = android.view.View.VISIBLE
                binding.txtVideoPlaceholder.text = "Video failed to load"
            }
        } else {
            binding.txtVideoPlaceholder.visibility = android.view.View.VISIBLE
        }
    }
}
