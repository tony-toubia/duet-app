const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to force JavaScriptCore (JSC) instead of Hermes.
 *
 * Hermes crashes on physical iOS 26 devices due to ARM64 PAC (Pointer
 * Authentication Codes) incompatibility in the HadesGC worker thread.
 * See: https://github.com/facebook/hermes/issues/1957
 *
 * The expo-build-properties plugin's jsEngine:"jsc" setting sometimes
 * fails to update Podfile.properties.json during EAS prebuild. This
 * plugin directly patches the file as a reliable fallback.
 */
function withForceJSC(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const propsPath = path.join(config.modRequest.platformProjectRoot, 'Podfile.properties.json');

      if (fs.existsSync(propsPath)) {
        const props = JSON.parse(fs.readFileSync(propsPath, 'utf8'));
        if (props['expo.jsEngine'] !== 'jsc') {
          console.log('[withForceJSC] Overriding expo.jsEngine from', JSON.stringify(props['expo.jsEngine']), 'to "jsc"');
          props['expo.jsEngine'] = 'jsc';
          fs.writeFileSync(propsPath, JSON.stringify(props, null, 2) + '\n');
        } else {
          console.log('[withForceJSC] expo.jsEngine already set to "jsc"');
        }
      } else {
        console.warn('[withForceJSC] Podfile.properties.json not found at', propsPath);
      }

      return config;
    },
  ]);
}

module.exports = withForceJSC;
