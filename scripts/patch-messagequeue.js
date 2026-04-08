#!/usr/bin/env node
/**
 * Patches React Native's MessageQueue.js to not crash when native code
 * calls into an unregistered JS module during startup.
 *
 * On iOS 26, native view lifecycle events (RCTEventEmitter.receiveEvent)
 * fire BEFORE the JS bundle has finished loading. MessageQueue.__callFunction
 * throws a fatal invariant error for unregistered modules, killing the app.
 *
 * This patch replaces the invariant throw with a silent return.
 */
const fs = require('fs');
const path = require('path');

const mqPath = path.join(
  __dirname, '..', 'node_modules', 'react-native',
  'Libraries', 'BatchedBridge', 'MessageQueue.js'
);

if (!fs.existsSync(mqPath)) {
  console.log('[patch-messagequeue] MessageQueue.js not found, skipping');
  process.exit(0);
}

let src = fs.readFileSync(mqPath, 'utf8');

if (src.includes('/* iOS26_MQ_PATCHED */')) {
  console.log('[patch-messagequeue] Already patched');
  process.exit(0);
}

// Find the line: "if (!moduleMethods) {" that comes after "getCallableModule"
const lines = src.split('\n');
let patched = false;

for (let i = 0; i < lines.length; i++) {
  if (
    lines[i].includes('if (!moduleMethods)') &&
    i > 0 &&
    lines[i - 1].includes('getCallableModule')
  ) {
    // Insert "return;" as the first statement inside the if block
    lines.splice(i + 1, 0, '        return; /* iOS26_MQ_PATCHED */');
    patched = true;
    break;
  }
}

if (patched) {
  fs.writeFileSync(mqPath, lines.join('\n'));
  console.log('[patch-messagequeue] Successfully patched MessageQueue.js');
} else {
  console.error('[patch-messagequeue] ERROR: Could not find patch location');
  process.exit(1);
}
