import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Pip, PipMood, ProgressBar, Txt } from '../../components';
import { colors, radius } from '../../theme/tokens';
import { haptic } from '../../utils/haptics';
import { useReducedMotion } from '../../utils/motion';
import {
  formatDuration,
  startOfLocalDay,
  startOfLocalDayDaysAgo,
} from '../../utils/time';
import { useFocus } from '../focus/FocusContext';
import { useSettings } from '../../state/SettingsContext';
import { useTodayCounts } from './TodayWins';
import {
  elapsedMs,
  growthFor,
  minutesOnDay,
  remainingMs,
  totalMinutes,
} from '../focus/focusModel';

/** Friendly things Pip says when tapped. Encouraging, never guilt or pressure. */
export const TAP_LINES = [
  'Hehe, that tickles! 🌱',
  'Every focus minute is sunshine for my leaves.',
  'Even five minutes counts. Small is how big starts.',
  "I'm proud of you for showing up.",
  'Want to grow a little together?',
  "Breathe in… and out. I'm right here.",
];

type Say = { mood: PipMood; line: string };

export function pipSays(input: {
  hour: number;
  running: boolean;
  paused: boolean;
  leftMs: number;
  todayMin: number;
  minutesToNext: number | null;
  nextStage: string | null;
  name: string;
  workoutDone?: boolean;
  /** Times the user chose "Not now" today. */
  notNowToday?: number;
  reelsToday?: number;
  reelLimit?: number;
}): Say {
  const you = input.name ? `, ${input.name}` : '';
  if (input.running) {
    return {
      mood: 'calm',
      line: `Shh… we're focusing. ${formatDuration(input.leftMs)} to go.`,
    };
  }
  if (input.paused) {
    return { mood: 'think', line: 'We paused. Ready to pick it back up?' };
  }
  if (input.hour >= 23 || input.hour < 5) {
    return {
      mood: 'calm',
      line: `It's late${you}. Good sleep is focus practice too. 🌙`,
    };
  }
  const reels = input.reelsToday ?? 0;
  const reelCap = input.reelLimit ? input.reelLimit : 50;
  if (reels >= reelCap) {
    return {
      mood: 'concerned',
      line: `${reels} reels today. My eyes are tired. 5 quiet minutes with me?`,
    };
  }
  const nn = input.notNowToday ?? 0;
  if (nn > 0) {
    return {
      mood: 'cheer',
      line: `${nn}× "Not now" today. That's you, choosing. 🌱`,
    };
  }
  if (input.todayMin > 0) {
    return {
      mood: 'cheer',
      line: `We focused ${input.todayMin} min today! My leaves feel stronger.`,
    };
  }
  if (input.workoutDone === false && input.hour >= 12) {
    return {
      mood: 'happy',
      line: 'A 4-minute workout plants a new flower. 🌸 Shall we?',
    };
  }
  if (input.minutesToNext !== null) {
    return {
      mood: 'happy',
      line:
        input.hour < 12
          ? `Morning${you}! ${input.minutesToNext} focus minutes and I become a ${input.nextStage}.`
          : `${input.minutesToNext} focus minutes and I become a ${input.nextStage}. Grow with me?`,
    };
  }
  return {
    mood: 'happy',
    line: 'Fully grown, thanks to you. Shall we keep going?',
  };
}

/** Pip on the dashboard: reacts to taps, changes with the moment, grows with real focus minutes. */
export function PipCompanion({
  name,
  defaultMinutes,
  onFocus,
  workoutDone,
  onWorkout,
}: {
  name: string;
  defaultMinutes: number;
  onFocus: () => void;
  workoutDone?: boolean;
  onWorkout?: () => void;
}) {
  const f = useFocus();
  const counts = useTodayCounts();
  const { settings } = useSettings();
  const reduced = useReducedMotion();
  const jump = useRef(new Animated.Value(0)).current;
  const [tapLine, setTapLine] = useState<string | null>(null);
  const [tapMood, setTapMood] = useState<PipMood | null>(null);
  const taps = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const a = f.state.active;
  const running = a?.status === 'running';
  const liveMin = a ? Math.floor(elapsedMs(a, f.now) / 60_000) : 0;
  const total = totalMinutes(f.state.history) + liveMin;
  const g = growthFor(total);
  const today = minutesOnDay(
    f.state.history,
    startOfLocalDay(f.now),
    startOfLocalDayDaysAgo(f.now, -1),
  );

  const said = pipSays({
    hour: new Date(f.now).getHours(),
    running: !!running,
    paused: a?.status === 'paused',
    leftMs: a ? remainingMs(a, f.now) : 0,
    todayMin: today.minutes,
    minutesToNext: g.minutesToNext,
    nextStage: g.nextStage,
    name,
    workoutDone,
    notNowToday: counts.notNow,
    reelsToday: counts.reelsOn ? counts.reels : 0,
    reelLimit: settings.reels.limit,
  });

  const onTap = () => {
    haptic.tap();
    const line = TAP_LINES[taps.current % TAP_LINES.length];
    taps.current += 1;
    setTapLine(line);
    setTapMood(taps.current % 2 ? 'wow' : 'cheer');
    if (!reduced) {
      jump.setValue(0);
      Animated.sequence([
        Animated.timing(jump, {
          toValue: -18,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.spring(jump, {
          toValue: 0,
          friction: 3,
          tension: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      setTapLine(null);
      setTapMood(null);
    }, 3500);
  };

  const line = tapLine ?? said.line;
  const mood = tapMood ?? said.mood;

  return (
    <Card tone="butter" style={styles.card}>
      <View style={styles.bubble} accessibilityLiveRegion="polite">
        <Txt variant="bodyBold" color={colors.ink} center>
          {line}
        </Txt>
        <View style={styles.tail} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pip. Tap to say hello"
        onPress={onTap}
        hitSlop={10}
      >
        <Animated.View style={{ transform: [{ translateY: jump }] }}>
          <Pip size={160} mood={mood} growth={g.value} talking={!!tapLine} />
        </Animated.View>
      </Pressable>

      <View style={styles.growth}>
        <View style={styles.growthHead}>
          <Txt variant="label" color={colors.leaf}>
            {g.stage}
          </Txt>
          <Txt variant="caption">
            {g.minutesToNext !== null
              ? `${g.minutesToNext} min to ${g.nextStage}`
              : 'Fully grown'}
          </Txt>
        </View>
        <ProgressBar value={g.stageProgress} />
        <Txt variant="caption">
          Today: {today.minutes} min in focus · {today.completed} session
          {today.completed === 1 ? '' : 's'} completed
        </Txt>
      </View>

      <View style={styles.full}>
        {a ? (
          <Button
            label={running ? 'Back to my session' : 'Resume session'}
            onPress={onFocus}
          />
        ) : (
          <Button
            label={`Grow together · ${defaultMinutes} min`}
            onPress={onFocus}
          />
        )}
        {!a && workoutDone === false && onWorkout ? (
          <Button
            label="🌸 Today's 4-min workout"
            variant="secondary"
            onPress={onWorkout}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  bubble: {
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tail: {
    position: 'absolute',
    bottom: -9,
    left: '50%',
    marginLeft: -8,
    width: 16,
    height: 16,
    backgroundColor: colors.card,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.line,
    transform: [{ rotate: '45deg' }],
  },
  growth: { alignSelf: 'stretch', gap: 6 },
  growthHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  full: { alignSelf: 'stretch', marginTop: 4, gap: 10 },
});
