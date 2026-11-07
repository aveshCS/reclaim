import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import {
  AnswerHint,
  Button,
  Card,
  Chip,
  Pip,
  ScreenContainer,
  Txt,
} from '../../components';
import { useSettings } from '../../state/SettingsContext';
import { RESET_DAYS } from '../../state/settings';
import { colors, radius } from '../../theme/tokens';
import { localDateKey } from '../../utils/time';
import { DrillResult, SteadyDrill } from '../gym/drills/Drills';
import { useGym } from '../gym/GymContext';
import { PauseSetup } from '../pause/PauseSetup';
import { PlanEditor } from './PlanEditor';
import {
  DAILY_TIPS,
  resetCalendar,
  resetResult,
  resetStatus,
} from './resetModel';

const pct = (x: number) => `${Math.round(x * 100)}%`;

function AttentionCheck({
  which,
  onDone,
}: {
  which: 'baseline' | 'final';
  onDone: (score: number) => void;
}) {
  const gym = useGym();
  return (
    <View style={styles.gap}>
      <Txt variant="label">
        {which === 'baseline'
          ? 'Day 1 · attention check'
          : 'Day 14 · attention check'}
      </Txt>
      <Txt variant="title">How steady is your attention?</Txt>
      <Txt>
        A 40-second focus task, similar in spirit to the one researchers used.
        {which === 'baseline'
          ? ' You will do it again on day 14 to see your own change.'
          : ' Same task as day 1. Let’s see your change.'}
      </Txt>
      <SteadyDrill
        seed={`reset-${which}-${Date.now()}`}
        onDone={(r: DrillResult) => {
          gym.record({ ...r, detail: { ...r.detail, reset: which } }, false);
          onDone(r.score);
        }}
      />
    </View>
  );
}

function Start({ onStarted }: { onStarted: () => void }) {
  const s = useSettings();
  const [limit, setLimit] = useState(30);
  const [step, setStep] = useState<'why' | 'limit' | 'plan'>('why');

  if (step === 'why') {
    return (
      <View style={styles.gap}>
        <View style={styles.center}>
          <Pip size={140} mood="happy" />
        </View>
        <Txt variant="label">The Reset</Txt>
        <Txt variant="title">14 days to get your attention back</Txt>
        <Card tone="sky">
          <Txt variant="bodyBold">Why 14 days?</Txt>
          <Txt color={colors.ink}>
            In a 2025 study of 467 adults, cutting mobile internet for two weeks
            improved sustained attention, mood and well-being. Most people found
            it hard to stick to fully, so the Reset is gentler: a daily limit
            for the apps you choose, plus small habits.
          </Txt>
        </Card>
        <Card>
          <Txt variant="bodyBold">What you'll do</Txt>
          <Txt>• A 40-second attention check on day 1 and day 14</Txt>
          <Txt>• Keep your chosen apps under a daily limit</Txt>
          <Txt>• One small habit tip each day</Txt>
          <Txt>• Optional: a breathing pause before scroll apps</Txt>
        </Card>
        <Txt variant="caption">
          Results vary. This is a practice, not a treatment.
        </Txt>
        <Button label="I'm in" onPress={() => setStep('limit')} />
      </View>
    );
  }

  if (step === 'limit') {
    return (
      <View style={styles.gap}>
        <Txt variant="title">Your daily limit</Txt>
        <Txt>
          For your scroll apps together. Pick something you can actually keep.
        </Txt>
        <AnswerHint kind="one" />
        <View style={styles.chips}>
          {[15, 30, 45, 60, 90].map(m => (
            <Chip
              key={m}
              role="radio"
              label={`${m} min a day`}
              selected={limit === m}
              onPress={() => setLimit(m)}
            />
          ))}
        </View>
        <Button label="Continue" onPress={() => setStep('plan')} />
      </View>
    );
  }

  return (
    <View style={styles.gap}>
      <Txt variant="title">Make a plan for the urge</Txt>
      <Txt>
        People who decide in advance what they'll do in a tricky moment follow
        through more often. Your plan also appears on the pause screen.
      </Txt>
      <PlanEditor
        initial={s.settings.plan}
        saveLabel="Start my Reset"
        onSave={p => {
          s.setPlan(p);
          s.startReset(localDateKey(Date.now()), limit);
          onStarted();
        }}
      />
      <Button
        label="Skip the plan and start"
        variant="ghost"
        onPress={() => {
          s.startReset(localDateKey(Date.now()), limit);
          onStarted();
        }}
      />
    </View>
  );
}

