package com.cjj.sayhilikes

import android.app.Application

class SayHiApp : Application() {
    override fun onCreate() {
        super.onCreate()
        ApiClient.baseUrl = getString(R.string.api_base_url)
    }
}
