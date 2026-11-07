import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/tokens';

/** Paper background + scrollable, safe-area-aware page. Taps outside inputs still work while the keyboard is open. */
export function ScreenContainer({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.root}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg },
        ]}
      >
        {children}
      </ScrollView>
      {/* Paper strip behind the status bar so scrolled content doesn't run under it. */}
      <View style={[styles.statusBar, { height: insets.top }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  statusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.paper,
  },
  content: { padding: spacing.xl, paddingBottom: 56, gap: spacing.lg },
});
