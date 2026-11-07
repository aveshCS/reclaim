import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Pip, ProgressBar, Txt } from '../../components';
import { colors } from '../../theme/tokens';
import { haptic } from '../../utils/haptics';
import { ms } from '../gym/gymModel';

export const MOVES = [
  { name: 'March on the spot', tip: 'Lift your knees, swing your arms.' },
  { name: 'Star jumps', tip: 'Or step-jacks if you need it quieter.' },
  { name: 'Walk briskly', tip: 'Around the room, the corridor or the stairs.' },
  { name: 'Squats', tip: 'Slow and comfortable. Sit back like into a chair.' },
  { name: 'Shake it out', tip: 'Loosen shoulders, arms and legs. Breathe.' },
];
export const MOVE_SECONDS = 60;

/**
 * A 5-minute movement break before focusing. A single bout of moderate exercise gives
 * a small, short-term boost to attention in research. Stop if anything hurts.
 */
export function MoveBreak({
  visible,
  onDone,
  onSkip,
}: {
  visible: boolean;
  onDone: () => void;
  onSkip: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [elapsed, setElapsed] = useState(0);
  const total = MOVES.length * MOVE_SECONDS;

  useEffect(() => {
    if (!visible) {
      setElapsed(0);
      return;
    }
    const i = setInterval(
      () => setElapsed(e => Math.min(total, e + 1)),
      ms(1000),
    );
    return () => clearInterval(i);
  }, [visible, total]);

  const idx = Math.min(MOVES.length - 1, Math.floor(elapsed / MOVE_SECONDS));
  const left = MOVE_SECONDS - (elapsed % MOVE_SECONDS);
  const done = elapsed >= total;

  useEffect(() => {
    if (visible && elapsed > 0 && elapsed % MOVE_SECONDS === 0) {
      haptic.tap();
    }
  }, [elapsed, visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onSkip}>
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Txt variant="label">Move break · 5 min</Txt>
        <Pip size={130} mood={done ? 'cheer' : 'happy'} />
        {done ? (
          <>
            <Txt variant="title" center>
              Nice! Your brain is warmed up.
            </Txt>
            <Txt center>Start your focus session while the boost lasts.</Txt>
            <Button label="Start focusing" onPress={onDone} />
          </>
        ) : (
          <>
            <Txt variant="title" center accessibilityLiveRegion="polite">
              {MOVES[idx].name}
            </Txt>
            <Txt center>{MOVES[idx].tip}</Txt>
            <Txt variant="display" center>
              {left}s
            </Txt>
            <View style={styles.full}>
              <ProgressBar value={elapsed / total} />
            </View>
            <Txt variant="caption" center>
              Move {idx + 1} of {MOVES.length}. Go at your own pace; stop if
              anything hurts.
            </Txt>
            <Button label="Skip to focus" variant="ghost" onPress={onSkip} />
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.leafSoft,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  full: { alignSelf: 'stretch' },
});
