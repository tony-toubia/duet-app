# iOS 26 Compatibility Fixes for Duet

> React Native 0.81.5 / Expo SDK 54 / JSC / Old Architecture (Fabric disabled)
> Builds 59–101 | April 2026

This document chronicles the chain of crashes encountered when running Duet on iOS 26 (iPad) and the fixes applied across ~40 builds.

---

## Table of Contents

1. [Hermes PAC Crash (Builds 72–91)](#1-hermes-pac-crash)
2. [RCTEventEmitter Early-Fire Crash (Builds 73–78)](#2-rcteventemitter-early-fire-crash)
3. [TurboModule Use-After-Free (Builds 73–78)](#3-turbomodule-use-after-free)
4. [react-native-screens Black Screen / SIGKILL (Builds 59–65)](#4-react-native-screens-black-screen)
5. [RCTThirdPartyComponentsProvider nil Dictionary](#5-rctthirdpartycomponentsprovider-nil-dictionary)
6. [SafeAreaProvider Dark Screen (Builds 69–72)](#6-safeareaprovider-dark-screen)
7. [Fabric False-Positive & Null Descriptor Crashes (Builds 93–97)](#7-fabric-false-positive--null-descriptor-crashes)
8. [Fabric Mounting Crash for Interop Components (Build 98)](#8-fabric-mounting-crash-for-interop-components)
9. [Touch Blocking from Fallback Views (Builds 99–101)](#9-touch-blocking-from-fallback-views)
10. [fmt C++17 Build Failure](#10-fmt-c17-build-failure)
11. [File Inventory](#11-file-inventory)

---

## 1. Hermes PAC Crash

**Builds**: 72–91
**Signal**: SIGKILL (CODESIGNING namespace, "Invalid Page")
**Root cause**: RN 0.81.5's `react_native_pods.rb` hardcodes `hermes_enabled = true` on line 76, ignoring the `jsEngine: "jsc"` setting in `app.config.js`. Hermes uses Pointer Authentication Codes (PAC) that are incompatible with iOS 26's code-signing enforcement on physical devices, causing an immediate SIGKILL on launch.

### Fix (multi-part)

All changes live in `patches/react-native+0.81.5.patch`:

| File | Change |
|------|--------|
| `react_native_pods.rb` | Skip `error_if_try_to_use_jsc_from_core()` when `USE_THIRD_PARTY_JSC=1`; set `hermes_enabled = !use_third_party_jsc()` |
| `React-utils.podspec` | Remove `depend_on_js_engine(s)` to break circular pod dependency |
| `RCTCxxBridge.mm` | Add `JSCExecutorFactory` class + `#if USE_THIRD_PARTY_JSC == 1` guards |
| `RCTAppSetupUtils.mm` | JSCExecutorFactory bridged-mode support |
| `RCTAppSetupUtils.h` | Use `__has_include` instead of `USE_THIRD_PARTY_JSC` preprocessor flag |
| `RCTDefaultReactNativeFactoryDelegate.mm` | Create `JSCRuntimeFactory` for bridgeless mode (NOT nullptr — build 91 proved nullptr causes SIGSEGV) |
| `React-jsc.podspec` | Only include `common/*.{cpp,h}` (exclude `ios/` Bridgeless files) |

Additional dependencies:
- `@react-native-community/javascriptcore@0.2.0` added to `package.json`
- `patches/@react-native-community+javascriptcore+0.2.0.patch` — compatibility patch
- `patches/expo-modules-core+3.0.29.patch` — guard `hermes/hermes.h` import, add `JSCRuntime.h` fallback
- `eas.json` production env: `USE_THIRD_PARTY_JSC=1` AND `USE_HERMES=0`
  - `USE_HERMES=0` is critical: expo-modules-core defaults `use_hermes=true` when `USE_HERMES` env is nil
- `plugins/withForceJSC.js` — forces JSC in `Podfile.properties.json`

### Key lesson

`jsEngine: "jsc"` in app.config.js does nothing in RN 0.81.5. Always verify via crash reports or `Podfile.lock` which JS engine actually runs.

---

## 2. RCTEventEmitter Early-Fire Crash

**Builds**: 73–78
**Error**: `"Failed to call into JavaScript module method RCTEventEmitter.receiveEvent(). Module has not been registered as callable."`
**Root cause**: On iOS 26, native view lifecycle events (`onWillAppear`, `onAppear`) fire BEFORE the JS bundle finishes loading. The error is thrown from **two** independent code paths:
1. `MessageQueue.js` (`__callFunction` → `invariant()`)
2. `ReactInstance.cpp` (`callFunctionOnModule` → `jsi::JSError`)

### Fix

- **`scripts/patch-messagequeue.js`** (postinstall): Patches both `MessageQueue.js` (adds early return when module not registered) and `ReactInstance.cpp` (replaces throw with return)
- **`fixRCTEventEmitter.js`** (runtime, imported first in App.tsx): Pre-registers a stub `RCTEventEmitter` module on `BatchedBridge` so the module is callable from the moment the bundle starts evaluating

---

## 3. TurboModule Use-After-Free

**Builds**: 73–78
**Signal**: SIGSEGV (dangling pointer dereference)
**Root cause**: In the TurboModule dispatch path, `const char* methodName` is captured by an ObjC block. The backing string is freed before the async block executes, leaving a dangling pointer.

### Fix

In `patches/react-native+0.81.5.patch` (`RCTTurboModule.mm`):
```objc
// Before (dangerous):
const char *methodName = ...;
dispatch_async(queue, ^{
  // methodName is dangling here
});

// After (iOS26_UAF_FIX):
NSString *safeMethodName = @(methodName);  // copy before block
dispatch_async(queue, ^{
  // safeMethodName is retained by block
});
```

---

## 4. react-native-screens Black Screen

**Builds**: 59–65
**Symptoms**: App launches to a completely black screen; navigation stack renders nothing.
**Root cause**: `enableScreens(false)` alone is insufficient — `@react-navigation/stack`'s `CardStack.js` destructures `detachInactiveScreens` with a default of `Platform.OS === 'ios'` (true). This passes `enabled: true` to `MaybeScreen`/`MaybeScreenContainer`, which renders native `ScreenNativeComponent`/`ScreenContainerNativeComponent` that crash on iOS 26 with the Fabric false-positive.

### Fix

- `enableScreens(false)` in app entry
- `detachInactiveScreens={false}` on every `Stack.Navigator`
- **`scripts/patch-fabric-compat.js`** (postinstall): Force-patches `CardStack.js` to set `detachInactiveScreens = false`

---

## 5. RCTThirdPartyComponentsProvider nil Dictionary

**Root cause**: The auto-generated `RCTThirdPartyComponentsProvider` returns nil from its dictionary method, causing a crash when Fabric tries to look up third-party component classes.

### Fix

**`plugins/withThirdPartyComponentsFix.js`** — Expo config plugin that patches the generated provider to return an empty dictionary instead of nil.

---

## 6. SafeAreaProvider Dark Screen

**Builds**: 69–72
**Symptoms**: App renders but children of `SafeAreaProvider` never appear (dark/empty screen).
**Root cause**: `react-native-safe-area-context`'s `SafeAreaProvider` detects Fabric (because `nativeFabricUIManager` is present) and waits for the Fabric `onInsetsChange` event. Since the app is actually running Paper, the event never fires and children never render.

### Fix

Pass `initialMetrics` to `<SafeAreaProvider>` in `App.tsx`:
```jsx
import { initialWindowMetrics } from 'react-native-safe-area-context';
<SafeAreaProvider initialMetrics={initialWindowMetrics}>
```

---

## 7. Fabric False-Positive & Null Descriptor Crashes

**Builds**: 93–97
**Signals**: SIGSEGV (`strlen(NULL)`), SIGKILL (CODESIGNING — null function pointer execution)
**Root cause**: iOS 26's bridgeless mode installs `global.nativeFabricUIManager` as a JSI HostObject even when `newArchEnabled: false`. This causes ReactFabric to be the active renderer (not Paper). Third-party libraries detect Fabric and call into Fabric code paths.

When Fabric tries to register component views, classes that don't override `componentDescriptorProvider` (the default in `UIView+ComponentViewProtocol.mm`) return a zero-initialized struct — all fields are NULL. This leads to:
- `strlen(NULL)` in `_registrationStatusMap.insert({provider.name, true})` → SIGSEGV
- Calling a NULL `constructor` function pointer → SIGKILL (code signing violation)

### Fix

**Native patches** (in `patches/react-native+0.81.5.patch`):

| File | Guard |
|------|-------|
| `RCTComponentViewFactory.mm` | `registerComponentViewClass`: skip if `provider.constructor` or `provider.name` is null. Use `safeStdString()` helper for all `provider.name` → `std::string` conversions |
| `RCTComponentViewFactory.mm` | `_registerComponentIfPossible` fallback paths: guard null constructor/name before creating `ComponentDescriptorProvider` |
| `ComponentDescriptorRegistry.cpp` | `add()`: null check on constructor/name, try-catch around constructor call, null check on return value |
| `ComponentDescriptorProviderRegistry.cpp` | `add()`: reject providers with null constructor or name |

**JS-level patches**:

| File | Purpose |
|------|---------|
| `scripts/patch-fabric-compat.js` | Force `isFabric()` → `false` in gesture-handler and screens |
| `fixFabricCompat.js` | Stub `global.RNScreensTurboModule` at runtime |

### Key lesson

In bridgeless mode, ReactFabric is ALWAYS the renderer. You cannot switch to Paper by deleting `nativeFabricUIManager` (build 95 proved this causes `ReferenceError`). The only viable approach is guarding native code against null descriptors AND forcing JS libraries to use Paper code paths.

---

## 8. Fabric Mounting Crash for Interop Components

**Build**: 98
**Signal**: SIGSEGV at address `0x18` (null + 24 byte offset)
**Root cause**: Components with zero-init providers (SVG, etc.) get descriptors created via the `useFabricInterop` fallback in `ComponentDescriptorRegistry::at()`. This registers them in the C++ registries (`_registryByName` / `_registryByHandle`) but NOT in the ObjC `_componentViewClasses` map.

When Fabric mounts these components, `createComponentViewWithComponentHandle` looks them up in `_componentViewClasses`, gets `end()` iterator, and dereferences it → SIGSEGV.

### Fix

In `RCTComponentViewFactory.mm`, added a fallback in `createComponentViewWithComponentHandle`:
```objc
if (iterator == _componentViewClasses.end()) {
    return RCTComponentViewDescriptor{
        .view = [RCTTouchTransparentView new],
        // ... flags set to false/non-recycled
    };
}
```

Where `RCTTouchTransparentView` is a `UIView` subclass that returns `nil` from `hitTest:withEvent:` — see next section.

---

## 9. Touch Blocking from Fallback Views

**Builds**: 99–101
**Symptoms**: App no longer crashes, but buttons in the room screen (mute, deafen, launch apps) don't respond to taps. Pre-room navigation works fine. UI still updates (voice highlighting active).
**Root cause**: The fallback views created for unregistered Fabric components (SVG icons like `RNSVGPath`, `RNSVGGroup`, `RNSVGSvgView`) were intercepting touch events, blocking the actual interactive views beneath them.

### Fix progression

| Build | Fallback View | Result |
|-------|--------------|--------|
| 99 | `RCTLegacyViewManagerInteropComponentView` | Touches blocked |
| 100 | `RCTViewComponentView` | Touches blocked |
| 101 | `RCTTouchTransparentView` (custom) | Pending verification |

The final fix uses a minimal UIView subclass:
```objc
@interface RCTTouchTransparentView : UIView
@end
@implementation RCTTouchTransparentView
- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event {
    return nil;  // completely transparent to touches
}
@end
```

**Trade-off**: SVG icons won't render visually (they appear as empty space), but all interactive elements beneath them work correctly. A proper fix would require full SVG Fabric component support.

---

## 10. fmt C++17 Build Failure

**Root cause**: Apple Clang 17+ (Xcode 26) rejects fmt library's use of C++20 `consteval` when building in C++17 mode.

### Fix

**`plugins/withFmtFix.js`** — Expo config plugin that adds the necessary preprocessor definition to downgrade fmt's consteval usage.

---

## 11. File Inventory

### Patch files (`patches/`)

| File | Purpose |
|------|---------|
| `react-native+0.81.5.patch` | JSC engine support, Fabric null guards, TurboModule UAF fix, MessageQueue fix, diagnostic logging |
| `@react-native-community+javascriptcore+0.2.0.patch` | Compatibility patch for third-party JSC |
| `expo-modules-core+3.0.29.patch` | Guard Hermes imports, add JSC fallback |

### Postinstall scripts (`scripts/`)

| File | Purpose |
|------|---------|
| `patch-messagequeue.js` | Patch MessageQueue.js + ReactInstance.cpp for early event fire |
| `patch-fabric-compat.js` | Force isFabric()→false, patch Card.js animations, patch CardStack.js detach |

### Runtime JS fixes (project root, imported in App.tsx)

| File | Purpose |
|------|---------|
| `fixRCTEventEmitter.js` | Pre-register stub RCTEventEmitter module |
| `fixFabricCompat.js` | Stub global.RNScreensTurboModule |

### Expo config plugins (`plugins/`)

| File | Purpose |
|------|---------|
| `withFmtFix.js` | fmt C++17 build fix |
| `withThirdPartyComponentsFix.js` | RCTThirdPartyComponentsProvider nil crash fix |
| `withDuetAudio.js` | Audio background mode config |
| `withAndroidQueries.js` | Android intent queries |
| `withForceJSC.js` | Forces JSC in Podfile.properties.json |
| `withMessageQueueFix.js` | MessageQueue.js patch (backup approach) |

### Build configuration

| File | Relevant settings |
|------|------------------|
| `eas.json` | `USE_THIRD_PARTY_JSC=1`, `USE_HERMES=0`, `image: macos-sequoia-15.6-xcode-26.0` |
| `app.config.js` | `jsEngine: "jsc"`, `newArchEnabled: false`, build plugins list |
| `package.json` | `postinstall: "patch-package && node scripts/patch-messagequeue.js && node scripts/patch-fabric-compat.js"` |

---

## Build Timeline

| Build | Issue | Outcome |
|-------|-------|---------|
| 59–67 | Black screen debugging | Isolated to react-native-screens |
| 68–71 | Screen detach + SafeArea investigation | Narrowed to SafeAreaProvider |
| 72 | SafeAreaProvider `initialMetrics` fix | Screen renders, but SIGKILL on launch |
| 73–78 | Hermes PAC crash + TurboModule UAF + EventEmitter early-fire | Multiple overlapping crashes |
| 79–81 | JSC engine forced, but still loading Hermes | Hermes confirmed in crash reports |
| 82–91 | Multi-part JSC enforcement | Build 91: nullptr JSCRuntimeFactory crash |
| 92 | JSCRuntimeFactory implemented | App launches on JSC |
| 93 | Fabric null constructor → SIGKILL | CODESIGNING namespace |
| 94 | Fabric null name → SIGSEGV | `strlen(NULL)` |
| 95 | Attempted delete nativeFabricUIManager | ReferenceError — Fabric is mandatory |
| 96 | Guards in wrong location | Still crashing |
| 97 | Guards in RCTComponentViewFactory.mm | Registration crashes fixed |
| 98 | Fabric mounting crash (missing view class) | SIGSEGV at 0x18 |
| 99 | Fallback with RCTLegacyViewManagerInteropComponentView | No crash, but touches blocked |
| 100 | Fallback with RCTViewComponentView | Touches still blocked |
| 101 | Fallback with RCTTouchTransparentView | Submitted to TestFlight |
