const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to fix fmt library build error with Xcode 16.4+ / iOS 26 SDK.
 *
 * The fmt C++ library (dependency of React Native via Folly) uses C++20 consteval,
 * but Apple Clang 17+ (shipped with Xcode 16.4 for iOS 26) has stricter consteval
 * validation that rejects fmt's patterns. This plugin injects a post_install hook
 * into the Podfile that downgrades fmt to C++17, disabling consteval.
 */
function withFmtFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      const fmtFixSnippet = `
    # Fix fmt consteval build error with Xcode 16.4+ / iOS 26 SDK.
    # The bundled fmt library uses C++20 consteval which the newer Apple Clang
    # rejects. Downgrading fmt to C++17 disables consteval and fixes the build.
    installer.pods_project.targets.each do |target|
      if target.name == 'fmt'
        target.build_configurations.each do |bc|
          bc.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        end
      end
    end`;

      // Don't add if already present
      if (podfile.includes("target.name == 'fmt'")) {
        return config;
      }

      // Insert before the closing `end` of the post_install block.
      // The Expo-generated Podfile has: post_install do |installer| ... end
      // We need to inject our code just before the final `end` of post_install.
      // Look for the react_native_post_install call and append after its closing paren.
      const postInstallRegex = /(react_native_post_install\([^)]*\))\s*\n(\s*end)/;
      if (postInstallRegex.test(podfile)) {
        podfile = podfile.replace(postInstallRegex, `$1\n${fmtFixSnippet}\n$2`);
      } else {
        // Fallback: try to find post_install block end
        const fallbackRegex = /(post_install\s+do\s+\|installer\|[\s\S]*?)((\n\s*end\s*\n\s*end))/;
        if (fallbackRegex.test(podfile)) {
          podfile = podfile.replace(fallbackRegex, `$1\n${fmtFixSnippet}$2`);
        } else {
          console.warn('[withFmtFix] Could not find post_install block in Podfile. Appending fix manually.');
          // Last resort: append a new post_install block (will merge with existing)
          podfile += `\npost_install do |installer|\n${fmtFixSnippet}\nend\n`;
        }
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
}

module.exports = withFmtFix;
