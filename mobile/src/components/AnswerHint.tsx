import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme/tokens';
import { Txt } from './Txt';

/** Small "Choose one" / "Choose any that apply" tag that sits right above the answers. */
export function AnswerHint({ kind }: { kind: 'one' | 'many' | 'type' }) {
  const text =
    kind === 'one'
      ? 'Choose one'
      : kind === 'many'
      ? 'Choose any that apply'
      : 'Type your answer';
  return (
    <View style={styles.row}>
      <View style={styles.tag}>
        <Txt variant="label" color={colors.ink} style={styles.text}>
          {kind === 'one' ? '◉ ' : kind === 'many' ? '☑ ' : '✎ '}
          {text}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  tag: {
    backgroundColor: colors.butterSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  text: { fontSize: 11, letterSpacing: 1 },
});
