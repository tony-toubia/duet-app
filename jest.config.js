module.exports = {
  preset: 'jest-expo',
  // Playwright specs in e2e/ run via `npx playwright test`, and the cloud
  // functions tests run via vitest inside firebase/functions — without these
  // ignores, jest tries to load them and fails on their test frameworks.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/e2e/',
    '<rootDir>/website/',
    '<rootDir>/firebase/functions/',
    // Shared fixtures living under __tests__ are not suites themselves
    '<rootDir>/src/services/__tests__/helpers/',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native(-community)?/|expo(nent)?|@expo(nent)?/|@expo-google-fonts/|react-navigation|@react-navigation/|@unimodules/|unimodules|sentry-expo|native-base|react-native-svg|react-native-webrtc|@react-native-firebase/|@react-native-async-storage/|zustand)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
