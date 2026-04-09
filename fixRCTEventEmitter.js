/**
 * iOS 26 fix: Pre-register a stub RCTEventEmitter JS module.
 *
 * On iOS 26 the native view lifecycle fires earlier relative to JS bundle
 * evaluation.  react-native-screens dispatches onWillAppear / onAppear events
 * via RCTComponentEvent → RCTEventEmitter.receiveEvent() before the React
 * Renderer has called RCTEventEmitter.register().  Because the module is not
 * yet "callable", MessageQueue.__callFunction throws and the app crashes:
 *
 *   "Failed to call into JavaScript module method
 *    RCTEventEmitter.receiveEvent(). Module has not been registered as
 *    callable."
 *
 * This stub makes the module callable immediately.  The React Renderer
 * overwrites it with the real implementation moments later.
 */

// Try multiple ways to access BatchedBridge — the internal require path
// may not resolve on all JS engines / bundler configurations.
var bridge = null;
try {
  bridge = require('react-native/Libraries/BatchedBridge/BatchedBridge');
} catch (e) {
  // Fallback: the global reference set by React Native during init
  bridge = global.__fbBatchedBridge;
}

if (bridge && typeof bridge.registerCallableModule === 'function') {
  bridge.registerCallableModule('RCTEventEmitter', {
    receiveEvent: function () {},
    receiveTouches: function () {},
  });
}

/**
 * iOS 26 fix: Disable false Fabric detection.
 *
 * On iOS 26, global.nativeFabricUIManager is set even when Fabric (New
 * Architecture) is disabled.  react-native-gesture-handler's isFabric()
 * checks this global and, when truthy, calls
 * RNGestureHandlerModule.install() — a TurboModule method that doesn't
 * exist without Fabric.  This causes a crash:
 *
 *   "TypeError: undefined is not a function (at maybeInitializeFabric)"
 *
 * Since Fabric is explicitly disabled in this build, removing the false
 * positive is safe and prevents the crash.
 */
if (global.nativeFabricUIManager) {
  global.nativeFabricUIManager = undefined;
}
