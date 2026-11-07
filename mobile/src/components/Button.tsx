import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  colors,
  fonts,
  MIN_TOUCH_TARGET,
  radius,
  STICKER_OFFSET,
} from '../theme/tokens';
import { haptic } from '../utils/haptics';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  accessibilityHint?: string;
};

/** Chunky button that physically "presses" into its shadow. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityHint,
}: Props) {
  const press = useRef(new Animated.Value(0)).current;
  const to = (v: number) =>
    Animated.timing(press, {
      toValue: v,
      duration: 90,
      useNativeDriver: true,
    }).start();

  const a11y = {
    accessibilityRole: 'button' as const,
    accessibilityLabel: label,
    accessibilityHint,
    accessibilityState: { disabled },
    disabled,
    onPress: () => {
      haptic.tap();
      onPress();
    },
  };

  if (variant === 'ghost') {
    return (
      <Pressable {...a11y} style={[styles.ghost, disabled && styles.dim]}>
        <Text style={styles.ghostText}>{label}</Text>
      </Pressable>
    );
  }

  const translate = press.interpolate({
    inputRange: [0, 1],
    outputRange: [0, STICKER_OFFSET],
  });

  return (
    <Pressable
      {...a11y}
      onPressIn={() => to(1)}
      onPressOut={() => to(0)}
      style={[styles.outer, disabled && styles.dim]}
    >
      <View style={styles.shadow} />
      <Animated.View
        style={[
          styles.face,
          variant === 'primary' ? styles.primary : styles.secondary,
          { transform: [{ translateX: translate }, { translateY: translate }] },
        ]}
      >
        <Text style={styles.text}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: { paddingRight: STICKER_OFFSET, paddingBottom: STICKER_OFFSET },
  shadow: {
    position: 'absolute',
    top: STICKER_OFFSET,
    left: STICKER_OFFSET,
    right: 0,
    bottom: 0,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
  },
  face: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primary: { backgroundColor: colors.orange },
  secondary: { backgroundColor: colors.card },
  text: {
    fontFamily: fonts.bodyBlack,
    fontSize: 17,
    color: colors.ink,
    textAlign: 'center',
  },
  ghost: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.inkSoft,
    textDecorationLine: 'underline',
  },
  dim: { opacity: 0.4 },
});
