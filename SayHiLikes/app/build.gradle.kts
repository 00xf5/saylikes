plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.cjj.sayhilikes"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.cjj.sayhilikes"
        minSdk = 24
        targetSdk = 34
        versionCode = 4
        versionName = "1.0.3"
    }

    signingConfigs {
        create("release") {
            val keystore = rootProject.file("sayhi-release.keystore")
            if (keystore.exists()) {
                storeFile = keystore
                storePassword = "sayhilikes"
                keyAlias = "sayhi"
                keyPassword = "sayhilikes"
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            val keystore = rootProject.file("sayhi-release.keystore")
            if (keystore.exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        viewBinding = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.2.0")
}
