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
 * This plugin patches MessageQueue.js to silently ignore calls to
 * unregistered modules (specifically RCTEventEmitter) instead of
 * crashing. The events are harmless initial lifecycle events that
 * can safely be dropped.
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
      if (src.includes('iOS 26 fix: silently ignore')) {
        console.log('[withMessageQueueFix] Already patched');
        return config;
      }

      // Find the pattern:
      //   const moduleMethods = this.getCallableModule(module);
      //   if (!moduleMethods) {
      // And replace the body of the if block to return early instead of throwing
      const oldPattern = `const moduleMethods = this.getCallableModule(module);
      if (!moduleMethods) {`;

      const newPattern = `const moduleMethods = this.getCallableModule(module);
      if (!moduleMethods) {
        // iOS 26 fix: silently ignore calls to unregistered modules during startup.
        // Native view lifecycle events fire before JS module registration on iOS 26.
        return;`;

      if (src.includes(oldPattern)) {
        // We need to also remove the original body of the if block up to the closing }
        // The old if block contains: variable declarations, invariant call, closing }
        // We replace the entire if (!moduleMethods) { ... } block

        // Find the start of the if block
        const ifStart = src.indexOf(oldPattern);
        const afterIfOpen = ifStart + oldPattern.length;

        // Count braces to find the matching closing brace
        let braceCount = 1;
        let pos = afterIfOpen;
        while (pos < src.length && braceCount > 0) {
          if (src[pos] === '{') braceCount++;
          if (src[pos] === '}') braceCount--;
          pos++;
        }
        // pos now points to just after the closing brace of if (!moduleMethods) { ... }

        const oldBlock = src.substring(ifStart, pos);
        const newBlock = `const moduleMethods = this.getCallableModule(module);
      if (!moduleMethods) {
        // iOS 26 fix: silently ignore calls to unregistered modules during startup.
        // Native view lifecycle events fire before JS module registration on iOS 26.
        return;
      }`;

        src = src.replace(oldBlock, newBlock);
        fs.writeFileSync(mqPath, src);
        console.log('[withMessageQueueFix] Successfully patched MessageQueue.js');
      } else {
        console.warn('[withMessageQueueFix] Could not find expected pattern in MessageQueue.js');
      }

      return config;
    },
  ]);
}

module.exports = withMessageQueueFix;
