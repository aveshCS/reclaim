import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../theme/tokens';

/** Thin onboarding progress bar. `value` is 0..1. */
export function ProgressBar({ value }: { value: number }) {
  const v = Math.min(1, Math.max(0, value));
  const anim = useRef(new Animated.Value(v)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: v,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [v, anim]);

  return (
    <View
      style={styles.track}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Setup ${Math.round(v * 100)} percent done`}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            width: anim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.orange },
});
