import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutAnimation, StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme/tokens';
import { haptic } from '../utils/haptics';
import { Card, CardTone } from './Card';
import { PressScale } from './Motion';
import { Txt } from './Txt';

type Props = {
  icon: string;
  label: string;
  /** The one line people need: a number or a state. */
  summary: string;
  tone?: CardTone;
  /** Open by default (e.g. when a feature still needs setting up). */
  defaultOpen?: boolean;
  /** Shown even when closed, under the summary (e.g. Pip and a big number). */
  preview?: React.ReactNode;
  children?: React.ReactNode;
};

/**
 * A compact card: icon, label and one summary line. Tap to open the details.
 * Keeps screens short; the full controls are one tap away.
 */
export function Tile({
  icon,
  label,
  summary,
  tone = 'card',
  defaultOpen = false,
  preview,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const turn = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(turn, {
      toValue: open ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [open, turn]);

  const toggle = () => {
    haptic.select();
    LayoutAnimation.configureNext(
      LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'),
    );
    setOpen(o => !o);
  };

  return (
    <Card tone={tone}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${summary}`}
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={styles.head}
        scaleTo={0.98}
      >
        <View style={styles.icon}>
          <Txt style={styles.iconText}>{icon}</Txt>
        </View>
        <View style={styles.flex}>
          <Txt variant="label" color={colors.ink}>
            {label}
          </Txt>
          <Txt variant="heading" numberOfLines={2}>
            {summary}
          </Txt>
        </View>
        <Animated.View
          style={{
            transform: [
              {
                rotate: turn.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '90deg'],
                }),
              },
            ],
          }}
        >
          <Txt variant="title">›</Txt>
        </Animated.View>
      </PressScale>
      {preview}
      {open ? <View style={styles.body}>{children}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 22 },
  body: { gap: 10, paddingTop: 4 },
});
