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
 * Registering a no-op stub here makes the module callable immediately.  The
 * React Renderer overwrites it with the real implementation moments later, so
 * only events that arrive during the tiny startup window are silently dropped
 * (initial screen lifecycle events that are harmless to lose).
 */
const BatchedBridge = require('react-native/Libraries/BatchedBridge/BatchedBridge');

BatchedBridge.registerCallableModule('RCTEventEmitter', {
  receiveEvent: function () {},
  receiveTouches: function () {},
});
