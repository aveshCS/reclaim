import { useSyncExternalStore } from 'react';
import { API_BASE_URL, GOOGLE_WEB_CLIENT_ID } from '../config/cloud';
import { googleSignIn, GoogleSignInError } from '../native/googleSignIn';
import { secureStore } from '../native/secureStore';

/** What the app keeps about the signed-in account. The refresh token is the only secret. */
type Session = { userId: string; email: string | null; refreshToken: string };

export type CloudState =
  | { status: 'unavailable' } // no server configured for this build
  | { status: 'loading' }
  | { status: 'signedOut'; error?: string }
  | { status: 'busy'; email: string | null }
  | { status: 'signedIn'; email: string | null; error?: string };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

type Deps = {
  baseUrl: string | null;
  webClientId: string;
  fetch: typeof fetch;
  store: {
    get(k: string): Promise<string | null>;
    set(k: string, v: string): Promise<void>;
    remove(k: string): Promise<void>;
  };
  google: {
    signIn(id: string): Promise<{ idToken: string; email: string }>;
    signOut(): Promise<void>;
  };
  now: () => number;
};

const SESSION_KEY = 'cloud_session_v1';
const OFFLINE =
  'Could not reach the backup server. Check your connection and try again.';

export function createCloudAccount(deps: Deps) {
  let state: CloudState = deps.baseUrl
    ? { status: 'loading' }
    : { status: 'unavailable' };
  let session: Session | null = null;
  let access: { token: string; expiresAt: number } | null = null;
  let refreshing: Promise<string> | null = null;
  const listeners = new Set<() => void>();

  const set = (next: CloudState) => {
    state = next;
    listeners.forEach(l => l());
  };

  async function raw(
    path: string,
    init: RequestInit = {},
    bearer?: string,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (bearer) {
      headers.Authorization = `Bearer ${bearer}`;
    }
    try {
      return await deps.fetch(`${deps.baseUrl}${path}`, { ...init, headers });
    } catch {
      throw new ApiError(0, 'offline', OFFLINE);
    }
  }

  async function body<T>(res: Response): Promise<T> {
    if (res.status === 204) {
      return undefined as T;
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const e = json?.error;
      throw new ApiError(
        res.status,
        e?.code ?? 'error',
        e?.message ?? 'Something went wrong.',
        e?.details,
      );
    }
    return json as T;
  }

  async function saveSession(s: Session | null) {
    session = s;
    if (s) {
      await deps.store.set(SESSION_KEY, JSON.stringify(s));
    } else {
      access = null;
      await deps.store.remove(SESSION_KEY);
    }
  }

  type Pair = { accessToken: string; refreshToken: string; expiresIn: number };
  const keepAccess = (p: Pair) => {
    // Renew a minute early so a request never races the expiry.
    access = {
      token: p.accessToken,
      expiresAt: deps.now() + (p.expiresIn - 60) * 1000,
    };
  };

  /** One refresh at a time: refresh tokens are single-use, a second parallel use would sign out every device. */
  function refresh(): Promise<string> {
    if (!refreshing) {
      refreshing = (async () => {
        const s = session;
        if (!s) {
          throw new ApiError(401, 'unauthorized', 'Signed out.');
        }
        const res = await raw('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: s.refreshToken }),
        });
        if (res.status === 401) {
          await saveSession(null);
          set({
            status: 'signedOut',
            error: 'You were signed out. Sign in again to keep backing up.',
          });
          throw new ApiError(401, 'unauthorized', 'Signed out.');
        }
        const pair = await body<Pair>(res);
        await saveSession({ ...s, refreshToken: pair.refreshToken });
        keepAccess(pair);
        return pair.accessToken;
      })().finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  }

  async function token(): Promise<string> {
    if (access && access.expiresAt > deps.now()) {
      return access.token;
    }
    return refresh();
  }

  /** Authenticated request; renews the access token once if the server says it expired. */
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res = await raw(path, init, await token());
    if (res.status === 401) {
      access = null;
      res = await raw(path, init, await refresh());
    }
    return body<T>(res);
  }

  const account = {
    getState: () => state,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    isSignedIn: () => session !== null,
    request,

    /** Restores a saved sign-in at app start. No network needed. */
    async load() {
      if (!deps.baseUrl) {
        return;
      }
      const saved = await deps.store.get(SESSION_KEY);
      try {
        session = saved ? (JSON.parse(saved) as Session) : null;
      } catch {
        session = null;
      }
      set(
        session
          ? { status: 'signedIn', email: session.email }
          : { status: 'signedOut' },
      );
    },

    async signIn(): Promise<boolean> {
      if (!deps.baseUrl) {
        return false;
      }
      set({ status: 'busy', email: null });
      try {
        const g = await deps.google.signIn(deps.webClientId);
        const res = await raw('/auth/google', {
          method: 'POST',
          body: JSON.stringify({ idToken: g.idToken }),
        });
        const r = await body<Pair & { userId: string }>(res);
        await saveSession({
          userId: r.userId,
          email: g.email,
          refreshToken: r.refreshToken,
        });
        keepAccess(r);
        set({ status: 'signedIn', email: g.email });
        return true;
      } catch (e) {
        set({ status: 'signedOut', error: friendly(e) });
        return false;
      }
    },

    /** Signs out on this phone. The backup stays in the account. */
    async signOut() {
      const s = session;
      set({ status: 'busy', email: s?.email ?? null });
      if (s) {
        // Best effort: revoke on the server so the token can't be used again.
        await raw('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: s.refreshToken }),
        }).catch(() => null);
      }
      await saveSession(null);
      await deps.google.signOut();
      set({ status: 'signedOut' });
    },

    /** Deletes the account and everything backed up. Local data on the phone is untouched. */
    async deleteCloudData(): Promise<boolean> {
      const email = session?.email ?? null;
      set({ status: 'busy', email });
      try {
        await request<void>('/me', { method: 'DELETE' });
        await saveSession(null);
        await deps.google.signOut();
        set({ status: 'signedOut' });
        return true;
      } catch (e) {
        if (!session) {
          return false; // refresh already signed us out and set the message
        }
        set({ status: 'signedIn', email, error: friendly(e) });
        return false;
      }
    },
  };
  return account;
}

function friendly(e: unknown): string {
  if (e instanceof GoogleSignInError) {
    switch (e.code) {
      case 'cancelled':
        return '';
      case 'no_account':
        return 'Add a Google account to this phone first (Settings > Accounts).';
      case 'unavailable':
        return 'Google sign-in is not available on this phone.';
      default:
        return 'Google sign-in did not work. Try again in a moment.';
    }
  }
  if (e instanceof ApiError) {
    if (e.status === 429) {
      return 'Too many tries. Wait a minute and try again.';
    }
    if (e.status === 503) {
      return 'Backup is not available right now. Try again later.';
    }
    return e.status === 0
      ? OFFLINE
      : 'Something went wrong on our side. Try again later.';
  }
  return 'Something went wrong. Try again.';
}

export const cloudAccount = createCloudAccount({
  baseUrl: API_BASE_URL,
  webClientId: GOOGLE_WEB_CLIENT_ID,
  fetch: (...a) => fetch(...a),
  store: secureStore,
  google: googleSignIn,
  now: () => Date.now(),
});

export function useCloudAccount(): CloudState {
  return useSyncExternalStore(cloudAccount.subscribe, cloudAccount.getState);
}
