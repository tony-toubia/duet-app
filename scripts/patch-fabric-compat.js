#!/usr/bin/env node
/**
 * iOS 26 Fabric Compatibility Patches
 *
 * On iOS 26, nativeFabricUIManager is set even when newArchEnabled is false.
 * Third-party libraries detect Fabric and call JSI methods that don't exist
 * because native modules were compiled without Fabric support.
 *
 * This script patches the source files directly so Metro bundles the fixed
 * versions. Runtime monkey-patching doesn't work because Metro's module IDs
 * differ from require() paths in production bundles.
 */
const fs = require('fs');
const path = require('path');

const PATCH_MARKER = '/* iOS26_FABRIC_PATCHED */';

// ---------------------------------------------------------------------------
// 1. react-native-gesture-handler: maybeInitializeFabric
//    Wraps RNGestureHandlerModule.install() in try-catch
// ---------------------------------------------------------------------------
function patchGestureHandler() {
  const paths = [
    path.join(__dirname, '..', 'node_modules', 'react-native-gesture-handler', 'lib', 'module', 'init.js'),
    path.join(__dirname, '..', 'node_modules', 'react-native-gesture-handler', 'lib', 'commonjs', 'init.js'),
    path.join(__dirname, '..', 'node_modules', 'react-native-gesture-handler', 'src', 'init.ts'),
  ];

  let patched = 0;
  for (const filePath of paths) {
    if (!fs.existsSync(filePath)) continue;

    let src = fs.readFileSync(filePath, 'utf8');
    if (src.includes(PATCH_MARKER)) {
      console.log(`[patch-fabric] ${path.basename(filePath)} already patched`);
      patched++;
      continue;
    }

    // ESM version: RNGestureHandlerModule.install();
    if (src.includes('RNGestureHandlerModule.install()')) {
      src = src.replace(
        'RNGestureHandlerModule.install();',
        `${PATCH_MARKER} try { RNGestureHandlerModule.install(); } catch(e) { /* Fabric JSI unavailable */ }`
      );
      fs.writeFileSync(filePath, src);
      console.log(`[patch-fabric] Patched ${path.basename(filePath)} (ESM/TS)`);
      patched++;
      continue;
    }

    // CJS version: _RNGestureHandlerModule.default.install();
    if (src.includes('_RNGestureHandlerModule.default.install()')) {
      src = src.replace(
        '_RNGestureHandlerModule.default.install();',
        `${PATCH_MARKER} try { _RNGestureHandlerModule.default.install(); } catch(e) { /* Fabric JSI unavailable */ }`
      );
      fs.writeFileSync(filePath, src);
      console.log(`[patch-fabric] Patched ${path.basename(filePath)} (CJS)`);
      patched++;
      continue;
    }

    console.warn(`[patch-fabric] WARNING: Could not find install() call in ${path.basename(filePath)}`);
  }

  if (patched === 0) {
    console.warn('[patch-fabric] WARNING: react-native-gesture-handler not found or no files patched');
  }
}

// ---------------------------------------------------------------------------
// 2. react-native-screens: ScreenGestureDetector RNScreensTurboModule usage
//    Wraps RNScreensTurboModule calls in null checks
// ---------------------------------------------------------------------------
function patchScreensGestureDetector() {
  const filePath = path.join(
    __dirname, '..', 'node_modules', 'react-native-screens',
    'lib', 'commonjs', 'gesture-handler', 'ScreenGestureDetector.js'
  );

  if (!fs.existsSync(filePath)) {
    // Try module path
    const altPath = filePath.replace('commonjs', 'module');
    if (!fs.existsSync(altPath)) {
      console.log('[patch-fabric] ScreenGestureDetector.js not found, skipping');
      return;
    }
  }

  // Check both paths
  for (const p of [filePath, filePath.replace('commonjs', 'module')]) {
    if (!fs.existsSync(p)) continue;

    let src = fs.readFileSync(p, 'utf8');
    if (src.includes(PATCH_MARKER)) {
      console.log(`[patch-fabric] ${path.basename(p)} already patched`);
      continue;
    }

    // Add null guard before any RNScreensTurboModule method calls
    if (src.includes('RNScreensTurboModule') && src.includes('startTransition')) {
      src = src.replace(
        /RNScreensTurboModule\.startTransition/g,
        `${PATCH_MARKER} RNScreensTurboModule?.startTransition`
      );
      fs.writeFileSync(p, src);
      console.log(`[patch-fabric] Patched ${path.basename(p)}`);
    }
  }
}

patchGestureHandler();
patchScreensGestureDetector();
console.log('[patch-fabric] Done');
