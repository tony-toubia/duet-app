# Duet App - Project Context

## Project Overview
- React Native 0.81.5 / Expo SDK 54 / **JSC** (not Hermes) / Old Architecture (Fabric disabled)
- iOS bundle ID: com.duet.app
- EAS project ID: 201e2c63-094a-45f4-b8f5-2a08c00fca37
- Current build: 99

## Environment Notes
- Node: `/opt/homebrew/Cellar/node/25.9.0_1/bin/node` - must prepend to PATH for CLI commands
- No global `eas` CLI - use `npx --yes eas-cli` instead
- EAS build image: `macos-sequoia-15.6-xcode-26.0`
- iPad device ID: `30252B82-984D-58EE-9C1C-837D14D6C084`
- Launch: `xcrun devicectl device process launch --console --terminate-existing --device <ID> com.duet.app`
- Crash logs: `xcrun devicectl device copy from --domain-type systemCrashLogs --source / --destination /tmp/duet-crash --device <ID>`

## Critical iOS 26 Bugs & Fixes

### 1. RN 0.81.5 forces Hermes despite jsEngine:"jsc" (builds 72-81)
- `react_native_pods.rb` hardcodes `hermes_enabled = true`
- JSC requires `@react-native-community/javascriptcore` + `USE_THIRD_PARTY_JSC=1` + `USE_HERMES=0`
- Fix: Multi-part patch in `patches/react-native+0.81.5.patch` (see details in memory/MEMORY.md)

### 2. Bridgeless mode activates Fabric despite newArchEnabled=false (builds 93-97)
- iOS 26 bridgeless mode installs `nativeFabricUIManager` on JS global
- ReactFabric renderer is ALWAYS used in bridgeless mode (cannot delete nativeFabricUIManager - causes ReferenceError)
- Fabric component descriptors not fully initialized -> null constructor/name fields
- **Crash chain**: JS `createNode()` -> `UIManagerBinding` -> `ComponentDescriptorRegistry::at()` -> `_registerComponentIfPossible` -> `registerComponentViewClass` -> class returns zero-init provider (default `return {}` in `UIView+ComponentViewProtocol.mm`) -> `_registrationStatusMap.insert({provider.name, true})` with NULL name -> `strlen(NULL)` -> SIGSEGV
- Also: null `constructor` in provider -> jump to 0x0 -> SIGKILL/CODESIGNING
- **Fix** (in `patches/react-native+0.81.5.patch`):
  - `RCTComponentViewFactory.mm`: Guard `registerComponentViewClass` + fallback paths against null `constructor`/`name`
  - `ComponentDescriptorRegistry.cpp`: Null guard + try-catch on constructor call
  - `ComponentDescriptorProviderRegistry.cpp`: Reject providers with null fields
- **JS-level fix**: `scripts/patch-fabric-compat.js` patches gesture-handler and screens `isFabric()` to return false
- `fixFabricCompat.js`: Stubs `global.RNScreensTurboModule` (imported early in App.tsx)

### 2b. Fabric mounting crash for interop-registered components (build 98)
- Components with zero-init providers (SVG, etc.) get descriptors created via `useFabricInterop` in `ComponentDescriptorRegistry::at()`
- But this only registers in C++ `_registryByName`/`_registryByHandle`, NOT in ObjC `_componentViewClasses`
- When Fabric mounts, `createComponentViewWithComponentHandle` can't find them → dereferences end iterator → SIGSEGV at null+0x18
- **Fix**: Fallback to `RCTLegacyViewManagerInteropComponentView` when componentHandle not in `_componentViewClasses`

### 3. RCTEventEmitter.receiveEvent() crash
- Native events fire BEFORE JS bundle loads on iOS 26
- Error thrown from MessageQueue.js (JS) AND ReactInstance.cpp (C++)
- Fix: `scripts/patch-messagequeue.js` + `fixRCTEventEmitter.js` (pre-registers stub module)

### 4. react-native-screens black screen / SIGKILL
- `enableScreens(false)` insufficient - CardStack.js overrides with `detachInactiveScreens = true`
- Fix: `enableScreens(false)` + `detachInactiveScreens={false}` + postinstall patch

### 5. RCTThirdPartyComponentsProvider nil dictionary
- Fix: `plugins/withThirdPartyComponentsFix.js`

### 6. SafeAreaProvider dark screen
- `onInsetsChange` never fires (Fabric false-positive) -> children never render
- Fix: Pass `initialMetrics` to `<SafeAreaProvider>` in App.tsx

### 7. TurboModule use-after-free (builds 73-78)
- `const char* methodName` dangling pointer on async dispatch
- Fix: `NSString *safeMethodName = @(methodName)` before block

### 8. fmt C++17 Build Fix
- Apple Clang 17+ rejects fmt's C++20 consteval -> `plugins/withFmtFix.js`

## Custom Expo Config Plugins (in `plugins/`)
- `withFmtFix.js` - fmt C++17 build fix
- `withThirdPartyComponentsFix.js` - RCTThirdPartyComponentsProvider nil crash fix
- `withDuetAudio.js` - Audio background mode config
- `withAndroidQueries.js` - Android intent queries
- `withForceJSC.js` - Forces JSC in Podfile.properties.json
- `withMessageQueueFix.js` - Patches MessageQueue.js (backup)

## Key Lessons
- **RN 0.81.5 ignores jsEngine:"jsc"** - always verify via crash reports which engine runs
- **Bridgeless mode = ReactFabric always** - cannot switch to Paper renderer via JS
- **`UIView+ComponentViewProtocol.mm` default `componentDescriptorProvider` returns `{}`** - zero-initialized struct with all null fields. Any class not overriding this will crash Fabric registration.
- iOS 26 code signing monitor sends SIGKILL (not SIGSEGV) for null pointer execution - look for `CODESIGNING` namespace
- `devicectl --console` captures stderr but NOT os_log
- Apple App Store Connect has daily upload limits
- When debugging native crashes, search ALL source files for error messages - JS and C++ may have separate code paths
- Expo config plugins are more reliable than `patch-package` for build-time fixes on EAS
