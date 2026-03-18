// Disable google-signin and google-mobile-ads on iOS due to crashes on iOS 26.
// Both GoogleSignIn SDK and Google Mobile Ads SDK have internal dispatch_once
// NSDictionary initialization that inserts nil values on iOS 26 "Liquid Glass".
// Apple Sign-In is used as the iOS auth method instead.
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