function Daily() {
  const s = useSettings();
  const r = s.settings.reset!;
  const today = localDateKey(Date.now());
  const st = resetStatus(r, today);
  const cal = resetCalendar(r, today);
  const day = st.kind === 'active' ? st.day : RESET_DAYS;
  const keptToday = r.keptDays.includes(today);
  const [confirmQuit, setConfirmQuit] = useState(false);

  return (
    <View style={styles.gap}>
      <Txt variant="label">
        The Reset · day {day} of {RESET_DAYS}
      </Txt>
      <Txt variant="title">
        {st.kind === 'active' ? `${st.daysLeft} days to go` : 'Almost there'}
      </Txt>
      <View style={styles.cal}>
        {cal.map(c => (
          <View
            key={c.date}
            style={[
              styles.calDay,
              c.kept && styles.calKept,
              c.isToday && styles.calToday,
              c.future && styles.calFuture,
            ]}
            accessible
            accessibilityLabel={`Day ${c.day}${c.kept ? ', kept' : ''}${
              c.isToday ? ', today' : ''
            }`}
          >
            <Txt variant="bodyBold">{c.kept ? '🌿' : c.day}</Txt>
          </View>
        ))}
      </View>

      <Card tone="butter">
        <Txt variant="label" color={colors.ink}>
          Today's tip
        </Txt>
        <Txt variant="heading">{DAILY_TIPS[Math.min(day, RESET_DAYS) - 1]}</Txt>
      </Card>

      <Card>
        <Txt variant="bodyBold">
          Did you keep your scroll apps under {r.limitMin} min today?
        </Txt>
        <Txt variant="caption">
          Check Home for today's app time if you set it up. Be honest; missing a
          day changes nothing else.
        </Txt>
        <AnswerHint kind="one" />
        <View style={styles.chips}>
          <Chip
            role="radio"
            label="Yes, I kept it"
            selected={keptToday}
            onPress={() => s.keepResetDay(today, true)}
          />
          <Chip
            role="radio"
            label="Not today"
            selected={!keptToday}
            onPress={() => s.keepResetDay(today, false)}
          />
        </View>
      </Card>

      <PauseSetup />

      {confirmQuit ? (
        <Card tone="sand">
          <Txt variant="bodyBold">
            Stop the Reset? Your progress will be cleared.
          </Txt>
          <Button label="Yes, stop" onPress={s.abandonReset} />
          <Button
            label="Keep going"
            variant="ghost"
            onPress={() => setConfirmQuit(false)}
          />
        </Card>
      ) : (
        <Button
          label="Stop the Reset"
          variant="ghost"
          onPress={() => setConfirmQuit(true)}
        />
      )}
    </View>
  );
}

function Results({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  const res = resetResult(s.settings.reset!);
  const improved = res.changePts !== null && res.changePts > 0;
  return (
    <View style={styles.gap}>
      <View style={styles.center}>
        <Pip size={160} mood="cheer" growth={0.8} />
      </View>
      <Txt variant="label">Reset complete</Txt>
      <Txt variant="title">You did 14 days.</Txt>
      <Card tone={improved ? 'leaf' : 'sky'}>
        <Txt variant="bodyBold">Your attention check</Txt>
        <Txt variant="heading">
          Day 1: {res.before !== null ? pct(res.before) : '—'} → Day 14:{' '}
          {res.after !== null ? pct(res.after) : '—'}
        </Txt>
        <Txt color={colors.ink}>
          {res.changePts === null
            ? 'One of the checks is missing.'
            : improved
            ? `Up ${res.changePts} points. That's your own change, measured the same way.`
            : 'No rise this time. Scores bounce around from day to day; the habits still count.'}
        </Txt>
      </Card>
      <Card>
        <Txt variant="bodyBold">
          You kept your limit on {res.keptDays} of {RESET_DAYS} days.
        </Txt>
      </Card>
      <Txt variant="caption">
        One person's before-and-after can't prove cause, but it is honest
        feedback about you.
      </Txt>
      <Button
        label="Start another Reset"
        variant="secondary"
        onPress={s.abandonReset}
      />
      <Button label="Done" onPress={onClose} />
    </View>
  );
}

/** Full-screen Reset flow. */
export function ResetScreen({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const s = useSettings();
  const today = localDateKey(Date.now());
  const st = resetStatus(s.settings.reset, today);

  let body: React.ReactNode;
  switch (st.kind) {
    case 'none':
      body = <Start onStarted={() => {}} />;
      break;
    case 'needsBaseline':
      body = (
        <AttentionCheck
          which="baseline"
          onDone={score => s.setResetScore('baseline', score)}
        />
      );
      break;
    case 'active':
      body = <Daily />;
      break;
    case 'needsFinal':
      body = (
        <AttentionCheck
          which="final"
          onDone={score => {
            s.setResetScore('final', score);
            s.finishReset();
          }}
        />
      );
      break;
    case 'finished':
      body = <Results onClose={onClose} />;
      break;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScreenContainer key={st.kind}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close the Reset"
          onPress={onClose}
          hitSlop={10}
          style={styles.close}
        >
          <Txt variant="bodyBold" color={colors.inkSoft}>
            ✕ Close
          </Txt>
        </Pressable>
        {body}
      </ScreenContainer>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  center: { alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  close: { alignSelf: 'flex-end' },
  cal: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  calDay: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calKept: { backgroundColor: colors.leafSoft },
  calToday: { borderColor: colors.orange, borderWidth: 3 },
  calFuture: { opacity: 0.4 },
});
