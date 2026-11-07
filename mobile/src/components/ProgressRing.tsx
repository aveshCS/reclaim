import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../theme/tokens';

type Props = {
  size: number;
  stroke?: number;
  /** 0..1 */
  progress: number;
  children?: React.ReactNode;
};

/** Thick outlined ring, filled with orange as time passes. */
export function ProgressRing({ size, stroke = 18, progress, children }: Props) {
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  const mid = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={mid}
          cy={mid}
          r={r + stroke / 2}
          fill={colors.card}
          stroke={colors.line}
          strokeWidth={2}
        />
        <Circle
          cx={mid}
          cy={mid}
          r={r - stroke / 2}
          fill={colors.paper}
          stroke={colors.line}
          strokeWidth={2}
        />
        <Circle
          cx={mid}
          cy={mid}
          r={r}
          stroke={colors.sand}
          strokeWidth={stroke - 2}
          fill="none"
        />
        {p > 0 ? (
          <Circle
            cx={mid}
            cy={mid}
            r={r}
            stroke={colors.orange}
            strokeWidth={stroke - 2}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - p)}
            transform={`rotate(-90 ${mid} ${mid})`}
          />
        ) : null}
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
