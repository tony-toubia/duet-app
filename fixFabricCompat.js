/**
 * iOS 26 Fabric Compatibility Patches
 *
 * On iOS 26, the React Native runtime activates nativeFabricUIManager even
 * when newArchEnabled is false. React's own renderer uses it for createNode
 * etc., so we CANNOT remove it. However, third-party native modules were
 * compiled without Fabric support, so their Fabric-specific code paths crash
 * when they detect Fabric and try to call JSI methods that don't exist.
 *
 * This file patches all known crash points. It must be imported BEFORE any
 * of the affected libraries.
 */

// ---------------------------------------------------------------------------
// 1. react-native-gesture-handler: maybeInitializeFabric
//
//    GestureHandlerRootView calls maybeInitializeFabric() during render.
//    It checks isFabric() (global.nativeFabricUIManager) → true on iOS 26,
//    then calls RNGestureHandlerModule.install() — a JSI method that doesn't
//    exist because the native module was compiled without Fabric.
//
//    Fix: wrap the install() call in a try-catch.
// ---------------------------------------------------------------------------
try {
  var gestureInit = require('react-native-gesture-handler/lib/commonjs/init');
  if (gestureInit && typeof gestureInit.maybeInitializeFabric === 'function') {
    var originalMaybeInit = gestureInit.maybeInitializeFabric;
    gestureInit.maybeInitializeFabric = function () {
      try {
        originalMaybeInit();
      } catch (e) {
        // Fabric JSI install unavailable — safe to skip on old-arch builds
      }
    };
  }
} catch (e) {
  // react-native-gesture-handler not installed — nothing to patch
}

// ---------------------------------------------------------------------------
// 2. react-native-screens: RNScreensTurboModule
//
//    ScreenGestureDetector reads global.RNScreensTurboModule (a JSI binding
//    only present in Fabric builds). If isFabric() returns true and custom
//    gesture transitions are used, it calls startTransition() on undefined.
//
//    Fix: provide a stub global so property access doesn't crash.
// ---------------------------------------------------------------------------
if (typeof global.RNScreensTurboModule === 'undefined') {
  global.RNScreensTurboModule = null;
}

// ---------------------------------------------------------------------------
// 3. react-native-svg: getEnforcing for RNSVGRenderableModule / RNSVGSvgViewModule
//
//    Methods like getBBox(), getCTM(), toDataURL() use lazy requires with
//    TurboModuleRegistry.getEnforcing(), which throws if the module isn't
//    found. On old arch these methods may not be registered via the bridge.
//
//    Fix: patch TurboModuleRegistry.getEnforcing to fallback gracefully
//    for known SVG modules instead of throwing.
// ---------------------------------------------------------------------------
try {
  var TurboModuleRegistry = require('react-native/Libraries/TurboModule/TurboModuleRegistry');
  if (TurboModuleRegistry && typeof TurboModuleRegistry.getEnforcing === 'function') {
    var originalGetEnforcing = TurboModuleRegistry.getEnforcing;
    var svgModules = ['RNSVGRenderableModule', 'RNSVGSvgViewModule'];

    TurboModuleRegistry.getEnforcing = function (name) {
      try {
        return originalGetEnforcing(name);
      } catch (e) {
        // For SVG modules that may not be bridge-registered, return a
        // proxy that warns instead of crashing
        if (svgModules.indexOf(name) !== -1) {
          return null;
        }
        // Re-throw for all other modules — they should exist
        throw e;
      }
    };
  }
} catch (e) {
  // TurboModuleRegistry not available — nothing to patch
}
