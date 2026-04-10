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
    if (src.includes('RNGestureHandlerModule.install();')) {
      src = src.replace(
        'RNGestureHandlerModule.install();',
        `${PATCH_MARKER} try { RNGestureHandlerModule.install(); } catch(e) { /* Fabric JSI unavailable */ }`
      );
      patched = true;
    }

    // CJS: _RNGestureHandlerModule.default.install();
    if (src.includes('_RNGestureHandlerModule.default.install();')) {
      src = src.replace(
        '_RNGestureHandlerModule.default.install();',
        `${PATCH_MARKER} try { _RNGestureHandlerModule.default.install(); } catch(e) { /* Fabric JSI unavailable */ }`
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

patchGestureHandler();
patchScreensGestureDetector();
console.log('[patch-fabric] Done');
