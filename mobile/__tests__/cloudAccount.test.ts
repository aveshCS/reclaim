import { createCloudAccount } from '../src/cloud/account';
import { GoogleSignInError } from '../src/native/googleSignIn';

type Call = { url: string; method: string; auth?: string; body?: any };

function json(status: number, body?: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as Response;
}

/** A pretend server that behaves like the real one for the routes the app uses. */
function setup(
  opts: { google?: () => Promise<{ idToken: string; email: string }> } = {},
) {
  const calls: Call[] = [];
  const stored = new Map<string, string>();
  let now = 1_000_000;
  let n = 0;
  let validRefresh = new Set<string>();
  let validAccess = new Set<string>();
  const issue = () => {
    n++;
    const pair = {
      accessToken: `a${n}`,
      refreshToken: `r${n}`,
      expiresIn: 3600,
    };
    validAccess.add(pair.accessToken);
    validRefresh.add(pair.refreshToken);
    return pair;
  };
  const server = jest.fn(async (url: string, init: RequestInit) => {
    const path = url.replace('http://api.test/v1', '');
    const headers = (init.headers ?? {}) as Record<string, string>;
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({
      url: path,
      method: init.method ?? 'GET',
      auth: headers.Authorization,
      body,
    });
    if (path === '/auth/google') {
      return json(200, { ...issue(), userId: 'u1', created: true });
    }
    if (path === '/auth/refresh') {
      if (!validRefresh.delete(body.refreshToken)) {
        return json(401, { error: { code: 'unauthorized', message: 'no' } });
      }
      return json(200, issue());
    }
    if (path === '/auth/logout') {
      validRefresh.delete(body.refreshToken);
      return json(204);
    }
    const token = headers.Authorization?.replace('Bearer ', '');
    if (!token || !validAccess.has(token)) {
      return json(401, {
        error: { code: 'unauthorized', message: 'Sign in first.' },
      });
    }
    if (path === '/me' && init.method === 'DELETE') {
      validRefresh = new Set();
      validAccess = new Set();
      return json(204);
    }
    if (path === '/me') {
      return json(200, { id: 'u1' });
    }
    return json(404, { error: { code: 'not_found', message: 'nope' } });
  });
  const google = {
    signIn: jest.fn(
      opts.google ??
        (async () => ({ idToken: 'google-id-token', email: 'me@example.com' })),
    ),
    signOut: jest.fn(async () => {}),
  };
  const store = {
    get: async (k: string) => stored.get(k) ?? null,
    set: async (k: string, v: string) => {
      stored.set(k, v);
    },
    remove: async (k: string) => {
      stored.delete(k);
    },
  };
  const make = () =>
    createCloudAccount({
      baseUrl: 'http://api.test/v1',
      webClientId: 'web-client',
      fetch: server as unknown as typeof fetch,
      store,
      google,
      now: () => now,
    });
  return {
    make,
    calls,
    stored,
    google,
    expireAccess: () => (validAccess = new Set()),
    advance: (ms: number) => (now += ms),
  };
}

it('is unavailable when the build has no server', async () => {
  const a = createCloudAccount({
    baseUrl: null,
    webClientId: 'x',
    fetch: jest.fn(),
    store: { get: jest.fn(), set: jest.fn(), remove: jest.fn() },
    google: { signIn: jest.fn(), signOut: jest.fn() },
    now: () => 0,
  });
  expect(a.getState().status).toBe('unavailable');
  expect(await a.signIn()).toBe(false);
});

it('signs in with Google, keeps the session encrypted-stored, and restores it on the next launch', async () => {
  const t = setup();
  const a = t.make();
  await a.load();
  expect(a.getState()).toEqual({ status: 'signedOut' });

  expect(await a.signIn()).toBe(true);
  expect(t.google.signIn).toHaveBeenCalledWith('web-client');
  expect(t.calls[0]).toMatchObject({
    url: '/auth/google',
    body: { idToken: 'google-id-token' },
  });
  expect(a.getState()).toEqual({ status: 'signedIn', email: 'me@example.com' });
  expect(JSON.parse(t.stored.get('cloud_session_v1')!)).toMatchObject({
    userId: 'u1',
    refreshToken: 'r1',
  });
  expect(t.stored.get('cloud_session_v1')).not.toContain('a1'); // access token never stored

  const next = t.make();
  await next.load();
  expect(next.getState()).toEqual({
    status: 'signedIn',
    email: 'me@example.com',
  });
  await expect(next.request('/me')).resolves.toEqual({ id: 'u1' }); // refreshes first
  expect(t.calls.map(c => c.url)).toEqual([
    '/auth/google',
    '/auth/refresh',
    '/me',
  ]);
});

