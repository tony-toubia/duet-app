/**
 * iOS 26 Fabric Compatibility — Runtime Patches
 *
 * Complements scripts/patch-fabric-compat.js (postinstall, patches source files).
 * This file handles runtime globals that can't be fixed via source patching.
 *
 * Must be imported early in App.tsx, before any navigation/screens imports.
 */

// react-native-screens: ScreenGestureDetector reads global.RNScreensTurboModule
// (a JSI binding only present in Fabric builds). Stub it so property access
// on undefined doesn't crash if the source-level patch misses a code path.
if (typeof global.RNScreensTurboModule === 'undefined') {
  global.RNScreensTurboModule = null;
}
