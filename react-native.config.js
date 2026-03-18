// Disable modules on iOS that crash on iOS 26 due to nil NSDictionary constants.
// GoogleSignIn SDK, Google Mobile Ads SDK, and potentially others have internal
// dispatch_once initialization that inserts nil values on iOS 26 "Liquid Glass".
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
    '@notifee/react-native': {
      platforms: {
        ios: null,
      },
    },
    'react-native-svg': {
      platforms: {
        ios: null,
      },
    },
  },
};
