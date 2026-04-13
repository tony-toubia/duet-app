#!/usr/bin/env node
/**
 * iOS 26 Fabric Compatibility Patches
 *
 * On iOS 26, nativeFabricUIManager is set even when newArchEnabled is false.
 * Third-party libraries detect Fabric via isFabric() and use Fabric code paths
 * that call JSI methods compiled out of the native modules (Paper/old arch build).
 * These calls throw C++ exceptions that crash the app.
 *
 * The fix: patch isFabric() to return false in each affected library, so they
 * use Paper (old arch) code paths throughout.
 */
const fs = require('fs');
const path = require('path');

const PATCH_MARKER = '/* iOS26_FABRIC_PATCHED */';

// ---------------------------------------------------------------------------
// 1. react-native-gesture-handler: Force isFabric() to return false
//    This prevents ALL Fabric code paths: install(), ripple color, events, etc.
//    Also wrap install() in try-catch as a safety net.
// ---------------------------------------------------------------------------
function patchGestureHandler() {
  // --- Patch isFabric() in utils files ---
  const utilsPaths = [
    path.join(__dirname, '..', 'node_modules', 'react-native-gesture-handler', 'lib', 'module', 'utils.js'),
    path.join(__dirname, '..', 'node_modules', 'react-native-gesture-handler', 'lib', 'commonjs', 'utils.js'),
    path.join(__dirname, '..', 'node_modules', 'react-native-gesture-handler', 'src', 'utils.ts'),
  ];

  for (const filePath of utilsPaths) {
    if (!fs.existsSync(filePath)) continue;

    let src = fs.readFileSync(filePath, 'utf8');
    if (src.includes(PATCH_MARKER)) {
      console.log(`[patch-fabric] ${filePath} already patched`);
      continue;
    }

    // Simple string replacement — replace the isFabric return with false
    const target = 'return !!global?.nativeFabricUIManager;';
    if (src.includes(target)) {
      src = src.replace(target, `${PATCH_MARKER} return false;`);
      fs.writeFileSync(filePath, src);
      console.log(`[patch-fabric] Patched isFabric() in ${filePath}`);
    } else {
      console.warn(`[patch-fabric] WARNING: Could not find isFabric target in ${filePath}`);
      // Log what the file contains around "isFabric" for debugging
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        if (line.includes('isFabric')) {
          console.log(`[patch-fabric]   line ${i + 1}: ${line.trim()}`);
        }
      });
    }
  }

  // --- Also wrap install() in try-catch as safety net ---
  const initPaths = [
    path.join(__dirname, '..', 'node_modules', 'react-native-gesture-handler', 'lib', 'module', 'init.js'),
    path.join(__dirname, '..', 'node_modules', 'react-native-gesture-handler', 'lib', 'commonjs', 'init.js'),
    path.join(__dirname, '..', 'node_modules', 'react-native-gesture-handler', 'src', 'init.ts'),
  ];

  for (const filePath of initPaths) {
    if (!fs.existsSync(filePath)) continue;

    let src = fs.readFileSync(filePath, 'utf8');
    if (src.includes(PATCH_MARKER)) {
      console.log(`[patch-fabric] ${filePath} already patched`);
      continue;
    }

    let patched = false;

    // ESM/TS: RNGestureHandlerModule.install();
    // iOS26: Completely disable install() — gesture-handler's Paper-mode install()
    // sets up RNGestureHandlerRootHelper which conflicts with Fabric's
    // RCTSurfaceTouchHandler, causing ALL touches on non-initial screens to be swallowed.
    if (src.includes('RNGestureHandlerModule.install();')) {
      src = src.replace(
        'RNGestureHandlerModule.install();',
        `${PATCH_MARKER} /* install() disabled — Paper touch infra conflicts with Fabric RCTSurfaceTouchHandler */`
      );
      patched = true;
    }

    // CJS: _RNGestureHandlerModule.default.install();
    if (src.includes('_RNGestureHandlerModule.default.install();')) {
      src = src.replace(
        '_RNGestureHandlerModule.default.install();',
        `${PATCH_MARKER} /* install() disabled — Paper touch infra conflicts with Fabric RCTSurfaceTouchHandler */`
      );
      patched = true;
    }

    if (patched) {
      fs.writeFileSync(filePath, src);
      console.log(`[patch-fabric] Patched install() in ${filePath}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. react-native-screens: ScreenGestureDetector RNScreensTurboModule usage
//    Wraps RNScreensTurboModule calls in null checks
// ---------------------------------------------------------------------------
function patchScreensGestureDetector() {
  const basePath = path.join(
    __dirname, '..', 'node_modules', 'react-native-screens',
    'lib'
  );

  for (const variant of ['commonjs', 'module']) {
    const p = path.join(basePath, variant, 'gesture-handler', 'ScreenGestureDetector.js');
    if (!fs.existsSync(p)) continue;

    let src = fs.readFileSync(p, 'utf8');
    if (src.includes(PATCH_MARKER)) {
      console.log(`[patch-fabric] ${p} already patched`);
      continue;
    }

    if (src.includes('RNScreensTurboModule') && src.includes('startTransition')) {
      src = src.replace(
        /RNScreensTurboModule\.startTransition/g,
        `${PATCH_MARKER} RNScreensTurboModule?.startTransition`
      );
      fs.writeFileSync(p, src);
      console.log(`[patch-fabric] Patched ${p}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. @react-navigation/stack Card.js: Force useNativeDriver = false
//    On iOS 26, native-driven Animated.spring/timing animations in the Card
//    component may crash. Force JS-driven animations as a workaround.
// ---------------------------------------------------------------------------
function patchCardNativeDriver() {
  const cardPaths = [
    path.join(__dirname, '..', 'node_modules', '@react-navigation', 'stack', 'lib', 'module', 'views', 'Stack', 'Card.js'),
    path.join(__dirname, '..', 'node_modules', '@react-navigation', 'stack', 'lib', 'commonjs', 'views', 'Stack', 'Card.js'),
  ];

  const target = "const useNativeDriver = Platform.OS !== 'web';";
  const replacement = `${PATCH_MARKER} const useNativeDriver = false;`;

  for (const filePath of cardPaths) {
    if (!fs.existsSync(filePath)) continue;

    let src = fs.readFileSync(filePath, 'utf8');
    if (src.includes(PATCH_MARKER)) {
      console.log(`[patch-fabric] ${filePath} already patched`);
      continue;
    }

    if (src.includes(target)) {
      src = src.replace(target, replacement);
      fs.writeFileSync(filePath, src);
      console.log(`[patch-fabric] Patched useNativeDriver in ${filePath}`);
    } else {
      console.warn(`[patch-fabric] WARNING: Could not find useNativeDriver target in ${filePath}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. @react-navigation/stack CardStack.js: Force detachInactiveScreens = false
//    On iOS 26, detachInactiveScreens defaults to true, which passes enabled:true
//    to MaybeScreen/MaybeScreenContainer, OVERRIDING enableScreens(false).
//    This causes native ScreenNativeComponent/ScreenContainerNativeComponent to
//    render, which crash on iOS 26 with the Fabric false-positive.
// ---------------------------------------------------------------------------
function patchCardStackDetach() {
  const cardStackPaths = [
    path.join(__dirname, '..', 'node_modules', '@react-navigation', 'stack', 'lib', 'module', 'views', 'Stack', 'CardStack.js'),
    path.join(__dirname, '..', 'node_modules', '@react-navigation', 'stack', 'lib', 'commonjs', 'views', 'Stack', 'CardStack.js'),
  ];

  const target = "detachInactiveScreens = Platform.OS === 'web' || Platform.OS === 'android' || Platform.OS === 'ios'";
  const replacement = `${PATCH_MARKER} detachInactiveScreens = false`;

  for (const filePath of cardStackPaths) {
    if (!fs.existsSync(filePath)) continue;

    let src = fs.readFileSync(filePath, 'utf8');
    if (src.includes(PATCH_MARKER)) {
      console.log(`[patch-fabric] ${filePath} already patched`);
      continue;
    }

    if (src.includes(target)) {
      src = src.replace(target, replacement);
      fs.writeFileSync(filePath, src);
      console.log(`[patch-fabric] Patched detachInactiveScreens in ${filePath}`);
    } else {
      console.warn(`[patch-fabric] WARNING: Could not find detachInactiveScreens target in ${filePath}`);
    }
  }
}

patchGestureHandler();
patchScreensGestureDetector();
patchCardNativeDriver();
patchCardStackDetach();
console.log('[patch-fabric] Done');
