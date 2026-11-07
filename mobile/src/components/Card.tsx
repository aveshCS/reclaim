import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, radius, STICKER_OFFSET } from '../theme/tokens';

export type CardTone = 'card' | 'butter' | 'sky' | 'leaf' | 'orange' | 'sand';

const toneBg: Record<CardTone, string> = {
  card: colors.card,
  butter: colors.butterSoft,
  sky: colors.skySoft,
  leaf: colors.leafSoft,
  orange: colors.orangeSoft,
  sand: colors.sand,
};

type Props = ViewProps & { tone?: CardTone; flat?: boolean };

/** Paper "sticker" card: ink outline with a hard offset shadow. */
export function Card({ style, tone = 'card', flat = false, ...rest }: Props) {
  return (
    <View style={flat ? null : styles.outer}>
      {flat ? null : <View style={styles.shadow} />}
      <View
        style={[styles.card, { backgroundColor: toneBg[tone] }, style]}
        {...rest}
      />
    </View>
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
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.line,
    padding: 18,
    gap: 10,
  },
});
