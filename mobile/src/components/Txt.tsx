import React from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';
import { colors, fonts } from '../theme/tokens';

export type TxtVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyBold'
  | 'label'
  | 'caption';

type Props = TextProps & {
  variant?: TxtVariant;
  color?: string;
  center?: boolean;
};

/** All app text goes through here so the bundled fonts are applied consistently. */
export function Txt({
  variant = 'body',
  color,
  center,
  style,
  ...rest
}: Props) {
  return (
    <Text
      accessibilityRole={
        variant === 'display' || variant === 'title' ? 'header' : undefined
      }
      style={[
        styles[variant],
        color ? { color } : null,
        center ? styles.center : null,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  display: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 40,
    color: colors.ink,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 27,
    lineHeight: 33,
    color: colors.ink,
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 19,
    lineHeight: 25,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 23,
    color: colors.inkSoft,
  },
  bodyBold: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    lineHeight: 23,
    color: colors.ink,
  },
  label: {
    fontFamily: fonts.bodyBlack,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.orange,
    textTransform: 'uppercase',
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkFaint,
  },
  center: { textAlign: 'center' },
});
