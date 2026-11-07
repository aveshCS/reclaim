import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../theme/tokens';
import { Button } from './Button';
import { Card } from './Card';
import { Txt } from './Txt';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <View
      style={styles.center}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <ActivityIndicator color={colors.orange} />
      <Txt>{label}…</Txt>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Card tone="orange" accessibilityRole="alert">
      <Txt variant="heading">Something went wrong</Txt>
      <Txt>{message}</Txt>
      {onRetry ? (
        <Button label="Try again" onPress={onRetry} variant="ghost" />
      ) : null}
    </Card>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <Txt variant="heading">{title}</Txt>
      <Txt>{body}</Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 8, padding: 24 },
});
