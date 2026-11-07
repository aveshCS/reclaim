import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Chip, Txt } from '../../components';
import {
  FOCUS_PRESETS,
  MAX_FOCUS_MINUTES,
  MIN_FOCUS_MINUTES,
} from '../../state/settings';
import { colors, fonts, MIN_TOUCH_TARGET, radius } from '../../theme/tokens';

type Props = { minutes: number; onChange: (minutes: number) => void };

const isPreset = (m: number) =>
  (FOCUS_PRESETS as readonly number[]).includes(m);

/** Presets (15/25/45) plus a custom value between 5 and 180 minutes. */
export function FocusDurationPicker({ minutes, onChange }: Props) {
  const [customOpen, setCustomOpen] = useState(!isPreset(minutes));
  const [draft, setDraft] = useState(isPreset(minutes) ? '' : String(minutes));

  const showCustom = customOpen || !isPreset(minutes);
  const parsed = Number(draft);
  const invalid =
    draft !== '' &&
    (!Number.isInteger(parsed) ||
      parsed < MIN_FOCUS_MINUTES ||
      parsed > MAX_FOCUS_MINUTES);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {FOCUS_PRESETS.map(m => (
          <Chip
            key={m}
            role="radio"
            label={`${m} min`}
            selected={!showCustom && minutes === m}
            onPress={() => {
              setCustomOpen(false);
              setDraft('');
              onChange(m);
            }}
          />
        ))}
        <Chip
          role="radio"
          label="Custom"
          selected={showCustom}
          onPress={() => setCustomOpen(true)}
        />
      </View>
      {showCustom ? (
        <View style={styles.custom}>
          <TextInput
            value={draft}
            onChangeText={text => {
              const digits = text.replace(/[^0-9]/g, '').slice(0, 3);
              setDraft(digits);
              const n = Number(digits);
              if (digits && n >= MIN_FOCUS_MINUTES && n <= MAX_FOCUS_MINUTES) {
                onChange(n);
              }
            }}
            keyboardType="number-pad"
            placeholder="Minutes"
            placeholderTextColor={colors.inkFaint}
            accessibilityLabel="Custom focus duration in minutes"
            style={styles.input}
          />
          <Txt variant="caption" color={invalid ? colors.danger : undefined}>
            {invalid
              ? `Enter a whole number from ${MIN_FOCUS_MINUTES} to ${MAX_FOCUS_MINUTES}.`
              : `${MIN_FOCUS_MINUTES}–${MAX_FOCUS_MINUTES} minutes`}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  custom: { gap: 6 },
  input: {
    minHeight: MIN_TOUCH_TARGET + 4,
    backgroundColor: colors.card,
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
  },
});