it('renews an expired access token once, and never runs two refreshes at the same time', async () => {
  const t = setup();
  const a = t.make();
  await a.load();
  await a.signIn();
  t.expireAccess();
  await Promise.all([a.request('/me'), a.request('/me'), a.request('/me')]);
  expect(t.calls.filter(c => c.url === '/auth/refresh')).toHaveLength(1);
  expect(a.getState().status).toBe('signedIn');

  // After the hour is up the app renews before asking.
  t.advance(3600 * 1000);
  await a.request('/me');
  expect(t.calls.filter(c => c.url === '/auth/refresh')).toHaveLength(2);
});

it('a refused refresh signs out on this phone with a gentle note', async () => {
  const t = setup();
  const a = t.make();
  await a.load();
  await a.signIn();
  const saved = t.stored.get('cloud_session_v1')!;
  await a.signOut(); // the server no longer accepts r1
  t.stored.set('cloud_session_v1', saved); // ...but this phone still has it
  const b = t.make();
  await b.load();
  await expect(b.request('/me')).rejects.toMatchObject({ status: 401 });
  expect(b.getState()).toMatchObject({
    status: 'signedOut',
    error: expect.stringContaining('signed out'),
  });
  expect(t.stored.has('cloud_session_v1')).toBe(false);
});

it('sign out revokes the token and forgets the account choice', async () => {
  const t = setup();
  const a = t.make();
  await a.load();
  await a.signIn();
  await a.signOut();
  expect(t.calls.at(-1)).toMatchObject({
    url: '/auth/logout',
    body: { refreshToken: 'r1' },
  });
  expect(t.google.signOut).toHaveBeenCalled();
  expect(t.stored.size).toBe(0);
  expect(a.getState()).toEqual({ status: 'signedOut' });
});

it('delete removes the backup and signs out', async () => {
  const t = setup();
  const a = t.make();
  await a.load();
  await a.signIn();
  expect(await a.deleteCloudData()).toBe(true);
  expect(t.calls.at(-1)).toMatchObject({
    url: '/me',
    method: 'DELETE',
    auth: 'Bearer a1',
  });
  expect(a.getState()).toEqual({ status: 'signedOut' });
  expect(t.stored.size).toBe(0);
});

it('explains failures in plain words; cancelling says nothing', async () => {
  const cancelled = setup({
    google: async () => Promise.reject(new GoogleSignInError('cancelled', 'x')),
  });
  const a = cancelled.make();
  await a.load();
  expect(await a.signIn()).toBe(false);
  expect(a.getState()).toEqual({ status: 'signedOut', error: '' });

  const noAccount = setup({
    google: async () =>
      Promise.reject(new GoogleSignInError('no_account', 'x')),
  });
  const b = noAccount.make();
  await b.load();
  await b.signIn();
  expect(b.getState()).toMatchObject({
    error: expect.stringContaining('Add a Google account'),
  });

  const offline = createCloudAccount({
    baseUrl: 'http://api.test/v1',
    webClientId: 'x',
    fetch: jest.fn(async () =>
      Promise.reject(new TypeError('Network request failed')),
    ),
    store: {
      get: async () => null,
      set: async () => {},
      remove: async () => {},
    },
    google: {
      signIn: async () => ({ idToken: 't', email: 'e' }),
      signOut: async () => {},
    },
    now: () => 0,
  });
  await offline.load();
  await offline.signIn();
  expect(offline.getState()).toMatchObject({
    status: 'signedOut',
    error: expect.stringContaining('Could not reach'),
  });
});
