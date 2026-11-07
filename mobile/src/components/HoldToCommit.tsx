import React, { useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, STICKER_OFFSET } from '../theme/tokens';
import { haptic } from '../utils/haptics';
import { Txt } from './Txt';

type Props = {
  label: string;
  doneLabel?: string;
  onComplete: () => void;
  holdMs?: number;
};

/**
 * Press-and-hold to commit. The fill grows while held and resets if released early.
 * Screen-reader users can activate it directly (double tap) via the accessibility action.
 */
export function HoldToCommit({
  label,
  doneLabel = 'Committed',
  onComplete,
  holdMs = 1400,
}: Props) {
  const fill = useRef(new Animated.Value(0)).current;
  const [done, setDone] = useState(false);

  const finish = () => {
    if (done) {
      return;
    }
    setDone(true);
    fill.setValue(1);
    haptic.success();
    onComplete();
  };

  const start = () => {
    if (done) {
      return;
    }
    haptic.tap();
    Animated.timing(fill, {
      toValue: 1,
      duration: holdMs,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        finish();
      }
    });
  };

  const cancel = () => {
    if (done) {
      return;
    }
    fill.stopAnimation();
    Animated.timing(fill, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={done ? doneLabel : label}
      accessibilityHint="Press and hold until the bar fills"
      accessibilityState={{ disabled: done }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={e => {
        if (e.nativeEvent.actionName === 'activate') {
          finish();
        }
      }}
      onPressIn={start}
      onPressOut={cancel}
      style={styles.outer}
    >
      <View style={styles.shadow} />
      <View style={styles.face}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: fill.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
        <Txt variant="bodyBold" style={styles.text}>
          {done ? `✓  ${doneLabel}` : label}
        </Txt>
      </View>
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
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.card,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.orange,
  },
  text: { fontSize: 17 },
});
