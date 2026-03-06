// Mock @react-native-firebase/auth
// The mockAuthState object is shared so tests can mutate currentUser before calling code under test.
const mockAuthState = { currentUser: null };

jest.mock('@react-native-firebase/auth', () => {
  const mockAuth = jest.fn(() => ({
    get currentUser() {
      return mockAuthState.currentUser;
    },
    onAuthStateChanged: jest.fn((callback) => {
      callback(mockAuthState.currentUser);
      return jest.fn(); // unsubscribe
    }),
    signInAnonymously: jest.fn(),
    signOut: jest.fn(),
  }));
  mockAuth.default = mockAuth;
  return mockAuth;
});

// Export for use in tests
global.__mockAuthState = mockAuthState;

// Mock @react-native-firebase/database
jest.mock('@react-native-firebase/database', () => {
  const snapshotMock = {
    val: jest.fn(() => null),
    exists: jest.fn(() => false),
  };

  const refMock = {
    set: jest.fn(() => Promise.resolve()),
    once: jest.fn(() => Promise.resolve(snapshotMock)),
    on: jest.fn(),
    off: jest.fn(),
    push: jest.fn(() => Promise.resolve()),
    remove: jest.fn(() => Promise.resolve()),
    child: jest.fn(() => refMock),
    onDisconnect: jest.fn(() => ({
      remove: jest.fn(() => Promise.resolve()),
      cancel: jest.fn(() => Promise.resolve()),
    })),
  };

  const mockDatabase = () => ({
    ref: jest.fn(() => refMock),
    goOffline: jest.fn(),
    goOnline: jest.fn(),
  });

  mockDatabase.ServerValue = {
    TIMESTAMP: 'mock-timestamp',
  };

  mockDatabase.default = mockDatabase;
  return mockDatabase;
});

// Mock @react-native-firebase/analytics
jest.mock('@react-native-firebase/analytics', () => {
  const mockAnalytics = () => ({
    logEvent: jest.fn(() => Promise.resolve()),
    logScreenView: jest.fn(() => Promise.resolve()),
    setUserId: jest.fn(() => Promise.resolve()),
  });
  mockAnalytics.default = mockAnalytics;
  return mockAnalytics;
});

// Mock react-native-webrtc
jest.mock('react-native-webrtc', () => ({
  RTCPeerConnection: jest.fn().mockImplementation(() => ({
    createOffer: jest.fn(),
    createAnswer: jest.fn(),
    setLocalDescription: jest.fn(),
    setRemoteDescription: jest.fn(),
    addIceCandidate: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })),
  RTCSessionDescription: jest.fn().mockImplementation((desc) => desc),
  RTCIceCandidate: jest.fn().mockImplementation((candidate) => candidate),
  mediaDevices: {
    getUserMedia: jest.fn(),
  },
}));

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
