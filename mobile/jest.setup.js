/* eslint-env jest */
jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest').default,
);
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native-haptic-feedback', () => ({
  __esModule: true,
  default: { trigger: jest.fn() },
  HapticFeedbackTypes: {
    impactLight: 'impactLight',
    selection: 'selection',
    notificationSuccess: 'notificationSuccess',
  },
}));

// Looping ambient animations never finish, so switch them off under test.
require('./src/utils/motion').motionConfig.ambient = false;
