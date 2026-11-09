import { NativeModules, Platform } from 'react-native';

export type Effect = 'pop';

type NativeSound = { play(name: Effect): void };

function native(): NativeSound | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  return (NativeModules.ReclaimSound as NativeSound | undefined) ?? null;
}

/** Thin, safe wrapper: a missing native side means silence, never an error. */
export const sound = {
  play(name: Effect) {
    try {
      native()?.play(name);
    } catch {
      // ignore
    }
  },
};
