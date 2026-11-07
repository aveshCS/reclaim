import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt } from '../../components';
import { colors, radius } from '../../theme/tokens';
import { formatDuration, weekdayShort } from '../../utils/time';
import type { WeekBar } from './dashboardLogic';

const HEIGHT = 110;

/** Seven-day bars. "No data" days are drawn as an empty dashed outline, never as zero. */
export function WeekBars({
  bars,
  baselineMs,
}: {
  bars: WeekBar[];
  baselineMs: number | null;
}) {
  const max = Math.max(1, baselineMs ?? 0, ...bars.map(b => b.ms ?? 0));
  return (
    <View>
      <View style={styles.chart}>
        {baselineMs ? (
          <View
            style={[styles.baseline, { bottom: (baselineMs / max) * HEIGHT }]}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
        {bars.map(b => {
          const label = `${b.isToday ? 'Today' : weekdayShort(b.date)}: ${
            b.ms === null
              ? 'no data'
              : `${formatDuration(b.ms)}${b.partial ? ', partial day' : ''}`
          }`;
          return (
            <View
              key={b.date}
              style={styles.col}
              accessible
              accessibilityLabel={label}
            >
              <View style={styles.track}>
                {b.ms === null ? (
                  <View style={styles.noData} />
                ) : (
                  <View
                    style={[
                      styles.bar,
                      b.isToday && styles.today,
                      b.partial && styles.partial,
                      { height: Math.max(4, (b.ms / max) * HEIGHT) },
                    ]}
                  />
                )}
              </View>
              <Txt
                variant="caption"
                style={[styles.day, b.isToday && styles.dayToday]}
              >
                {b.isToday ? 'Today' : weekdayShort(b.date)}
              </Txt>
            </View>
          );
        })}
      </View>
      {baselineMs ? (
        <Txt variant="caption">Dashed line: your usual day</Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: HEIGHT + 24,
  },
  baseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.inkFaint,
    marginBottom: 24,
  },
  col: { flex: 1, alignItems: 'center', gap: 6 },
  track: { height: HEIGHT, width: '100%', justifyContent: 'flex-end' },
  bar: {
    width: '100%',
    borderRadius: radius.sm,
    backgroundColor: colors.sand,
    borderWidth: 2,
    borderColor: colors.line,
  },
  today: { backgroundColor: colors.orange },
  partial: { opacity: 0.6 },
  noData: {
    height: 24,
    width: '100%',
    borderRadius: radius.sm,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.inkFaint,
  },
  day: { fontSize: 11 },
  dayToday: { color: colors.ink },
});
