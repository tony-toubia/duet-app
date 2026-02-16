const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Adds <queries> to AndroidManifest.xml so Linking.canOpenURL()
 * works on Android 11+ (API 30+) for third-party app deep links.
 */
module.exports = function withAndroidQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Schemes we need to query (must match NavigationWidget ALL_APPS)
    const schemes = [
      "spotify",
      "youtube",
      "youtubemusic",
      "comgooglemaps",
      "waze",
      "google.navigation",
    ];

    // Build <queries> → <intent> entries for each scheme
    const intents = schemes.map((scheme) => ({
      action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
      data: [{ $: { "android:scheme": scheme } }],
    }));

    // Ensure <queries> exists
    if (!manifest.queries) {
      manifest.queries = [];
    }

    // Add a single <queries> block with all intents
    manifest.queries.push({ intent: intents });

    return config;
  });
};
