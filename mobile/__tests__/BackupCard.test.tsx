import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { BackupCard } from '../src/features/profile/BackupCard';
import { SettingsProvider, useSettings } from '../src/state/SettingsContext';
import { CONSENT_PURPOSE_BACKUP } from '../src/state/settings';

const mockVault = new Map<string, string>();
jest.mock('../src/native/secureStore', () => ({
  secureStore: {
    get: async (k: string) => mockVault.get(k) ?? null,
    set: async (k: string, v: string) => {
      mockVault.set(k, v);
    },
    remove: async (k: string) => {
      mockVault.delete(k);
    },
  },
}));
jest.mock('../src/native/googleSignIn', () => ({
  ...jest.requireActual('../src/native/googleSignIn'),
  googleSignIn: {
    signIn: async () => ({ idToken: 'google-token', email: 'me@example.com' }),
    signOut: async () => {},
  },
}));

const reply = (status: number, body?: unknown) =>
  ({ status, ok: status < 300, json: async () => body } as unknown as Response);

let consents: { purpose: string; granted: boolean }[] = [];
function Spy() {
  consents = useSettings().settings.consents;
  return null;
}

it('signs in with Google from Profile, records the choice, and signs out', async () => {
  globalThis.fetch = jest.fn(async (url: string) =>
    String(url).endsWith('/auth/google')
      ? reply(200, {
          accessToken: 'a',
          refreshToken: 'r',
          expiresIn: 3600,
          userId: 'u',
          created: true,
        })
      : reply(204),
  ) as unknown as typeof fetch;

  await render(
    <SettingsProvider>
      <BackupCard />
      <Spy />
    </SettingsProvider>,
  );
  expect(await screen.findByText(/never leave this phone/)).toBeTruthy();

  await fireEvent.press(screen.getByText('Sign in with Google'));
  expect(
    await screen.findByText('☁️ Signed in as me@example.com'),
  ).toBeTruthy();
  expect(
    consents
      .filter(c => c.purpose === CONSENT_PURPOSE_BACKUP)
      .map(c => c.granted),
  ).toEqual([true]);
  expect(mockVault.size).toBe(1);

  await fireEvent.press(screen.getByText('Sign out'));
  expect(await screen.findByText('Sign in with Google')).toBeTruthy();
  expect(
    consents
      .filter(c => c.purpose === CONSENT_PURPOSE_BACKUP)
      .map(c => c.granted),
  ).toEqual([true, false]);
  expect(mockVault.size).toBe(0);
});
