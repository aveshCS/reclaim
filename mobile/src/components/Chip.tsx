import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, MIN_TOUCH_TARGET, radius } from '../theme/tokens';
import { haptic } from '../utils/haptics';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 'checkbox' for multi-select, 'radio' for single-select. */
  role?: 'checkbox' | 'radio';
  /** Optional leading emoji/glyph, purely decorative. */
  icon?: string;
  /** Stretch to full width (for answer lists). */
  block?: boolean;
};

export function Chip({
  label,
  selected,
  onPress,
  role = 'checkbox',
  icon,
  block = false,
}: Props) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={
        role === 'checkbox' ? { checked: selected } : { selected }
      }
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        block && styles.block,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      {icon ? (
        <Text
          style={styles.icon}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {icon}
        </Text>
      ) : null}
      <Text
        style={[
          styles.text,
          block && styles.blockText,
          selected && styles.selectedText,
        ]}
      >
        {label}
      </Text>
      {selected && block ? (
        <Text style={styles.tick} importantForAccessibility="no">
          ✓
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  block: {
    borderRadius: radius.md,
    minHeight: 56,
    paddingVertical: 12,
  },
  selected: { backgroundColor: colors.butter },
  pressed: { transform: [{ scale: 0.98 }] },
  icon: { fontSize: 18 },
  text: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  blockText: { flex: 1, fontSize: 16 },
  selectedText: { fontFamily: fonts.bodyBlack },
  tick: { fontFamily: fonts.bodyBlack, fontSize: 18, color: colors.ink },
});
