import { NativeModules, Platform } from 'react-native';

export type GoogleSignInResult = { idToken: string; email: string };
export type GoogleSignInErrorCode =
  | 'cancelled'
  | 'no_account'
  | 'unavailable'
  | 'failed';

type Native = {
  signIn(webClientId: string): Promise<GoogleSignInResult>;
  signOut(): Promise<void>;
};

function native(): Native | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  return (NativeModules.ReclaimGoogleSignIn as Native | undefined) ?? null;
}

export class GoogleSignInError extends Error {
  constructor(readonly code: GoogleSignInErrorCode, message: string) {
    super(message);
  }
}

export const googleSignIn = {
  available: () => native() !== null,

  /** Shows Google's account sheet. Resolves with an ID token for our server to verify. */
  async signIn(webClientId: string): Promise<GoogleSignInResult> {
    const n = native();
    if (!n) {
      throw new GoogleSignInError(
        'unavailable',
        'Google sign-in is not available here.',
      );
    }
    try {
      return await n.signIn(webClientId);
    } catch (e) {
      const code = (e as { code?: string }).code;
      const known: GoogleSignInErrorCode =
        code === 'cancelled' || code === 'no_account' ? code : 'failed';
      throw new GoogleSignInError(
        known,
        (e as Error).message ?? 'Google sign-in failed.',
      );
    }
  },

  async signOut(): Promise<void> {
    try {
      await native()?.signOut();
    } catch {
      // Forgetting the chosen account is best effort.
    }
  },
};
