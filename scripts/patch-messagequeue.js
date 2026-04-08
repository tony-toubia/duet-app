#!/usr/bin/env node
/**
 * Patches React Native to not crash when native code calls into an
 * unregistered JS module during startup (iOS 26 timing issue).
 *
 * On iOS 26, native view lifecycle events (RCTEventEmitter.receiveEvent)
 * fire BEFORE the JS bundle has finished loading.
 *
 * There are TWO code paths that throw this error:
 * 1. MessageQueue.__callFunction (JS) - uses invariant()
 * 2. ReactInstance::callFunctionOnModule (C++) - throws jsi::JSError
 *
 * This script patches BOTH.
 */
const fs = require('fs');
const path = require('path');

const PATCH_MARKER = '/* iOS26_MQ_PATCHED */';

// --- Patch 1: MessageQueue.js (JS level) ---
function patchMessageQueue() {
  const mqPath = path.join(
    __dirname, '..', 'node_modules', 'react-native',
    'Libraries', 'BatchedBridge', 'MessageQueue.js'
  );

  if (!fs.existsSync(mqPath)) {
    console.log('[patch-mq] MessageQueue.js not found, skipping');
    return;
  }

  let src = fs.readFileSync(mqPath, 'utf8');
  if (src.includes(PATCH_MARKER)) {
    console.log('[patch-mq] MessageQueue.js already patched');
    return;
  }

  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes('if (!moduleMethods)') &&
      i > 0 &&
      lines[i - 1].includes('getCallableModule')
    ) {
      lines.splice(i + 1, 0, `        return; ${PATCH_MARKER}`);
      fs.writeFileSync(mqPath, lines.join('\n'));
      console.log('[patch-mq] MessageQueue.js patched');
      return;
    }
  }
  console.error('[patch-mq] ERROR: Could not find patch location in MessageQueue.js');
}

// --- Patch 2: ReactInstance.cpp (native C++ level) ---
function patchReactInstance() {
  const cppPath = path.join(
    __dirname, '..', 'node_modules', 'react-native',
    'ReactCommon', 'react', 'runtime', 'ReactInstance.cpp'
  );

  if (!fs.existsSync(cppPath)) {
    console.log('[patch-mq] ReactInstance.cpp not found, skipping');
    return;
  }

  let src = fs.readFileSync(cppPath, 'utf8');
  if (src.includes(PATCH_MARKER)) {
    console.log('[patch-mq] ReactInstance.cpp already patched');
    return;
  }

  // Replace: if (it == callableModules_.end()) { ... throw ... }
  // With:    if (it == callableModules_.end()) { return; }
  const oldPattern = 'if (it == callableModules_.end()) {';
  const idx = src.indexOf(oldPattern);
  if (idx === -1) {
    console.error('[patch-mq] ERROR: Could not find patch location in ReactInstance.cpp');
    return;
  }

  // Find the matching closing brace for this if block
  const afterBrace = idx + oldPattern.length;
  let braceCount = 1;
  let pos = afterBrace;
  while (pos < src.length && braceCount > 0) {
    if (src[pos] === '{') braceCount++;
    if (src[pos] === '}') braceCount--;
    pos++;
  }

  // Replace the entire if block with a simple return
  const oldBlock = src.substring(idx, pos);
  const newBlock = `if (it == callableModules_.end()) { ${PATCH_MARKER}\n      return;\n    }`;

  src = src.replace(oldBlock, newBlock);
  fs.writeFileSync(cppPath, src);
  console.log('[patch-mq] ReactInstance.cpp patched');
}

patchMessageQueue();
patchReactInstance();
