import React, { useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';
import { Txt } from '../../components';
import { colors, radius } from '../../theme/tokens';

export type Row = { icon: string; text: string };

/**
 * The disclosure at a glance: one short line per point (why, what it sees, what it never
 * does, what stays, your control). The full wording stays one tap away below.
 */
export function DisclosureRows({
  rows,
  children,
}: {
  rows: Row[];
  /** The full disclosure text. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      {rows.map(r => (
        <View key={r.text} style={styles.row}>
          <View style={styles.icon}>
            <Txt style={styles.iconText}>{r.icon}</Txt>
          </View>
          <Txt variant="bodyBold" style={styles.flex}>
            {r.text}
          </Txt>
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Hide the full details' : 'Read the full details'}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen(o => !o);
        }}
        hitSlop={8}
      >
        <Txt variant="caption" style={styles.link}>
          {open ? 'Hide the full details' : 'Read the full details'}
        </Txt>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 18 },
  link: { textDecorationLine: 'underline', color: colors.inkSoft },
});
