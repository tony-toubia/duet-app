# iOS 26 Crash Investigation & Resolution

## Summary

The Duet app crashes immediately on launch on **iOS 26 devices** (iPad and iPhone). The crash does **not** occur on the iOS 26 Simulator or on devices running iOS 18.x or earlier.

**Root cause**: The `GoogleSignIn` iOS SDK (CocoaPod) contains a `dispatch_once` block that creates an `NSDictionary` with a value that resolves to `nil` on iOS 26 devices. This causes an immediate `NSInvalidArgumentException` crash before the app can even render.

**Resolution**: Patched the `ExpoAdapterGoogleSignIn` podspec to remove the `GoogleSignIn` pod dependency on iOS, and disabled the Google Sign-In config plugin. Google Sign-In remains fully functional on Android. iOS users can authenticate via Apple Sign-In or email link.

---

## Timeline

- **2026-03-16**: First crash reports from iPad running iOS 26.3 (23D127)
- **2026-03-16 to 2026-03-18**: Binary search to isolate the crashing module
- **2026-03-18**: Confirmed `@react-native-google-signin/google-signin` as a crash source
- **2026-03-19 to 2026-03-22**: Discovered crash persists even after disabling autolinking, traced to `ExpoAdapterGoogleSignIn` pod still pulling in GoogleSignIn SDK
- **2026-03-22**: Found that crash occurs on device but NOT in iOS 26 Simulator
- **2026-03-22**: Patched `ExpoAdapterGoogleSignIn.podspec` to remove GoogleSignIn pod dependency

---

## Crash Signature

```
Exception Type: EXC_CRASH (SIGABRT)
Exception Reason: *** -[__NSPlaceholderDictionary initWithObjects:forKeys:count:]:
  attempt to insert nil object from objects[0]
```

- Occurs inside a `dispatch_once` block during native module initialization
- Faulting thread: `com.facebook.react.runtime.JavaScript`
- The nil value is inside the **precompiled GoogleSignIn framework binary** — not in any React Native wrapper code we control

---

## What We Tried (and Why It Didn't Work)

### 1. Patching `constantsToExport` with NSMutableDictionary
The crash is inside the GoogleSignIn framework's own precompiled binary, not in the RN wrapper's `constantsToExport`. Our patches to `RNGoogleSignin.mm` had no effect.

### 2. `@try/@catch` around dictionary literals
The crash happens at the C level in a dictionary literal (`@{...}`), which crashes before ObjC exception handling can intercept it.

### 3. Patching `RCT_ENUM_CONVERTER` macro
The crash is not in React Native's enum converters — those use integer values that can't be nil.

### 4. Upgrading GoogleSignIn SDK (v7 to v9)
Upgraded `@react-native-google-signin/google-signin` from v13 (GoogleSignIn SDK 7.1) to v16 (GoogleSignIn SDK 9.0). Both versions crash identically on iOS 26 devices.

### 5. Disabling autolinking via `react-native.config.js`
Set `ios: null` for `@react-native-google-signin/google-signin` in `react-native.config.js`. This prevents React Native's autolinking but does **NOT** prevent the Expo module system from installing `ExpoAdapterGoogleSignIn`, which has its own podspec that pulls in the GoogleSignIn pod.

### 6. Disabling the Expo config plugin
Commented out `@react-native-google-signin/google-signin` from the `plugins` array in `app.config.js`. This prevents the plugin from running during prebuild but the Expo adapter pod is still installed by the Expo autolinking system.

---

## Root Cause: ExpoAdapterGoogleSignIn

The `@react-native-google-signin/google-signin` package includes an Expo adapter at:
```
expo/ios/ExpoAdapterGoogleSignIn.podspec
```

This podspec declares:
```ruby
s.dependency "GoogleSignIn", package["GoogleSignInPodVersion"]
```

The Expo module autolinking system discovers this podspec independently of React Native's autolinking (`react-native.config.js`). Even when RN autolinking is disabled, Expo still installs this pod, which brings in the `GoogleSignIn` CocoaPod.

The GoogleSignIn pod's precompiled binary contains device-specific code paths that crash on iOS 26 but work fine in the iOS 26 Simulator (different binary slices for simulator vs device).

---

## The Fix

### Patch: `@react-native-google-signin+google-signin+13.3.1.patch`

1. **Removes `GoogleSignIn` pod dependency** from `ExpoAdapterGoogleSignIn.podspec`
2. **Stubs out the Swift delegate** in `GoogleSignInAppDelegate.swift` to remove the `import GoogleSignIn` and `GIDSignIn.sharedInstance.handle(url)` call

### Other patches applied for iOS 26 compatibility:

| Patch | Purpose |
|-------|---------|
| `@react-native-firebase+app+23.8.6.patch` | Fix nil directory paths in Firebase app initialization |
| `@react-native-firebase+auth+23.8.6.patch` | Fix Firebase auth compatibility |
| `@notifee+react-native+9.1.8.patch` | Fix Notifee initialization on iOS 26 |
| `expo-modules-core+3.0.29.patch` | Fix Expo modules core compatibility |
| `react-native-google-mobile-ads+15.8.3.patch` | Fix Google Mobile Ads nil constants |

### Configuration changes:

- `react-native.config.js`: Disables iOS autolinking for `@react-native-google-signin/google-signin` and `react-native-google-mobile-ads`
- `app.config.js`: `@react-native-google-signin/google-signin` plugin commented out

---

## Impact

| Feature | iOS | Android |
|---------|-----|---------|
| Google Sign-In | Disabled (patch removes SDK) | Works normally |
| Apple Sign-In | Works | N/A |
| Email Link Sign-In | Works | Works |
| Google Mobile Ads | Disabled (autolinking excluded) | Works normally |
| All other features | Work normally | Work normally |

---

## Device vs Simulator Behavior

| Environment | iOS 26.3 | iOS 18.x |
|-------------|----------|----------|
| Physical device | CRASHES | Works |
| Simulator | Works | Works |

This discrepancy is because the GoogleSignIn CocoaPod ships different binary slices for simulator (x86_64/arm64-simulator) and device (arm64). The device slice contains code paths that produce nil values on iOS 26, while the simulator slice does not.

---

## How to Restore Google Sign-In on iOS

Once Google releases an iOS 26-compatible version of the GoogleSignIn SDK:

1. Check https://github.com/google/GoogleSignIn-iOS/releases for updates
2. Update `@react-native-google-signin/google-signin` to the version that includes the fix
3. Remove `patches/@react-native-google-signin+google-signin+13.3.1.patch`
4. Remove the `react-native.config.js` entry for google-signin
5. Uncomment the plugin in `app.config.js`
6. Test on an iOS 26 device before releasing

---

## Key Files

- `patches/@react-native-google-signin+google-signin+13.3.1.patch` — The main fix
- `react-native.config.js` — Autolinking exclusions
- `app.config.js` — Plugin configuration (google-signin plugin disabled)
- `src/services/AuthService.ts` — Conditional Google Sign-In import (Android only)
- `src/screens/AuthScreen.tsx` — Google Sign-In button hidden on iOS

---

## Test Device

- iPad 10th generation (iPad13,18)
- iPadOS 26.3 (build 23D127)
- Developer mode enabled

---

## Build Configuration

- Expo SDK 54 / React Native 0.81.5 / Hermes
- EAS Build image: `macos-sequoia-15.5-xcode-16.4`
- Old Architecture (`newArchEnabled: false`)
