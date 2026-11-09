import { sound } from '../native/sound';

/** Set from settings at start-up and on change (see SoundSync). */
export const sfxConfig = { enabled: true };

/**
 * Pip's sounds. Quiet, and silent when the phone is on silent or vibrate (checked natively)
 * or when the user switched them off in Profile.
 */
export const sfx = {
  pop: () => sfxConfig.enabled && sound.play('pop'),
};
