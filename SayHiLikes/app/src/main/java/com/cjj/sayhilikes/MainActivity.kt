package com.cjj.sayhilikes

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.provider.Settings
import android.text.TextUtils
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.cjj.sayhilikes.databinding.ActivityMainBinding
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val io = Executors.newSingleThreadExecutor()
    private var canStart = false
    private var isSubscription = false
    private var trialLeft = 0

    private val loginOptions = listOf("15 minutes", "1 hour", "1 day", "3 days")
    private val speedOptions = listOf("Fast", "Normal", "Slow")

    private var receiverRegistered = false

    private fun isUiAlive(): Boolean =
        !isFinishing && !isDestroyed && ::binding.isInitialized

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                Prefs.ACTION_LOG -> {
                    val text = intent.getStringExtra(Prefs.EXTRA_TEXT) ?: return
                    runOnUiThread { if (isUiAlive()) appendLog(text) }
                }
                Prefs.ACTION_STATUS -> {
                    val text = intent.getStringExtra(Prefs.EXTRA_TEXT) ?: return
                    runOnUiThread { if (isUiAlive()) binding.txtStatus.text = text }
                }
                Prefs.ACTION_FINISHED -> {
                    val liked = intent.getIntExtra(Prefs.EXTRA_LIKED, 0)
                    val names = intent.getStringArrayListExtra(Prefs.EXTRA_NAMES).orEmpty()
                    runOnUiThread {
                        if (!isUiAlive()) return@runOnUiThread
                        showLikedNames(names.ifEmpty { RunStore.lastNames(this@MainActivity) })
                        if (liked > 0) appendLog("Run finished: $liked new like(s)")
                        refreshButtons()
                        refreshLicense(DeviceId.get(this@MainActivity))
                    }
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        ApiClient.baseUrl = getString(R.string.api_base_url)

        val uuid = DeviceId.get(this)
        binding.txtDeviceId.text = "Device ID: $uuid"

        binding.spinnerLoginWithin.adapter = ArrayAdapter(
            this, R.layout.spinner_item, loginOptions
        ).also { it.setDropDownViewResource(R.layout.spinner_dropdown_item) }

        binding.spinnerSpeed.adapter = ArrayAdapter(
            this, R.layout.spinner_item, speedOptions
        ).also { it.setDropDownViewResource(R.layout.spinner_dropdown_item) }

        val prefs = getSharedPreferences(Prefs.PREFS, MODE_PRIVATE)
        binding.inputMaxLikes.setText(prefs.getInt(Prefs.KEY_MAX, 5).toString())
        selectSpinner(binding.spinnerLoginWithin, loginOptions, prefs.getString(Prefs.KEY_LOGIN, "15 minutes"))
        selectSpinner(binding.spinnerSpeed, speedOptions, prefs.getString(Prefs.KEY_SPEED, "Fast"))

        binding.btnHowTo.setOnClickListener {
            startActivity(Intent(this, OnboardingActivity::class.java))
        }

        binding.btnAccessibility.setOnClickListener {
            AccessibilitySetup.showGuide(this)
        }

        binding.btnOpenSayHi.setOnClickListener {
            val launch = packageManager.getLaunchIntentForPackage("com.unearby.sayhi")
            if (launch == null) {
                Toast.makeText(this, "SayHi is not installed", Toast.LENGTH_LONG).show()
            } else {
                startActivity(launch)
            }
        }

        binding.btnStart.setOnClickListener { startBot() }
        binding.btnStop.setOnClickListener { stopBot() }

        refreshLicense(uuid)
        registerBotReceiver()
    }

    private fun registerBotReceiver() {
        if (receiverRegistered) return
        val filter = IntentFilter().apply {
            addAction(Prefs.ACTION_LOG)
            addAction(Prefs.ACTION_STATUS)
            addAction(Prefs.ACTION_FINISHED)
        }
        ContextCompat.registerReceiver(this, receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
        receiverRegistered = true
    }

    private fun unregisterBotReceiver() {
        if (!receiverRegistered) return
        try {
            unregisterReceiver(receiver)
        } catch (_: Exception) {
        }
        receiverRegistered = false
    }

    override fun onResume() {
        super.onResume()
        showLastRunIfIdle()
        refreshButtons()
        refreshLicense(DeviceId.get(this))
    }

    override fun onDestroy() {
        unregisterBotReceiver()
        super.onDestroy()
    }

    private fun selectSpinner(spinner: android.widget.Spinner, options: List<String>, value: String?) {
        val idx = options.indexOf(value).coerceAtLeast(0)
        spinner.setSelection(idx)
    }

    /** Paid sub uses server; trial never goes back up when server still says 5. */
    private fun mergeTrial(lic: ApiClient.License): ApiClient.License {
        if (lic.subscription) return lic
        val local = TrialStore.left(this)
        val merged = TrialStore.mergeWithServer(local, lic.trialLikesRemaining, false)
        if (merged == lic.trialLikesRemaining && lic.active == (merged > 0)) {
            return if (merged > 0) lic.copy(message = "") else lic
        }
        val msg = if (merged > 0) "" else lic.message
        return lic.copy(active = merged > 0, trialLikesRemaining = merged, message = msg)
    }

    private fun applyLicense(lic: ApiClient.License) {
        if (!isUiAlive()) return
        val effective = mergeTrial(lic)
        canStart = effective.active
        isSubscription = effective.subscription
        trialLeft = effective.trialLikesRemaining
        TrialStore.save(this, trialLeft)
        getSharedPreferences(Prefs.PREFS, MODE_PRIVATE).edit()
            .putBoolean(Prefs.KEY_SUBSCRIPTION, effective.subscription)
            .apply()

        binding.txtSubStatus.text = when {
            effective.subscription -> buildString {
                append("Subscription: ACTIVE")
                effective.expiresAt?.let {
                    append(" · expires ")
                    append(SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(it)))
                }
            }
            effective.trialLikesRemaining > 0 ->
                "Trial: ${effective.trialLikesRemaining} free likes left"
            else ->
                effective.message.ifBlank {
                    "INACTIVE — Contact admin on Telegram @godfather_bott"
                }
        }
        binding.txtSubStatus.setTextColor(
            when {
                effective.subscription -> 0xFF80CBC4.toInt()
                effective.trialLikesRemaining > 0 -> 0xFFFFCC80.toInt()
                else -> 0xFFEF9A9A.toInt()
            }
        )
        if (!effective.subscription && effective.trialLikesRemaining in 1..5) {
            val cur = binding.inputMaxLikes.text.toString().toIntOrNull() ?: 5
            if (cur > effective.trialLikesRemaining) {
                binding.inputMaxLikes.setText(effective.trialLikesRemaining.toString())
            }
        }
        refreshButtons()
    }

    private fun refreshLicense(uuid: String) {
        io.execute {
            val lic = try {
                ApiClient.registerAndStatus(uuid)
            } catch (e: Exception) {
                val left = TrialStore.left(this@MainActivity)
                ApiClient.License(
                    active = left > 0,
                    expiresAt = null,
                    message = "",
                    trialLikesRemaining = left,
                    subscription = false
                )
            }
            runOnUiThread {
                if (!isUiAlive()) return@runOnUiThread
                var effective = lic
                if (!lic.supportsTrial && !lic.active) {
                    val left = TrialStore.left(this@MainActivity)
                    effective = lic.copy(
                        active = left > 0,
                        trialLikesRemaining = left,
                        message = ""
                    )
                }
                applyLicense(effective)
            }
        }
    }

    private fun showLastRunIfIdle() {
        val running = getSharedPreferences(Prefs.PREFS, MODE_PRIVATE)
            .getBoolean(Prefs.KEY_RUNNING, false)
        if (running) return
        val names = RunStore.lastNames(this)
        if (names.isNotEmpty() || RunStore.lastLiked(this) > 0) {
            showLikedNames(names)
        }
    }

    private fun startBot() {
        if (!isSubscription && TrialStore.left(this) <= 0) {
            canStart = false
            refreshButtons()
            Toast.makeText(
                this,
                "No likes left. Contact admin on Telegram @godfather_bott",
                Toast.LENGTH_LONG
            ).show()
            return
        }
        if (!canStart) {
            Toast.makeText(
                this,
                "No likes left. Contact admin on Telegram @godfather_bott",
                Toast.LENGTH_LONG
            ).show()
            return
        }
        if (!isAccessibilityEnabled()) {
            binding.txtStatus.text = getString(R.string.status_need_access)
            Toast.makeText(this, R.string.status_need_access, Toast.LENGTH_LONG).show()
            return
        }
        val svc = LikeAccessibilityService.instance
        if (svc == null) {
            Toast.makeText(this, "Toggle Accessibility OFF then ON, then retry", Toast.LENGTH_LONG).show()
            return
        }
        var max = binding.inputMaxLikes.text.toString().toIntOrNull()?.coerceIn(1, 200) ?: 5
        if (!isSubscription) {
            max = max.coerceAtMost(trialLeft.coerceAtLeast(1)).coerceAtMost(5)
            binding.inputMaxLikes.setText(max.toString())
        }
        val login = binding.spinnerLoginWithin.selectedItem.toString()
        val speed = binding.spinnerSpeed.selectedItem.toString()
        getSharedPreferences(Prefs.PREFS, MODE_PRIVATE).edit()
            .putInt(Prefs.KEY_MAX, max)
            .putString(Prefs.KEY_LOGIN, login)
            .putString(Prefs.KEY_SPEED, speed)
            .putBoolean(Prefs.KEY_RUNNING, true)
            .apply()

        binding.txtLikedNames.text = "Running… names will list here when finished."
        appendLog("Starting… switch to SayHi if needed")
        binding.btnStart.isEnabled = false
        binding.btnStop.isEnabled = true
        binding.txtStatus.text = getString(R.string.status_running)

        packageManager.getLaunchIntentForPackage("com.unearby.sayhi")?.let { startActivity(it) }
        binding.root.postDelayed({
            LikeAccessibilityService.instance?.startBot(max, login, speed)
        }, 800)
    }

    private fun stopBot() {
        LikeAccessibilityService.stopRequested = true
        LikeAccessibilityService.instance?.requestStop()
        getSharedPreferences(Prefs.PREFS, MODE_PRIVATE).edit()
            .putBoolean(Prefs.KEY_RUNNING, false).apply()
        binding.btnStart.isEnabled = true
        binding.btnStop.isEnabled = false
        binding.txtStatus.text = "Stopping…"
        appendLog("Stop pressed")
    }

    private fun showLikedNames(names: List<String>) {
        binding.txtLikedNames.text = if (names.isEmpty()) {
            getString(R.string.liked_none_yet)
        } else {
            names.mapIndexed { i, n -> "${i + 1}. $n" }.joinToString("\n")
        }
    }

    private fun refreshButtons() {
        val running = getSharedPreferences(Prefs.PREFS, MODE_PRIVATE)
            .getBoolean(Prefs.KEY_RUNNING, false)
        binding.btnStart.isEnabled = !running && canStart
        binding.btnStop.isEnabled = running
        if (!isAccessibilityEnabled()) {
            binding.txtStatus.text = getString(R.string.status_need_access)
        } else if (!running) {
            binding.txtStatus.text = getString(R.string.status_ready)
        }
    }

    private fun appendLog(line: String) {
        if (!isUiAlive()) return
        val cur = binding.txtLog.text?.toString().orEmpty()
        val next = if (cur.length > 12000) cur.takeLast(8000) + "\n…\n" + line else cur + line
        binding.txtLog.text = next + "\n"
    }

    private fun isAccessibilityEnabled(): Boolean {
        val expected = "$packageName/${LikeAccessibilityService::class.java.canonicalName}"
        val enabled = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        val splitter = TextUtils.SimpleStringSplitter(':')
        splitter.setString(enabled)
        while (splitter.hasNext()) {
            if (splitter.next().equals(expected, ignoreCase = true)) return true
        }
        return false
    }
}
