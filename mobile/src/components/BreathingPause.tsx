import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/tokens';
import { haptic } from '../utils/haptics';
import { useReducedMotion } from '../utils/motion';
import { Button } from './Button';
import { Pip } from './Pip';
import { Txt } from './Txt';

const INHALE_MS = 4000;
const EXHALE_MS = 6000;

/** Breathe along with Pip. No data is read or stored. */
export function BreathingPause({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(0.85)).current;
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  useEffect(() => {
    if (!visible) {
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const run = (next: 'in' | 'out') => {
      if (!alive) {
        return;
      }
      setPhase(next);
      haptic.tap();
      if (!reduced) {
        Animated.timing(scale, {
          toValue: next === 'in' ? 1.15 : 0.85,
          duration: next === 'in' ? INHALE_MS : EXHALE_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }).start();
      }
      timer = setTimeout(
        () => run(next === 'in' ? 'out' : 'in'),
        next === 'in' ? INHALE_MS : EXHALE_MS,
      );
    };
    run('in');
    return () => {
      alive = false;
      clearTimeout(timer);
      scale.stopAnimation();
      scale.setValue(0.85);
    };
  }, [visible, reduced, scale]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Txt variant="title" center>
          Breathe with Pip
        </Txt>
        <View style={styles.circle}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <Pip size={200} mood="calm" bob={false} />
          </Animated.View>
        </View>
        <Txt
          variant="title"
          color={colors.orange}
          center
          accessibilityLiveRegion="polite"
        >
          {phase === 'in' ? 'Breathe in…' : 'Breathe out…'}
        </Txt>
        <Txt center>Nothing to do. Stay as long as you like.</Txt>
        <View style={styles.button}>
          <Button label="I'm ready" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.skySoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 22,
  },
  circle: {
    width: 290,
    height: 290,
    borderRadius: 145,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: { alignSelf: 'stretch', marginTop: 8 },
});
