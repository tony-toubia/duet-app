// Disable native modules on iOS whose precompiled Google SDK binaries crash
// on iOS 26 during dispatch_once initialization (nil NSDictionary insertion).
// These crashes are inside the vendor binaries and cannot be patched.
// See: https://github.com/google/GoogleSignIn-iOS/issues
module.exports = {
  dependencies: {
    '@react-native-google-signin/google-signin': {
      platforms: {
        ios: null,
      },
    },
    'react-native-google-mobile-ads': {
      platforms: {
        ios: null,
      },
    },
  },
};
