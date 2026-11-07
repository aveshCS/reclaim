import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, TextStyle, StyleProp } from 'react-native';
import { useReducedMotion } from '../utils/motion';
import { Txt, TxtVariant } from './Txt';

type Props = {
  value: number;
  decimals?: number;
  suffix?: string;
  durationMs?: number;
  variant?: TxtVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
};

/** Animated number that counts up to `value`. Shows the final value immediately with reduced motion. */
export function CountUp({
  value,
  decimals = 0,
  suffix = '',
  durationMs = 1400,
  variant = 'display',
  color,
  style,
}: Props) {
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;
  const [n, setN] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setN(value);
      return;
    }
    const id = anim.addListener(({ value: v }) => setN(v));
    anim.setValue(0);
    const a = Animated.timing(anim, {
      toValue: value,
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => {
      a.stop();
      anim.removeListener(id);
    };
  }, [value, durationMs, reduced, anim]);

  const text = `${n.toFixed(decimals)}${suffix}`;
  return (
    <Txt
      variant={variant}
      color={color}
      style={style}
      accessibilityLabel={`${value.toFixed(decimals)}${suffix}`}
    >
      {text}
    </Txt>
  );
}
