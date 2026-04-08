const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to fix iOS 26 crash: "Failed to call into JavaScript
 * module method RCTEventEmitter.receiveEvent(). Module has not been
 * registered as callable."
 *
 * On iOS 26, native view lifecycle events (onWillAppear/onAppear from
 * react-native-screens) fire via RCTEventEmitter.receiveEvent() BEFORE
 * the JS bundle has finished loading and registered the module. React
 * Native's MessageQueue.__callFunction throws an invariant error for
 * unregistered modules, which propagates as a fatal native exception.
 *
 * This plugin patches MessageQueue.js to silently return instead of
 * crashing when a module isn't registered as callable.
 */
function withMessageQueueFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const mqPath = path.join(
        config.modRequest.projectRoot,
        'node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js'
      );

      if (!fs.existsSync(mqPath)) {
        console.warn('[withMessageQueueFix] MessageQueue.js not found at', mqPath);
        return config;
      }

      let src = fs.readFileSync(mqPath, 'utf8');

      // Already patched?
      if (src.includes('/* iOS26_MQ_PATCHED */')) {
        console.log('[withMessageQueueFix] Already patched');
        return config;
      }

      // Strategy: find "if (!moduleMethods) {" inside __callFunction and
      // inject "return; /* iOS26_MQ_PATCHED */" as the first line of the block.
      // This is whitespace-agnostic since we use a regex.

      // The pattern we're looking for in __callFunction:
      //   const moduleMethods = this.getCallableModule(module);
      //   if (!moduleMethods) {
      //     ... invariant(...) ...
      //   }
      // We replace it with:
      //   const moduleMethods = this.getCallableModule(module);
      //   if (!moduleMethods) {
      //     return; /* iOS26_MQ_PATCHED */
      //   }

      const regex = /(const moduleMethods\s*=\s*this\.getCallableModule\(module\);\s*if\s*\(!moduleMethods\)\s*\{)([\s\S]*?)(^\s*\})/m;

      if (regex.test(src)) {
        src = src.replace(regex, '$1\n        return; /* iOS26_MQ_PATCHED */\n$3');
        fs.writeFileSync(mqPath, src);
        console.log('[withMessageQueueFix] Successfully patched MessageQueue.js');
      } else {
        // Fallback: simpler line-by-line approach
        const lines = src.split('\n');
        let patched = false;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('if (!moduleMethods)') && i > 0 && lines[i - 1].includes('getCallableModule')) {
            // Found the right if block. Insert return as the next line after the opening brace.
            // The opening brace is on the same line as the if.
            lines.splice(i + 1, 0, '        return; /* iOS26_MQ_PATCHED */');
            patched = true;
            console.log('[withMessageQueueFix] Patched via line-by-line fallback at line', i + 1);
            break;
          }
        }
        if (patched) {
          fs.writeFileSync(mqPath, lines.join('\n'));
        } else {
          console.error('[withMessageQueueFix] FAILED to find patch location in MessageQueue.js');
        }
      }

      return config;
    },
  ]);
}

module.exports = withMessageQueueFix;
