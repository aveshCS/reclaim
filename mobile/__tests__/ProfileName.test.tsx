import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import App from '../App';
import { SETTINGS_KEY } from '../src/services/settingsStorage';
import { DEFAULT_SETTINGS } from '../src/state/settings';

beforeEach(async () => {
  await AsyncStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      ...DEFAULT_SETTINGS,
      onboarding: { completed: true, step: 'ready', protect: 'later' },
    }),
  );
});

it('saves the whole name even when editing ends before the last keystroke reached state', async () => {
  await render(<App />);
  await fireEvent.press(await screen.findByLabelText('Profile tab'));
  const field = await screen.findByLabelText('Your first name');
  await fireEvent.changeText(field, 'A'); // the draft only saw the first letter
  await fireEvent(field, 'endEditing', { nativeEvent: { text: 'Avi' } });
  await waitFor(async () =>
    expect(
      JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY))!).profile.name,
    ).toBe('Avi'),
  );
});

it('shows a name that arrives later, e.g. restored from backup', async () => {
  const { useSettings } = require('../src/state/SettingsContext');
  let restore: (d: Record<string, unknown>) => void = () => {};
  function Grab() {
    restore = useSettings().restoreBackup;
    return null;
  }
  const { ProfileScreen } = require('../src/features/profile/ProfileScreen');
  const { SettingsProvider } = require('../src/state/SettingsContext');
  await render(
    <SettingsProvider>
      <Grab />
      <ProfileScreen />
    </SettingsProvider>,
  );
  const field = await screen.findByLabelText('Your first name');
  expect(field.props.value).toBe('');
  await act(async () =>
    restore({ profile: { ...DEFAULT_SETTINGS.profile, name: 'Avi' } }),
  );
  expect(screen.getByLabelText('Your first name').props.value).toBe('Avi');
});
