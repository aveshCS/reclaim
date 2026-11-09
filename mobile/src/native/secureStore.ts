import { NativeModules, Platform } from 'react-native';

type Native = {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
};

function native(): Native | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  return (NativeModules.ReclaimSecureStore as Native | undefined) ?? null;
}

/**
 * Encrypted storage (Android Keystore, AES-GCM) for sign-in tokens. Without the native
 * side nothing is stored, so the user is simply signed out next launch.
 */
export const secureStore = {
  async get(key: string): Promise<string | null> {
    try {
      return (await native()?.getItem(key)) ?? null;
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    await native()?.setItem(key, value);
  },
  async remove(key: string): Promise<void> {
    try {
      await native()?.removeItem(key);
    } catch {
      // ignore
    }
  },
};
