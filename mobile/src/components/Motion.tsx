import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useReducedMotion } from '../utils/motion';
import { FadeIn } from './FadeIn';

/** Children arrive one after another (fade and rise). Instant with reduced motion. */
export function Stagger({
  children,
  step = 60,
  max = 8,
}: {
  children: React.ReactNode;
  step?: number;
  max?: number;
}) {
  return (
    <>
      {React.Children.toArray(children).map((child, i) => (
        <FadeIn
          key={React.isValidElement(child) && child.key != null ? child.key : i}
          delay={Math.min(i, max) * step}
        >
          {child}
        </FadeIn>
      ))}
    </>
  );
}

/** A Pressable that squishes a little while pressed, then springs back. */
export function PressScale({
  style,
  children,
  scaleTo = 0.96,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  scaleTo?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      speed: 40,
      bounciness: v === 1 ? 10 : 0,
      useNativeDriver: true,
    }).start();
  return (
    <Pressable
      {...rest}
      onPressIn={e => {
        to(scaleTo);
        rest.onPressIn?.(e);
      }}
      onPressOut={e => {
        to(1);
        rest.onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/** Springs from small to full size whenever `trigger` changes (a new value, a win). */
export function Pop({
  trigger,
  children,
  style,
}: {
  trigger: unknown;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) {
      return;
    }
    scale.setValue(0.8);
    Animated.spring(scale, {
      toValue: 1,
      speed: 14,
      bounciness: 14,
      useNativeDriver: true,
    }).start();
  }, [trigger, reduced, scale]);
  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}

const SPARKS = ['✨', '🌱', '⭐', '💛', '✨', '🌿', '⭐', '💫'];

/**
 * A small burst of sparkles from the middle of its parent, each time `burstKey` changes.
 * Put it inside a relatively positioned container. Draws nothing with reduced motion.
 */
export function Sparkles({ burstKey }: { burstKey: unknown }) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) {
      return;
    }
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [burstKey, reduced, t]);
  if (reduced) {
    return null;
  }
  return (
    <View pointerEvents="none" style={styles.sparkWrap}>
      {SPARKS.map((s, i) => {
        const angle = (i / SPARKS.length) * Math.PI * 2;
        const dist = 70 + (i % 3) * 18;
        return (
          <Animated.Text
            key={i}
            style={[
              styles.spark,
              {
                opacity: t.interpolate({
                  inputRange: [0, 0.15, 0.8, 1],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateX: t.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, Math.cos(angle) * dist],
                    }),
                  },
                  {
                    translateY: t.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, Math.sin(angle) * dist],
                    }),
                  },
                  {
                    scale: t.interpolate({
                      inputRange: [0, 0.3, 1],
                      outputRange: [0.4, 1.2, 0.8],
                    }),
                  },
                ],
              },
            ]}
          >
            {s}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sparkWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spark: { position: 'absolute', fontSize: 22 },
});
