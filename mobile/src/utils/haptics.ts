import ReactNativeHapticFeedback, {
  HapticFeedbackTypes,
} from 'react-native-haptic-feedback';

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

function fire(type: HapticFeedbackTypes) {
  try {
    ReactNativeHapticFeedback.trigger(type, options);
  } catch {
    // Haptics are a nicety; never let them break the app.
  }
}

export const haptic = {
  tap: () => fire(HapticFeedbackTypes.impactLight),
  select: () => fire(HapticFeedbackTypes.selection),
  success: () => fire(HapticFeedbackTypes.notificationSuccess),
};
