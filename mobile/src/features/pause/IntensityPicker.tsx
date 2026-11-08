import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AnswerHint, Button, Card, Chip, Tile, Txt } from '../../components';
import { useSettings } from '../../state/SettingsContext';
import {
  baseNow,
  effectiveLevel,
  formatWhen,
  LEVELS,
  STRICT,
  strictPresets,
} from '../../state/intensity';
import { colors, radius } from '../../theme/tokens';
import { haptic } from '../../utils/haptics';
import { pauseGate } from '../../native/pauseGate';

/**
 * Choose how firm RECLAIM is: Aware, Gentle, Firm, or Strict for a while.
 * Tighter takes effect now; gentler waits a day (shown, and can be cancelled).
 */
export function IntensityPicker({ suggested }: { suggested?: 2 | 3 }) {
  const s = useSettings();
  const { intensity } = s.settings;
  const now = Date.now();
  const level = effectiveLevel(intensity, now);
  const everyday = baseNow(intensity, now);
  const strictOn = level === STRICT;
  const [strictOpen, setStrictOpen] = useState(false);
  const levelName = (l: number) => LEVELS.find(x => x.level === l)?.name ?? '';
  const pending =
    intensity.pending && intensity.pending.at > now ? intensity.pending : null;
  // The option the user picked is selected at once; a gentler pick shows when it starts.
  const chosen = pending ? pending.level : everyday;

  return (
    <View style={styles.gap}>
      <AnswerHint kind="one" />
      {LEVELS.filter(l => l.level !== STRICT).map(l => (
        <Pressable
          key={l.level}
          accessibilityRole="radio"
          accessibilityState={{ selected: chosen === l.level }}
          accessibilityLabel={`${l.name}: ${l.short}`}
          onPress={() => {
            haptic.select();
            if (l.level === everyday) {
              s.cancelPendingLevel(); // back to the level already in force
            } else {
              s.requestLevel(l.level as 1 | 2 | 3);
            }
          }}
          style={({ pressed }) => [
            styles.option,
            chosen === l.level && styles.optionOn,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.row}>
            <View style={[styles.dot, chosen === l.level && styles.dotOn]} />
            <Txt variant="bodyBold" style={styles.flex}>
              {l.name} · {l.short}
            </Txt>
            {pending && l.level === pending.level ? (
              <Txt variant="caption" style={[styles.tag, styles.tagSoon]}>
                From {formatWhen(pending.at, now)}
              </Txt>
            ) : pending && l.level === everyday ? (
              <Txt variant="caption" style={styles.tag}>
                Now
              </Txt>
            ) : suggested === l.level ? (
              <Txt variant="caption" style={styles.tag}>
                Pip suggests
              </Txt>
            ) : null}
          </View>
          <Txt variant="caption">{l.detail}</Txt>
        </Pressable>
      ))}

      {pending ? (
        <Txt variant="caption">
          🌙 Gentler waits a day, so a tired moment can't undo a calm choice.
          Tap {levelName(everyday)} to stay.
        </Txt>
      ) : null}

      <Card tone="sand">
        <Txt variant="bodyBold">Strict · locked until you said</Txt>
        <Txt variant="caption">{LEVELS[3].detail}</Txt>
        {strictOn && intensity.strictUntil ? (
          <>
            <Txt variant="bodyBold" color={colors.leaf}>
              ✓ Strict until {formatWhen(intensity.strictUntil, now)}
            </Txt>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="End Strict early"
              onPress={s.endStrictEarly}
              hitSlop={8}
            >
              <Txt variant="caption" style={styles.link}>
                End Strict early (takes up to 24 hours)
              </Txt>
            </Pressable>
          </>
        ) : strictOpen ? (
          <>
            <Txt variant="bodyBold">For how long? (choose one)</Txt>
            <View style={styles.chips}>
              {strictPresets(now).map(p => (
                <Chip
                  key={p.label}
                  role="radio"
                  label={p.label}
                  selected={false}
                  onPress={() => {
                    s.startStrict(p.until);
                    setStrictOpen(false);
                  }}
                />
              ))}
            </View>
          </>
        ) : (
          <Button
            label="Try Strict for a while"
            variant="secondary"
            onPress={() => setStrictOpen(true)}
          />
        )}
      </Card>
    </View>
  );
}

/** Insights tile: the current level in one line; the picker one tap away. */
export function IntensityCard() {
  const { intensity } = useSettings().settings;
  if (!pauseGate.isAvailable()) {
    return null;
  }
  const now = Date.now();
  const level = effectiveLevel(intensity, now);
  const name = (l: number) => LEVELS.find(x => x.level === l)?.name ?? '';
  const summary =
    level === STRICT && intensity.strictUntil
      ? `Strict until ${formatWhen(intensity.strictUntil, now)}`
      : intensity.pending && intensity.pending.at > now
      ? `${name(level)} → ${name(intensity.pending.level)}`
      : name(level);
  return (
    <Tile icon="🎚" label="Intensity" summary={summary}>
      <IntensityPicker />
    </Tile>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 10 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    gap: 4,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  optionOn: { backgroundColor: colors.butterSoft },
  pressed: { transform: [{ scale: 0.98 }] },
  tagSoon: { backgroundColor: colors.skySoft },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  dotOn: { backgroundColor: colors.orange },
  tag: {
    backgroundColor: colors.leafSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  note: {
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.skySoft,
  },
  link: { textDecorationLine: 'underline', color: colors.inkSoft },
});
