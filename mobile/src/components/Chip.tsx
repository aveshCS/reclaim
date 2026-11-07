import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, MIN_TOUCH_TARGET, radius } from '../theme/tokens';
import { haptic } from '../utils/haptics';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 'checkbox' for multi-select (square tick), 'radio' for single-select (round dot). */
  role?: 'checkbox' | 'radio';
  /** Optional leading emoji/glyph, purely decorative. */
  icon?: string;
  /** Stretch to full width (for answer lists). */
  block?: boolean;
};

/** Visible radio/checkbox mark, so answers read as choices and single vs multi is obvious. */
function Mark({
  role,
  selected,
}: {
  role: 'checkbox' | 'radio';
  selected: boolean;
}) {
  if (role === 'radio') {
    return (
      <View style={[styles.radio, selected && styles.markOn]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    );
  }
  return (
    <View style={[styles.box, selected && styles.markOn]}>
      {selected ? <Text style={styles.tick}>✓</Text> : null}
    </View>
  );
}

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
      <Mark role={role} selected={selected} />
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.ink,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOn: { backgroundColor: colors.card },
  tick: {
    fontFamily: fonts.bodyBlack,
    fontSize: 14,
    lineHeight: 16,
    color: colors.ink,
  },
});
