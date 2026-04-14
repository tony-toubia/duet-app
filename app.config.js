const fs = require('fs');

const googleServicesPlist = process.env.GOOGLE_SERVICES_PLIST || "./GoogleService-Info.plist";
const googleServicesJson = process.env.GOOGLE_SERVICES_JSON || "./google-services.json";

module.exports = {
  "react-native-google-mobile-ads": {
    android_app_id: process.env.ADMOB_ANDROID_APP_ID || "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy",
    ios_app_id: process.env.ADMOB_IOS_APP_ID || "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy",
  },
  expo: {
    name: "Duet",
    slug: "duet",
    scheme: "duet",
    version: "0.2.1",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "cover",
      backgroundColor: "#1a1a2e"
    },
    assetBundlePatterns: ["**/*"],
    jsEngine: "jsc",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.duet.app",
      buildNumber: "106",
      jsEngine: "jsc",
      ...(fs.existsSync(googleServicesPlist) ? { googleServicesFile: googleServicesPlist } : {}),
      associatedDomains: [
        "applinks:duet-33cf5.firebaseapp.com",
        "applinks:getduet.app"
      ],
      entitlements: {
        "aps-environment": "production"
      },
      infoPlist: {
        RCTNewArchEnabled: false,
        NSMicrophoneUsageDescription: "Duet needs microphone access to enable voice communication with your partner.",
        NSLocalNetworkUsageDescription: "Duet uses your local network to establish peer-to-peer voice connections.",
        UIBackgroundModes: ["audio"],
        BGTaskSchedulerPermittedIdentifiers: ["com.duet.audio"],
        ITSAppUsesNonExemptEncryption: false,
        LSApplicationQueriesSchemes: [
          "spotify",
          "youtube",
          "youtubemusic",
          "comgooglemaps",
          "waze"
        ]
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#1a1a2e"
      },
      package: "com.duet.app",
      versionCode: 70,
      ...(fs.existsSync(googleServicesJson) ? { googleServicesFile: googleServicesJson } : {}),
      intentFilters: [
        {
          action: "VIEW",
          data: [
            {
              scheme: "https",
              host: "duet-33cf5.firebaseapp.com",
              pathPrefix: "/__/auth/links"
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        },
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "getduet.app",
              pathPrefix: "/app"
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        }
      ],
      permissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "android.permission.BLUETOOTH",
        "android.permission.BLUETOOTH_CONNECT",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_MICROPHONE",
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.WAKE_LOCK",
        "android.permission.ACCESS_WIFI_STATE",
        "android.permission.CHANGE_WIFI_STATE",
        "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
        "com.google.android.gms.permission.AD_ID"
      ]
    },
    plugins: [
      "@react-native-firebase/app",
      "@react-native-firebase/crashlytics",
      "@react-native-google-signin/google-signin",
      [
        "expo-build-properties",
        {
          android: {
            minSdkVersion: 24,
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            enableProguardInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            newArchEnabled: false,
          },
          ios: {
            deploymentTarget: "15.1",
            useFrameworks: "static",
            newArchEnabled: false,
            jsEngine: "jsc", // Hermes crashes on physical iOS 26 devices (PAC incompatibility) — use JSC until fixed
          }
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Duet needs access to your photos to set your profile picture.",
          cameraPermission: "Duet needs access to your camera to take a profile picture."
        }
      ],
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: process.env.ADMOB_ANDROID_APP_ID || "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy",
          iosAppId: process.env.ADMOB_IOS_APP_ID || "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy",
          delayAppMeasurementInit: true
        }
      ],
      "expo-apple-authentication",
      "./plugins/withDuetAudio",
      "./plugins/withAndroidQueries",
      "./plugins/withMessageQueueFix",
      "./plugins/withFmtFix",
      "./plugins/withForceJSC",
      "./plugins/withThirdPartyComponentsFix"
    ],
    extra: {
      eas: {
        projectId: "201e2c63-094a-45f4-b8f5-2a08c00fca37"
      },
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID || "",
      admobBannerIdAndroid: process.env.ADMOB_BANNER_ID_ANDROID || "",
      admobBannerIdIos: process.env.ADMOB_BANNER_ID_IOS || "",
      admobInterstitialIdAndroid: process.env.ADMOB_INTERSTITIAL_ID_ANDROID || "",
      admobInterstitialIdIos: process.env.ADMOB_INTERSTITIAL_ID_IOS || "",
      admobNativeIdAndroid: process.env.ADMOB_NATIVE_ID_ANDROID || "",
      admobNativeIdIos: process.env.ADMOB_NATIVE_ID_IOS || "",
      admobRewardedIdAndroid: process.env.ADMOB_REWARDED_ID_ANDROID || "",
      admobRewardedIdIos: process.env.ADMOB_REWARDED_ID_IOS || "",
      admobLobbyNativeIdAndroid: process.env.ADMOB_LOBBY_NATIVE_ID_ANDROID || "",
      admobLobbyNativeIdIos: process.env.ADMOB_LOBBY_NATIVE_ID_IOS || "",
      turnServerIp: process.env.TURN_SERVER_IP || "",
      turnUsername: process.env.TURN_USERNAME || "",
      turnPassword: process.env.TURN_PASSWORD || "",
    },
    owner: "tonytoubia"
  }
};
