import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingState } from './src/components';
import { OnboardingFlow } from './src/features/onboarding/OnboardingFlow';
import { FocusProvider } from './src/features/focus/FocusContext';
import { RootTabs } from './src/navigation/RootTabs';
import { SettingsProvider, useSettings } from './src/state/SettingsContext';
import { colors } from './src/theme/tokens';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.paper,
    card: colors.card,
    text: colors.ink,
    border: colors.line,
    primary: colors.orange,
  },
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
});

function Gate() {
  const { ready, settings } = useSettings();
  if (!ready) {
    return (
      <View style={styles.loading}>
        <LoadingState label="Loading" />
      </View>
    );
  }
  if (!settings.onboarding.completed) {
    return <OnboardingFlow />;
  }
  return (
    <NavigationContainer theme={navTheme}>
      <RootTabs />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SettingsProvider>
        <FocusProvider>
          <Gate />
        </FocusProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
