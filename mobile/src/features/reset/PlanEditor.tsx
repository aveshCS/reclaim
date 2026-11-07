import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AnswerHint, Button, Chip, Txt } from '../../components';
import { IfThenPlan } from '../../state/settings';
import { colors, fonts, MIN_TOUCH_TARGET, radius } from '../../theme/tokens';

const WHENS = [
  'I reach for my phone while studying',
  'I open Instagram without deciding to',
  'I feel bored',
  'I get into bed',
];
const THENS = [
  'take one slow breath and put it face down',
  'read one page first',
  'do 10 minutes of focus',
  'stand up and drink water',
];

/** If-then plan (implementation intention) builder with quick picks or your own words. */
export function PlanEditor({
  initial,
  onSave,
  saveLabel = 'Save my plan',
}: {
  initial: IfThenPlan | null;
  onSave: (p: IfThenPlan) => void;
  saveLabel?: string;
}) {
  const [when, setWhen] = useState(initial?.when ?? '');
  const [then, setThen] = useState(initial?.then ?? '');
  const ok = when.trim().length > 2 && then.trim().length > 2;

  return (
    <View style={styles.gap}>
      <Txt variant="bodyBold">When…</Txt>
      <AnswerHint kind="one" />
      <View style={styles.chips}>
        {WHENS.map(w => (
          <Chip
            key={w}
            role="radio"
            label={w}
            selected={when === w}
            onPress={() => setWhen(w)}
          />
        ))}
      </View>
      <TextInput
        value={when}
        onChangeText={setWhen}
        placeholder="…or write your own"
        placeholderTextColor={colors.inkFaint}
        accessibilityLabel="When, in your own words"
        maxLength={80}
        style={styles.input}
      />
      <Txt variant="bodyBold">…then I will</Txt>
      <AnswerHint kind="one" />
      <View style={styles.chips}>
        {THENS.map(t => (
          <Chip
            key={t}
            role="radio"
            label={t}
            selected={then === t}
            onPress={() => setThen(t)}
          />
        ))}
      </View>
      <TextInput
        value={then}
        onChangeText={setThen}
        placeholder="…or write your own"
        placeholderTextColor={colors.inkFaint}
        accessibilityLabel="Then, in your own words"
        maxLength={80}
        style={styles.input}
      />
      {ok ? (
        <Txt variant="caption">
          “When {when.trim()}, I will {then.trim()}.”
        </Txt>
      ) : null}
      <Button
        label={saveLabel}
        disabled={!ok}
        onPress={() => onSave({ when: when.trim(), then: then.trim() })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    minHeight: MIN_TOUCH_TARGET + 4,
    backgroundColor: colors.card,
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
  },
});
