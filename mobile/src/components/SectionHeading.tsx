import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt } from './Txt';

type Props = { kicker?: string; title: string; subtitle?: string };

export function SectionHeading({ kicker, title, subtitle }: Props) {
  return (
    <View style={styles.wrap}>
      {kicker ? <Txt variant="label">{kicker}</Txt> : null}
      <Txt variant="display">{title}</Txt>
      {subtitle ? <Txt>{subtitle}</Txt> : null}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: 6 } });
