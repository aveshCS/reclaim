module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Many tests render the whole app; under a full parallel run they can pass Jest's 5 s default.
  testTimeout: 30000,
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-async-storage|react-native-svg|react-native-linear-gradient|react-native-haptic-feedback|@react-navigation)/)',
  ],
};
