import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  FadeIn,
  LoadingState,
  Pip,
  ProgressBar,
  ScreenContainer,
  SectionHeading,
  Txt,
} from '../../components';
import { colors, radius } from '../../theme/tokens';
import { haptic } from '../../utils/haptics';
import {
  localDateKey,
  startOfLocalDayDaysAgo,
  weekdayShort,
} from '../../utils/time';
import { SKILL_LABELS, ReasoningSkill } from '../gym/content/reasoning';
import {
  DrillResult,
  NamesDrill,
  ReadDrill,
  ReasonDrill,
  RememberDrill,
  SteadyDrill,
} from '../gym/drills/Drills';
import { Garden } from '../gym/Garden';
import { useGym } from '../gym/GymContext';
import {
  DrillKind,
  DRILLS,
  drillStats,
  garden,
  GymState,
  namesLevel,
  nextDrill,
  pickPassage,
  pickReasoning,
  skillAccuracy,
  weekRhythm,
  workoutFor,
} from '../gym/gymModel';

type Mode =
  | { kind: 'hub' }
  | { kind: 'workout' }
  | { kind: 'practice'; drill: DrillKind; seed: string }
  | { kind: 'celebrate' };

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Renders one drill with content chosen for this seed. */
function DrillHost({
  drill,
  seed,
  state,
  onDone,
}: {
  drill: DrillKind;
  seed: string;
  state: GymState;
  onDone: (r: DrillResult) => void;
}) {
  // Pick content once per drill start, so it doesn't change while answering.
  const picked = useMemo(
    () => ({
      reasonId: pickReasoning(state, seed).id,
      passageId: pickPassage(state, seed).id,
      size: namesLevel(state),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drill, seed],
  );
  switch (drill) {
    case 'reason':
      return (
        <ReasonDrill seed={seed} itemId={picked.reasonId} onDone={onDone} />
      );
    case 'read':
      return (
        <ReadDrill seed={seed} passageId={picked.passageId} onDone={onDone} />
      );
    case 'names':
      return <NamesDrill seed={seed} size={picked.size} onDone={onDone} />;
    case 'remember':
      return <RememberDrill seed={seed} onDone={onDone} />;
    case 'steady':
      return <SteadyDrill seed={seed} onDone={onDone} />;
  }
}

function DrillHeader({
  drill,
  step,
  of,
  onExit,
}: {
  drill: DrillKind;
  step?: number;
  of?: number;
  onExit: () => void;
}) {
  const d = DRILLS[drill];
  return (
    <View style={styles.gap}>
      <View style={styles.rowBetween}>
        <Txt variant="label">
          {step ? `Today's workout · ${step} of ${of}` : 'Free practice'}
        </Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave drill"
          onPress={onExit}
          hitSlop={10}
        >
          <Txt variant="bodyBold" color={colors.inkSoft}>
            ✕ Leave
          </Txt>
        </Pressable>
      </View>
      {step && of ? <ProgressBar value={(step - 1) / of} /> : null}
      <Txt variant="title">
        {d.icon} {d.title}
      </Txt>
      <Txt variant="caption">Trains: {d.trains}</Txt>
    </View>
  );
}

function lastSevenDays(now: number): string[] {
  return [6, 5, 4, 3, 2, 1, 0].map(d =>
    localDateKey(startOfLocalDayDaysAgo(now, d)),
  );
}

export function TrainScreen() {
  const gym = useGym();
  const [mode, setMode] = useState<Mode>({ kind: 'hub' });
  const [toast, setToast] = useState<string | null>(null);

  if (!gym.ready) {
    return (
      <ScreenContainer>
        <LoadingState label="Opening the gym" />
      </ScreenContainer>
    );
  }

  const today = gym.today;
  const w = workoutFor(gym.state, today);
  const next = nextDrill(w);
  const flowers = garden(gym.state);

  // ------------------------------------------------ Workout runner
  if (mode.kind === 'workout' && next) {
    const step = w.done.length + 1;
    return (
      <ScreenContainer>
        <DrillHeader
          drill={next}
          step={step}
          of={w.plan.length}
          onExit={() => setMode({ kind: 'hub' })}
        />
        <DrillHost
          key={`${today}:${next}`}
          drill={next}
          seed={`${today}:${next}`}
          state={gym.state}
          onDone={r => {
            gym.record(r, true);
            const finishing = w.plan.every(
              d => d === next || w.done.includes(d),
            );
            if (finishing) {
              haptic.success();
              setMode({ kind: 'celebrate' });
            }
          }}
        />
      </ScreenContainer>
    );
  }

  // ------------------------------------------------ Celebration
  if (mode.kind === 'celebrate' || (mode.kind === 'workout' && !next)) {
    const todays = gym.state.attempts.filter(
      a => a.date === today && w.plan.includes(a.drill),
    );
    return (
      <ScreenContainer>
        <FadeIn style={styles.center}>
          <Pip size={170} mood="cheer" growth={0.4} />
        </FadeIn>
        <SectionHeading
          kicker="Workout complete"
          title="A new flower for Pip's garden!"
          subtitle="That's today's workout. Go enjoy your day, and come back tomorrow for a new mix."
        />
        <Card tone="leaf">
          <Garden flowers={flowers} />
          <Txt variant="caption">
            {flowers.length} flower{flowers.length === 1 ? '' : 's'} so far.
            They never wilt.
          </Txt>
        </Card>
        <Card>
          <Txt variant="label">Today's results</Txt>
          {w.plan.map(d => {
            const a = [...todays].reverse().find(x => x.drill === d);
            return (
              <View key={d} style={styles.rowBetween}>
                <Txt variant="bodyBold">
                  {DRILLS[d].icon} {DRILLS[d].title}
                </Txt>
                <Txt variant="bodyBold">{a ? pct(a.score) : '—'}</Txt>
              </View>
            );
          })}
        </Card>
        <Button
          label="Back to the gym"
          onPress={() => setMode({ kind: 'hub' })}
        />
      </ScreenContainer>
    );
  }

  // ------------------------------------------------ Free practice
  if (mode.kind === 'practice') {
    return (
      <ScreenContainer>
        <DrillHeader
          drill={mode.drill}
          onExit={() => setMode({ kind: 'hub' })}
        />
        <DrillHost
          key={mode.seed}
          drill={mode.drill}
          seed={mode.seed}
          state={gym.state}
          onDone={r => {
            gym.record(r, false);
            setToast(`${DRILLS[mode.drill].title}: ${pct(r.score)} saved`);
            setMode({ kind: 'hub' });
          }}
        />
      </ScreenContainer>
    );
  }

  // ------------------------------------------------ Hub
  const days = lastSevenDays(Date.now());
  const rhythm = weekRhythm(gym.state, days);
  const acc = skillAccuracy(gym.state);
  const done = !!w.completedAt;

  return (
    <ScreenContainer>
      <SectionHeading
        kicker="Attention gym"
        title="Rebuild your attention."
        subtitle="Focus, memory and reasoning, a few minutes a day."
      />

      {toast ? (
        <Card tone="leaf" flat>
          <Txt variant="bodyBold">{toast}</Txt>
        </Card>
      ) : null}

      <FadeIn>
        <Card tone="butter">
          <View style={styles.pipRow}>
            <Pip size={84} mood={done ? 'cheer' : 'happy'} bob={!done} />
            <View style={styles.flex}>
              <Txt variant="label" color={colors.ink}>
                Today's workout · about 4 min
              </Txt>
              <Txt variant="heading">
                {done
                  ? 'Done for today! 🌸'
                  : w.done.length
                  ? `${w.done.length} of ${w.plan.length} done. Keep going?`
                  : 'Three short drills. Ready?'}
              </Txt>
            </View>
          </View>
          {w.plan.map(d => (
            <View key={d} style={styles.planRow}>
              <View
                style={[styles.check, w.done.includes(d) && styles.checkOn]}
              >
                {w.done.includes(d) ? <Txt variant="bodyBold">✓</Txt> : null}
              </View>
              <Txt variant="bodyBold" style={styles.flex}>
                {DRILLS[d].icon} {DRILLS[d].title}
              </Txt>
              <Txt variant="caption">{DRILLS[d].trains}</Txt>
            </View>
          ))}
          {done ? (
            <Txt color={colors.ink}>
              Come back tomorrow for a new mix. Extra practice is below if you
              want it.
            </Txt>
          ) : (
            <Button
              label={w.done.length ? 'Continue workout' : 'Start workout'}
              onPress={() => setMode({ kind: 'workout' })}
            />
          )}
        </Card>
      </FadeIn>

      <Card>
        <View style={styles.rowBetween}>
          <Txt variant="label">This week</Txt>
          <Txt variant="caption">{rhythm.filter(Boolean).length} of 7 days</Txt>
        </View>
        <View style={styles.week}>
          {days.map((d, i) => (
            <View
              key={d}
              style={styles.dayCol}
              accessible
              accessibilityLabel={`${i === 6 ? 'Today' : weekdayShort(d)}: ${
                rhythm[i] ? 'workout done' : 'no workout'
              }`}
            >
              <View style={[styles.dot, rhythm[i] && styles.dotOn]}>
                {rhythm[i] ? <Txt>🌸</Txt> : null}
              </View>
              <Txt variant="caption" style={styles.dayLabel}>
                {i === 6 ? 'Today' : weekdayShort(d)}
              </Txt>
            </View>
          ))}
        </View>
        <Txt variant="caption">
          No streaks to lose. Every day you show up simply adds a flower.
        </Txt>
      </Card>

      <Card tone="leaf">
        <Txt variant="label" color={colors.leaf}>
          Pip's garden · {flowers.length} flower
          {flowers.length === 1 ? '' : 's'}
        </Txt>
        <Garden flowers={flowers} />
      </Card>

      <Card>
        <Txt variant="label">Your progress</Txt>
        {(Object.keys(DRILLS) as DrillKind[]).map(d => {
          const s = drillStats(gym.state, d);
          return (
            <View key={d} style={styles.statRow}>
              <Txt variant="bodyBold" style={styles.flex}>
                {DRILLS[d].icon} {DRILLS[d].trains}
              </Txt>
              <Txt variant="caption">
                {s.attempts === 0
                  ? 'Not tried yet'
                  : s.attempts >= 6
                  ? `${pct(s.first!)} → ${pct(s.recent!)}`
                  : `Best ${pct(s.best!)} · ${s.attempts} tr${
                      s.attempts === 1 ? 'y' : 'ies'
                    }`}
              </Txt>
            </View>
          );
        })}
        {Object.keys(acc).length ? (
          <>
            <Txt variant="label" style={styles.topGap}>
              Reasoning skills
            </Txt>
            {(Object.keys(acc) as ReasoningSkill[]).map(k => (
              <View key={k} style={styles.statRow}>
                <Txt style={styles.flex}>{SKILL_LABELS[k]}</Txt>
                <Txt variant="caption">
                  {acc[k]!.correct} of {acc[k]!.total}
                </Txt>
              </View>
            ))}
          </>
        ) : null}
        <Txt variant="caption">
          After 6 tries, you'll see your first 5 vs your latest 5. Progress is
          against yourself only.
        </Txt>
      </Card>

      <Txt variant="label" color={colors.inkSoft}>
        Free practice
      </Txt>
      {(Object.keys(DRILLS) as DrillKind[]).map(d => (
        <Pressable
          key={d}
          accessibilityRole="button"
          accessibilityLabel={`Practise ${DRILLS[d].title}`}
          onPress={() => {
            haptic.tap();
            setToast(null);
            setMode({ kind: 'practice', drill: d, seed: String(Date.now()) });
          }}
          style={({ pressed }) => [styles.practice, pressed && styles.pressed]}
        >
          <Txt style={styles.practiceIcon}>{DRILLS[d].icon}</Txt>
          <View style={styles.flex}>
            <Txt variant="bodyBold">{DRILLS[d].title}</Txt>
            <Txt variant="caption">
              {DRILLS[d].trains} · ~{DRILLS[d].minutes} min
            </Txt>
          </View>
          <Txt variant="title">›</Txt>
        </Pressable>
      ))}

      <Txt variant="caption" center>
        Practice for learning, not a clinical test. RECLAIM never gives an IQ
        score or a diagnosis.
      </Txt>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 8 },
  center: { alignItems: 'center' },
  topGap: { marginTop: 8 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  pipRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.leafSoft },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 4, flex: 1 },
  dot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.inkFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOn: {
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: colors.leafSoft,
  },
  dayLabel: { fontSize: 11 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  practice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
    padding: 14,
  },
  practiceIcon: { fontSize: 28, lineHeight: 34 },
  pressed: { transform: [{ scale: 0.98 }] },
});
