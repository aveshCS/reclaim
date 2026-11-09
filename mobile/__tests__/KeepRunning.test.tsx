import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../App';
import { SETTINGS_KEY } from '../src/services/settingsStorage';
import { DEFAULT_SETTINGS } from '../src/state/settings';
import { pauseGate } from '../src/native/pauseGate';
import { FOCUS_KEY } from '../src/features/focus/FocusContext';

jest.mock('../src/native/pauseGate', () => {
  const actual = jest.requireActual('../src/native/pauseGate');
  return {
    ...actual,
    pauseGate: {
      isAvailable: jest.fn(() => true),
      isServiceEnabled: jest.fn(async () => true),
      getServiceState: jest.fn(async () => ({
        enabled: true,
        running: false,
        maker: 'xiaomi',
      })),
      openAutostartSettings: jest.fn(async () => {}),
      openAppSettings: jest.fn(async () => {}),
      openSettings: jest.fn(async () => {}),
      configure: jest.fn(async () => {}),
      getStats: jest.fn(async () => []),
      clearStats: jest.fn(async () => {}),
      configureExtras: jest.fn(async () => {}),
      configureIntensity: jest.fn(async () => {}),
      getReelStats: jest.fn(async () => []),
    },
  };
});
const gate = pauseGate as jest.Mocked<typeof pauseGate>;
const press = (l: string | RegExp) => fireEvent.press(screen.getByLabelText(l));

beforeEach(async () => {
  jest.clearAllMocks();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation(() => ({ remove: jest.fn() } as never));
  await AsyncStorage.removeItem(FOCUS_KEY);
  await AsyncStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      ...DEFAULT_SETTINGS,
      onboarding: { completed: true, step: 'ready', protect: 'yes' },
      gate: {
        enabled: true,
        packages: [{ packageName: 'com.google.android.youtube', label: 'YouTube' }],
        allowMinutes: 5,
      },
    }),
  );
});
afterEach(() => jest.restoreAllMocks());

describe('when the phone stops the pause (Xiaomi)', () => {
  it('says so plainly and offers the fixes, one tap each', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Insights tab'));
    expect(
      await screen.findByLabelText(/^App pause: Stopped by your phone/),
    ).toBeTruthy();
    await press(/^App pause:/); // open the tile
    expect(await screen.findByText('Your phone stopped the pause')).toBeTruthy();
    await press('1. Allow Autostart');
    expect(gate.openAutostartSettings).toHaveBeenCalledTimes(1);
    await press('2. Battery saver: No restrictions');
    expect(gate.openAppSettings).toHaveBeenCalledTimes(1);
    await press('Open Accessibility settings');
    expect(gate.openSettings).toHaveBeenCalledTimes(1);
  });
});
