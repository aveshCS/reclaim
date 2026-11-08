import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  BreathingPause,
  Button,
  Card,
  ErrorState,
  FadeIn,
  LoadingState,
  Pip,
  ScreenContainer,
  Txt,
} from '../../components';
import type { RootTabParamList } from '../../navigation/types';
import { useSettings } from '../../state/SettingsContext';
import { PRIORITIES } from '../../state/settings';
import { colors, radius, spacing, STICKER_OFFSET } from '../../theme/tokens';
import { haptic } from '../../utils/haptics';
import { formatClock, formatDuration, localDateKey } from '../../utils/time';
import { DashboardData, useDashboard } from '../dashboard/useDashboard';
import { WeekBars } from '../dashboard/WeekBars';
import { PipCompanion } from './PipCompanion';
import { TodayWins } from './TodayWins';
import { ResetScreen } from '../reset/ResetScreen';
import { resetStatus } from '../reset/resetModel';
import { RESET_DAYS } from '../../state/settings';
import { useGym } from '../gym/GymContext';
import { workoutFor } from '../gym/gymModel';

function greeting(date: Date): string {
  const h = date.getHours();
  if (h < 5) {
    return 'Still up';
  }
  if (h < 12) {
    return 'Good morning';
  }
  if (h < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

type Nav = BottomTabNavigationProp<RootTabParamList, 'Home'>;

function Tile({
  title,
  body,
  icon,
  tone,
  onPress,
  label,
}: {
  title: string;
  body: string;
  icon: string;
  tone: string;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [styles.tileOuter, pressed && styles.pressed]}
    >
      <View style={styles.tileShadow} />
      <View style={[styles.tile, { backgroundColor: tone }]}>
        <Txt style={styles.tileIcon} importantForAccessibility="no">
          {icon}
        </Txt>
        <Txt variant="heading">{title}</Txt>
        <Txt variant="caption" color={colors.inkSoft}>
          {body}
        </Txt>
      </View>
    </Pressable>
  );
}

function TodayCard({
  data,
  onRefresh,
  onPause,
}: {
  data: DashboardData;
  onRefresh: () => void;
  onPause: () => void;
}) {
  const b = data.baseline;
  return (
    <Card tone="butter">
      <Txt variant="label">Today in your chosen apps</Txt>
      <Txt
        variant="display"
        style={styles.big}
        accessibilityLabel={`${formatDuration(data.todayMs)} today`}
      >
        {formatDuration(data.todayMs)}
      </Txt>
      <Txt variant="caption">Updated {formatClock(data.updatedAt)}</Txt>
      {b.kind === 'ready' ? (
        <Txt color={colors.ink}>
          Your usual day: {formatDuration(b.avgMs)}
        </Txt>
      ) : (
        <Txt color={colors.ink}>
          Building your baseline: {b.completeDays} of {b.needed} days.
        </Txt>
      )}
      {data.todayPartial ? (
        <Txt variant="caption">Android's history starts part-way through today.</Txt>
      ) : null}

      <WeekBars
        bars={data.week}
        baselineMs={b.kind === 'ready' ? b.avgMs : null}
      />

      {data.perApp.slice(0, 3).map(a => (
        <View
          key={a.packageName}
          style={styles.appRow}
          accessible
          accessibilityLabel={`${a.label}: ${formatDuration(
            a.ms,
          )} today, opened ${a.opens} times`}
        >
          <Txt variant="bodyBold" style={styles.flex}>
            {a.label}
          </Txt>
          <Txt variant="caption">{a.opens}× opened</Txt>
          <Txt variant="bodyBold">{formatDuration(a.ms)}</Txt>
        </View>
      ))}

      <Txt variant="caption">Android's estimate: time, not how you felt.</Txt>
      <Button label="Refresh" variant="secondary" onPress={onRefresh} />
      <Button label="Pause app time" variant="ghost" onPress={onPause} />
    </Card>
  );
}

function SuggestionCard({
  data,
  onBreathe,
  onFocus,
}: {
  data: DashboardData;
  onBreathe: () => void;
  onFocus: () => void;
}) {
  const [why, setWhy] = useState(false);
  const s = data.suggestion;
  if (!s) {
    return null;
  }
  return (
    <Card tone={s.id === 'under-usual' ? 'leaf' : 'sky'}>
      <View style={styles.pipRow}>
        <Pip
          size={70}
          mood={s.id === 'under-usual' ? 'cheer' : 'think'}
          bob={false}
        />
        <View style={styles.flex}>
          <Txt variant="label" color={colors.ink}>
            From Pip
          </Txt>
          <Txt variant="heading">{s.title}</Txt>
        </View>
      </View>
      <Txt color={colors.ink}>{s.body}</Txt>
      {s.action === 'breathe' ? (
        <Button
          label="Take one breath"
          variant="secondary"
          onPress={onBreathe}
        />
      ) : null}
      {s.action === 'focus' ? (
        <Button
          label="Start a focus session"
          variant="secondary"
          onPress={onFocus}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Why am I seeing this?"
        accessibilityState={{ expanded: why }}
        onPress={() => setWhy(w => !w)}
        hitSlop={8}
      >
        <Txt variant="caption" style={styles.link}>
          Why am I seeing this?
        </Txt>
      </Pressable>
      {why ? <Txt variant="caption">{s.why}</Txt> : null}
    </Card>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const s = useSettings();
  const { settings } = s;
  const [pauseOpen, setPauseOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setVisible(true);
      return () => setVisible(false);
    }, []),
  );
  const { state, refresh } = useDashboard(visible);

  const name = settings.profile.name.trim();
  const wants = PRIORITIES.filter(p => settings.priorities.includes(p.id)).map(
    p => p.label.toLowerCase(),
  );
  const gym = useGym();
  const workout = workoutFor(gym.state, localDateKey(Date.now()));
  const practicedToday =
    !!workout.completedAt ||
    settings.practice.lastCompletedDate === localDateKey(Date.now());

  let appTime: React.ReactNode = null;
  switch (state.kind) {
    case 'ready':
      appTime = (
        <View style={styles.stack}>
          <TodayCard
            data={state.data}
            onRefresh={refresh}
            onPause={() => s.setMonitoringPaused(true)}
          />
          <SuggestionCard
            data={state.data}
            onBreathe={() => setPauseOpen(true)}
            onFocus={() => navigation.navigate('Focus')}
          />
        </View>
      );
      break;
    case 'loading':
    case 'checking':
      appTime = (
        <Card>
          <LoadingState label="Reading today's app time" />
        </Card>
      );
      break;
    case 'error':
      appTime = <ErrorState message={state.message} onRetry={refresh} />;
      break;
    case 'paused':
      appTime = (
        <Card tone="sand">
          <Txt variant="label">App time</Txt>
          <Txt variant="heading">Paused</Txt>
          <Txt>Nothing is being read while app time is paused.</Txt>
          <Button
            label="Resume app time"
            variant="secondary"
            onPress={() => s.setMonitoringPaused(false)}
          />
        </Card>
      );
      break;
    case 'needsPermission':
    case 'needsApps':
      appTime = (
        <Card tone="orange">
          <Txt variant="label" color={colors.ink}>
            Almost there
          </Txt>
          <Txt variant="heading">Finish setting up app time</Txt>
          <Txt color={colors.ink}>
            {state.kind === 'needsPermission'
              ? 'Allow Usage Access so I can show time in the apps you choose.'
              : 'Choose which apps you want to see.'}
          </Txt>
          <Button
            label="Continue setup"
            variant="secondary"
            onPress={() => navigation.navigate('Insights')}
          />
        </Card>
      );
      break;
    case 'off':
    case 'unavailable':
      appTime = null;
      break;
  }

  return (
    <ScreenContainer>
      <FadeIn>
        <Txt variant="label">reclaim</Txt>
        <Txt variant="display">
          {greeting(new Date())}
          {name ? `, ${name}` : ''}.
        </Txt>
      </FadeIn>

      <FadeIn delay={100}>
        <PipCompanion
          workoutDone={!!workout.completedAt}
          onWorkout={() => navigation.navigate('Train')}
          name={name}
          defaultMinutes={settings.focusMinutes}
          onFocus={() => navigation.navigate('Focus')}
        />
      </FadeIn>

      <TodayWins />

      <FadeIn delay={130}>
        {(() => {
          const rs = resetStatus(settings.reset, localDateKey(Date.now()));
          const title =
            rs.kind === 'none'
              ? 'The Reset: 14 days to get your attention back'
              : rs.kind === 'needsBaseline'
              ? 'Reset: take your day-1 attention check'
              : rs.kind === 'active'
              ? `Reset: day ${rs.day} of ${RESET_DAYS}`
              : rs.kind === 'needsFinal'
              ? 'Reset: take your final attention check'
              : 'Reset complete: see your change';
          return (
            <Card tone="orange">
              <Txt variant="label" color={colors.ink}>
                Backed by a 2025 study
              </Txt>
              <Txt variant="heading">{title}</Txt>
              <Button
                label={rs.kind === 'none' ? 'Learn more' : 'Open the Reset'}
                variant="secondary"
                onPress={() => setResetOpen(true)}
              />
            </Card>
          );
        })()}
      </FadeIn>

      {appTime ? <FadeIn delay={150}>{appTime}</FadeIn> : null}

      <FadeIn delay={200} style={styles.tiles}>
        <Tile
          title="Focus"
          body="Start a session"
          icon="⏳"
          tone={colors.orangeSoft}
          label="Start a focus session"
          onPress={() => navigation.navigate('Focus')}
        />
        <Tile
          title="Think"
          body={
            practicedToday
              ? 'Workout done ✓'
              : workout.done.length
              ? `Workout ${workout.done.length}/${workout.plan.length}`
              : "Today's 4-min workout"
          }
          icon="🧩"
          tone={colors.leafSoft}
          label={
            practicedToday
              ? "Today's practice is done. Open the attention gym"
              : "Open today's attention workout"
          }
          onPress={() => navigation.navigate('Train')}
        />
      </FadeIn>

      <FadeIn delay={260}>
        <Tile
          title="Breathe"
          body="One slow minute with Pip"
          icon="🫧"
          tone={colors.skySoft}
          label="Take a one minute breathing pause"
          onPress={() => setPauseOpen(true)}
        />
      </FadeIn>

      {state.kind === 'off' ? (
        <FadeIn delay={300}>
          <Card>
            <Txt variant="label">Optional</Txt>
            <Txt variant="bodyBold">
              Want to see time in the apps you choose?
            </Txt>
            <Button
              label="Set up app time"
              variant="secondary"
              onPress={() => navigation.navigate('Insights')}
            />
          </Card>
        </FadeIn>
      ) : null}

      {wants.length ? (
        <FadeIn delay={340}>
          <Card>
            <Txt variant="label">Why you're here</Txt>
            <Txt variant="bodyBold">
              More time for {wants.slice(0, 3).join(', ')}.
            </Txt>
          </Card>
        </FadeIn>
      ) : null}

      <BreathingPause visible={pauseOpen} onClose={() => setPauseOpen(false)} />
      <ResetScreen visible={resetOpen} onClose={() => setResetOpen(false)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: 8, paddingVertical: 22 },
  full: { alignSelf: 'stretch', marginTop: 8 },
  big: { fontSize: 44, lineHeight: 52 },
  pipRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  link: { textDecorationLine: 'underline', color: colors.inkSoft },
  tiles: { flexDirection: 'row', gap: 12 },
  stack: { gap: spacing.lg },
  tileOuter: {
    flex: 1,
    paddingRight: STICKER_OFFSET,
    paddingBottom: STICKER_OFFSET,
  },
  tileShadow: {
    position: 'absolute',
    top: STICKER_OFFSET,
    left: STICKER_OFFSET,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
  },
  tile: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.line,
    padding: 16,
    gap: 4,
    minHeight: 120,
  },
  tileIcon: { fontSize: 30, lineHeight: 38, marginBottom: 4 },
  pressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },
});
