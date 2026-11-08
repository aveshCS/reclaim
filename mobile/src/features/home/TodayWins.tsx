import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { CountUp, Pop, Sparkles, Txt } from '../../components';
import { pauseGate } from '../../native/pauseGate';
import { useSettings } from '../../state/SettingsContext';
import { colors, radius } from '../../theme/tokens';
import { localDateKey, startOfLocalDay, startOfLocalDayDaysAgo } from '../../utils/time';
import { useFocus } from '../focus/FocusContext';
import { minutesOnDay } from '../focus/focusModel';

/** Today's "Not now" choices and reels, from the phone; refreshed when RECLAIM comes back. */
export function useTodayCounts() {
  const { settings } = useSettings();
  const [notNow, setNotNow] = useState(0);
  const [reels, setReels] = useState(0);
  const available = pauseGate.isAvailable();
  const protecting = settings.gate.enabled || settings.web.enabled;

  useEffect(() => {
    if (!available) {
      return;
    }
    const load = () => {
      const today = localDateKey(Date.now());
      pauseGate.getStats([today]).then(d => setNotNow(d[0]?.notNow ?? 0));
      if (settings.reels.enabled) {
        pauseGate.getReelStats([today]).then(d => setReels(d[0]?.total ?? 0));
      }
    };
    load();
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') {
        load();
      }
    });
    return () => sub.remove();
  }, [available, settings.reels.enabled]);

  return { notNow, reels, available, protecting, reelsOn: settings.reels.enabled };
}

/** Today at a glance: three numbers, no sentences. Sparkles when you choose "Not now". */
export function TodayWins() {
  const { settings } = useSettings();
  const f = useFocus();
  const { notNow, reels, available, protecting } = useTodayCounts();

  if (!available || (!protecting && !settings.reels.enabled)) {
    return null;
  }
  const focusMin = minutesOnDay(
    f.state.history,
    startOfLocalDay(f.now),
    startOfLocalDayDaysAgo(f.now, -1),
  ).minutes;

  const items: { icon: string; value: number; label: string; key: string }[] = [];
  if (protecting) {
    items.push({ key: 'notnow', icon: '🫧', value: notNow, label: 'Not now' });
  }
  if (settings.reels.enabled) {
    items.push({ key: 'reels', icon: '🎞', value: reels, label: 'reels' });
  }
  items.push({ key: 'focus', icon: '🎯', value: focusMin, label: 'focus min' });

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Today: ${items.map(i => `${i.value} ${i.label}`).join(', ')}`}
    >
      {items.map(i => (
        <View key={i.key} style={styles.bubble}>
          {i.key === 'notnow' ? <Sparkles burstKey={i.value} /> : null}
          <Pop trigger={i.value}>
            <Txt style={styles.icon}>{i.icon}</Txt>
          </Pop>
          <CountUp value={i.value} variant="heading" />
          <Txt variant="caption" color={colors.inkSoft}>
            {i.label}
          </Txt>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  bubble: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  icon: { fontSize: 22, lineHeight: 30, height: 30, textAlign: 'center' },
});
