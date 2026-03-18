// Disable google-signin on iOS due to GoogleSignIn SDK crash on iOS 26.
// The GID* button style/color constants are nil on iOS 26 "Liquid Glass",
// causing NSDictionary nil insertion crash during module initialization.
// Apple Sign-In is used as the iOS auth method instead.
module.exports = {
  dependencies: {
    '@react-native-google-signin/google-signin': {
      platforms: {
        ios: null,
      },
    },
  },
};
