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
 * use Paper (old arch) code paths throughout. React's core renderer still uses
 * nativeFabricUIManager directly — it doesn't go through these libraries' isFabric().
 *
 * This script patches source files directly so Metro bundles the fixed versions.
 * Runtime monkey-patching via require() doesn't work because Metro production
 * bundles use numeric module IDs.
 */
const fs = require('fs');
const path = require('path');

const PATCH_MARKER = '/* iOS26_FABRIC_PATCHED */';

// ---------------------------------------------------------------------------
// 1. react-native-gesture-handler: Force isFabric() to return false
//    This prevents ALL Fabric code paths: install(), ripple color processing,
//    event config, view flattening checks, etc.
// ---------------------------------------------------------------------------
function patchGestureHandlerIsFabric() {
  const utilsPaths = [
    path.join(__dirname, '..', 'node_modules', 'react-native-gesture-handler', 'lib', 'module', 'utils.js'),
    path.join(__dirname, '..', 'node_modules', 'react-native-gesture-handler', 'lib', 'commonjs', 'utils.js'),
    path.join(__dirname, '..', 'node_modules', 'react-native-gesture-handler', 'src', 'utils.ts'),
  ];

  let patched = 0;
  for (const filePath of utilsPaths) {
    if (!fs.existsSync(filePath)) continue;

    let src = fs.readFileSync(filePath, 'utf8');
    if (src.includes(PATCH_MARKER)) {
      console.log(`[patch-fabric] ${path.basename(filePath)} (utils) already patched`);
      patched++;
      continue;
    }

    // Match the isFabric function body and replace with return false
    // ESM/TS: export function isFabric() { ... return !!global?.nativeFabricUIManager; }
    // CJS: function isFabric() { ... return !!global?.nativeFabricUIManager; }
    const isFabricPattern = /(function isFabric\(\)\s*\{)[^}]*?(return\s+!!global\?\.nativeFabricUIManager;)\s*\}/;
    if (isFabricPattern.test(src)) {
      src = src.replace(isFabricPattern, `$1 ${PATCH_MARKER} return false; }`);
      fs.writeFileSync(filePath, src);
      console.log(`[patch-fabric] Patched isFabric() in ${path.basename(filePath)}`);
      patched++;
    } else {
      console.warn(`[patch-fabric] WARNING: Could not find isFabric() in ${path.basename(filePath)}`);
    }
  }

  if (patched === 0) {
    console.warn('[patch-fabric] WARNING: react-native-gesture-handler utils not found');
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

patchGestureHandlerIsFabric();
patchScreensGestureDetector();
console.log('[patch-fabric] Done');
