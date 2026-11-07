import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Txt } from '../../components';
import { colors } from '../../theme/tokens';

function Flower({ color, size = 34 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size * 1.4} viewBox="0 0 40 56">
      <Path d="M20 26 L20 54" stroke={colors.leaf} strokeWidth={3} />
      <Path
        d="M20 44 C12 38 8 42 8 46 C14 47 18 46 20 44 Z"
        fill={colors.leaf}
        stroke={colors.ink}
        strokeWidth={1.5}
      />
      {[0, 72, 144, 216, 288].map(a => {
        const r = (a * Math.PI) / 180;
        return (
          <Circle
            key={a}
            cx={20 + Math.cos(r) * 8}
            cy={18 + Math.sin(r) * 8}
            r={7}
            fill={color}
            stroke={colors.ink}
            strokeWidth={1.5}
          />
        );
      })}
      <Circle
        cx={20}
        cy={18}
        r={5}
        fill={colors.butter}
        stroke={colors.ink}
        strokeWidth={1.5}
      />
    </Svg>
  );
}

/** Pip's garden: one flower per completed daily workout. Flowers stay forever. */
export function Garden({
  flowers,
}: {
  flowers: { date: string; color: string }[];
}) {
  const shown = flowers.slice(-21);
  return (
    <View
      style={styles.bed}
      accessible
      accessibilityLabel={`Pip's garden: ${flowers.length} flower${
        flowers.length === 1 ? '' : 's'
      }`}
    >
      {shown.length === 0 ? (
        <Txt variant="caption" center>
          Your first flower appears when you finish today's workout.
        </Txt>
      ) : (
        <View style={styles.row}>
          {shown.map(f => (
            <Flower key={f.date} color={f.color} />
          ))}
        </View>
      )}
      <View style={styles.soil} />
    </View>
  );
}

const styles = StyleSheet.create({
  bed: { gap: 0, paddingTop: 6 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 2,
    paddingHorizontal: 4,
  },
  soil: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#C9A27A',
    borderWidth: 2,
    borderColor: colors.line,
    marginTop: -2,
  },
});
