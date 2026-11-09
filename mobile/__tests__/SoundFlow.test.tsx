import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import App from '../App';
import { loadSettings, SETTINGS_KEY } from '../src/services/settingsStorage';
import { DEFAULT_SETTINGS } from '../src/state/settings';
import { sound } from '../src/native/sound';
import { FOCUS_KEY } from '../src/features/focus/FocusContext';

jest.mock('../src/native/sound', () => ({ sound: { play: jest.fn() } }));
const snd = sound as jest.Mocked<typeof sound>;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.removeItem(FOCUS_KEY);
  await AsyncStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      ...DEFAULT_SETTINGS,
      onboarding: { completed: true, step: 'ready', protect: 'later' },
    }),
  );
});

describe("Pip's sound", () => {
  it('pops when Pip is tapped, and stays quiet once switched off in Profile', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Pip. Tap to say hello'));
    expect(snd.play).toHaveBeenCalledWith('pop');

    await fireEvent.press(await screen.findByLabelText('Profile tab'));
    await fireEvent.press(screen.getByLabelText('Pip sounds'));
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY))!).sound.effects).toBe(false),
    );
    snd.play.mockClear();
    await fireEvent.press(await screen.findByLabelText('Home tab'));
    await fireEvent.press(await screen.findByLabelText('Pip. Tap to say hello'));
    expect(snd.play).not.toHaveBeenCalled();
  });

  it('loads old or tampered saved data safely', async () => {
    const old: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    delete old.sound;
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(old));
    expect((await loadSettings()).sound).toEqual({ effects: true });
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, sound: { effects: 'loud', focus: 'rain' } }),
    );
    expect((await loadSettings()).sound).toEqual({ effects: true });
  });
});
