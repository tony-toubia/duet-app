module.exports = {
  expo: {
    name: "Duet",
    slug: "duet",
    version: "0.2.1",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#1a1a2e"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.duet.app",
      buildNumber: "4",
      googleServicesFile: process.env.GOOGLE_SERVICES_PLIST || "./GoogleService-Info.plist",
      associatedDomains: [
        "applinks:duet-33cf5.firebaseapp.com"
      ],
      entitlements: {
        "aps-environment": "development"
      },
      infoPlist: {
        NSMicrophoneUsageDescription: "Duet needs microphone access to enable voice communication with your partner.",
        UIBackgroundModes: ["audio", "voip"],
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
      versionCode: 4,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "duet-33cf5.firebaseapp.com",
              pathPrefix: "/__/auth/links"
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
        "android.permission.WAKE_LOCK"
      ],
      blockedPermissions: [
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO"
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
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            enableProguardInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
          },
          ios: {
            useFrameworks: "static"
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
          iosAppId: process.env.ADMOB_IOS_APP_ID || "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy"
        }
      ],
      "./plugins/withDuetAudio"
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
      turnServerIp: process.env.TURN_SERVER_IP || "",
      turnUsername: process.env.TURN_USERNAME || "",
      turnPassword: process.env.TURN_PASSWORD || "",
    },
    owner: "tonytoubia"
  }
};
