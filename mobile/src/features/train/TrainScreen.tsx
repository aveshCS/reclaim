import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Pip,
  ScreenContainer,
  SectionHeading,
  Txt,
} from '../../components';
import { colors, MIN_TOUCH_TARGET, radius } from '../../theme/tokens';
import { haptic } from '../../utils/haptics';
import { useSettings } from '../../state/SettingsContext';
import { localDateKey } from '../../utils/time';

// TEMPORARY (Phase 6): this single exercise is hardcoded. Phase 6 moves
// exercises into a typed, reviewed content bank with server-side grading.
const OPTIONS = [
  'The claim is supported by enough evidence.',
  'The argument assumes that correlation proves causation.',
  'The conclusion is unrelated to the premise.',
  'The argument contains no assumption.',
];
const CORRECT_INDEX = 1;

export function TrainScreen() {
  const [choice, setChoice] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const { completePractice } = useSettings();
  const right = submitted && choice === CORRECT_INDEX;

  return (
    <ScreenContainer>
      <SectionHeading
        kicker="Cognitive gym"
        title="Think deeper."
        subtitle="Spot the hidden assumption in an everyday argument."
      />
      <Card>
        <Txt variant="label" color={colors.leaf}>
          Argument check · 3 min
        </Txt>
        <Txt variant="heading">
          “People who drink more coffee report higher productivity. Therefore,
          drinking more coffee makes everyone more productive.”
        </Txt>
        <Txt>Which is the most important weakness in this argument?</Txt>
        {OPTIONS.map((o, i) => (
          <Pressable
            key={o}
            accessibilityRole="radio"
            accessibilityState={{ selected: choice === i }}
            disabled={submitted}
            onPress={() => {
              haptic.select();
              setChoice(i);
            }}
            style={[
              styles.option,
              choice === i && styles.selected,
              submitted && i === CORRECT_INDEX && styles.correct,
            ]}
          >
            <Txt variant="bodyBold" style={styles.optionText}>
              {String.fromCharCode(65 + i)}. {o}
            </Txt>
          </Pressable>
        ))}
      </Card>

      {submitted ? (
        <Card tone={right ? 'leaf' : 'sky'} style={styles.feedback}>
          <Pip size={84} mood={right ? 'cheer' : 'think'} bob={false} />
          <View style={styles.flex}>
            <Txt variant="heading">
              {right ? 'Sharp thinking!' : 'Good try. Look again.'}
            </Txt>
            <Txt>
              The argument assumes coffee causes the productivity. Other factors
              could explain it, and a link alone doesn't prove cause.
            </Txt>
          </View>
        </Card>
      ) : null}

      <Button
        label={submitted ? 'Answer reviewed' : 'Check my reasoning'}
        disabled={choice === null || submitted}
        onPress={() => {
          setSubmitted(true);
          completePractice(localDateKey(Date.now()));
          if (choice === CORRECT_INDEX) {
            haptic.success();
          }
        }}
      />
      <Txt variant="caption" center>
        Practice for learning, not a clinical cognitive assessment.
      </Txt>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  option: {
    minHeight: MIN_TOUCH_TARGET + 8,
    justifyContent: 'center',
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  selected: { backgroundColor: colors.butter },
  correct: { backgroundColor: colors.leafSoft, borderColor: colors.leaf },
  optionText: { fontSize: 15, lineHeight: 21 },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
