import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import {
  AnswerHint,
  Button,
  Card,
  CelebratePip,
  Chip,
  FadeIn,
  Pip,
  ProgressBar,
  ProgressRing,
  ScreenContainer,
  SectionHeading,
  Txt,
} from '../../components';
import { useSettings } from '../../state/SettingsContext';
import { colors, fonts, MIN_TOUCH_TARGET, radius } from '../../theme/tokens';
import { formatDuration } from '../../utils/time';
import { useFocus } from './FocusContext';
import { MoveBreak } from './MoveBreak';
import {
  elapsedMs,
  growthFor,
  Reflection,
  remainingMs,
  totalMinutes,
} from './focusModel';

const BASE_PRESETS = [15, 25, 45];

function clock(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function SproutProgress({ extraMin = 0 }: { extraMin?: number }) {
  const { state } = useFocus();
  const g = growthFor(totalMinutes(state.history) + extraMin);
  return (
    <View style={styles.sprout}>
      <View style={styles.sproutHead}>
        <Txt variant="bodyBold">Pip's sprout: {g.stage}</Txt>
        {g.minutesToNext !== null ? (
          <Txt variant="caption">
            {g.minutesToNext} min to {g.nextStage}
          </Txt>
        ) : (
          <Txt variant="caption">Fully grown</Txt>
        )}
      </View>
      <ProgressBar value={g.stageProgress} />
    </View>
  );
}

function Setup() {
  const { settings } = useSettings();
  const f = useFocus();
  const defaultMinutes = settings.focusMinutes;
  const [minutes, setMinutes] = useState(defaultMinutes);
  const [intention, setIntention] = useState('');
  const [moving, setMoving] = useState(false);
  useEffect(() => setMinutes(defaultMinutes), [defaultMinutes]);

  const presets = BASE_PRESETS.includes(defaultMinutes)
    ? BASE_PRESETS
    : [...BASE_PRESETS, defaultMinutes].sort((a, b) => a - b);
  const g = growthFor(totalMinutes(f.state.history));

  return (
    <ScreenContainer>
      <SectionHeading
        kicker="Focus"
        title="One thing at a time."
        subtitle="Give your attention to something that matters."
      />
      <FadeIn delay={80} style={styles.ringWrap}>
        <View accessible accessibilityRole="timer">
          <ProgressRing size={260} progress={0}>
            <Txt variant="display" style={styles.time}>
              {clock(minutes * 60_000)}
            </Txt>
            <Txt variant="label">Ready</Txt>
          </ProgressRing>
        </View>
      </FadeIn>

      <Card tone="butter" style={styles.pipRow}>
        <Pip size={76} mood="happy" growth={g.value} bob={false} />
        <Txt color={colors.ink} style={styles.flex}>
          {g.minutesToNext !== null
            ? `Ready when you are. ${Math.min(
                minutes,
                g.minutesToNext,
              )} of the ${g.minutesToNext} minutes I need to reach ${
                g.nextStage
              }!`
            : "Ready when you are. I'm fully grown, but I still love focusing with you."}
        </Txt>
      </Card>

      <AnswerHint kind="one" />
      <View style={styles.row}>
        {presets.map(m => (
          <Chip
            key={m}
            role="radio"
            label={`${m} min`}
            selected={minutes === m}
            onPress={() => setMinutes(m)}
          />
        ))}
      </View>

      <Txt variant="label" color={colors.inkSoft}>
        My intention (optional)
      </Txt>
      <TextInput
        value={intention}
        onChangeText={setIntention}
        placeholder="What will you work on?"
        placeholderTextColor={colors.inkFaint}
        accessibilityLabel="Intention for this session"
        maxLength={140}
        style={styles.input}
      />
      <Button
        label="Start session"
        onPress={() => f.start(minutes, intention)}
      />
      <Button
        label="🏃 Move for 5 min first"
        variant="secondary"
        onPress={() => setMoving(true)}
      />
      <Txt variant="caption" center>Moving first gives attention a short boost.</Txt>
      <MoveBreak
        visible={moving}
        onSkip={() => {
          setMoving(false);
          f.start(minutes, intention);
        }}
        onDone={() => {
          setMoving(false);
          f.start(minutes, intention);
        }}
      />
      <Txt variant="caption" center>Keeps time even if you lock your phone.</Txt>
    </ScreenContainer>
  );
}

function Running() {
  const f = useFocus();
  const a = f.state.active!;
  const [confirmEnd, setConfirmEnd] = useState(false);
  const left = remainingMs(a, f.now);
  const done = elapsedMs(a, f.now);
  const running = a.status === 'running';
  const g = growthFor(
    totalMinutes(f.state.history) + Math.floor(done / 60_000),
  );

  return (
    <ScreenContainer>
      <SectionHeading
        kicker={running ? 'In focus' : 'Paused'}
        title={a.intention ? a.intention : 'One thing at a time.'}
      />
      <View style={styles.ringWrap}>
        <View
          accessible
          accessibilityRole="timer"
          accessibilityLabel={`${formatDuration(left)} left`}
        >
          <ProgressRing size={260} progress={done / a.plannedMs}>
            <Txt variant="display" style={styles.time}>
              {clock(left)}
            </Txt>
            <Txt variant="label" color={running ? colors.leaf : colors.orange}>
              {running ? 'In focus' : 'Paused'}
            </Txt>
          </ProgressRing>
        </View>
      </View>

      <Card tone={running ? 'leaf' : 'sand'} style={styles.pipRow}>
        <Pip
          size={76}
          mood={running ? 'calm' : 'think'}
          growth={g.value}
          bob={running}
        />
        <Txt color={colors.ink} style={styles.flex}>
          {running
            ? "Shh… I'm growing quietly while you focus."
            : 'Take the break you need. I’ll be right here.'}
        </Txt>
      </Card>
      <SproutProgress extraMin={Math.floor(done / 60_000)} />

      {running ? (
        <Button label="Pause" variant="secondary" onPress={f.pause} />
      ) : (
        <Button label="Resume" onPress={f.resume} />
      )}

      {confirmEnd ? (
        <Card tone="sand">
          <Txt variant="bodyBold">
            End now?{' '}
            {done >= 60_000
              ? `${formatDuration(done)} will be saved.`
              : 'Under a minute, so nothing will be saved.'}
          </Txt>
          <Button label="Yes, end session" onPress={f.endEarly} />
          <Button
            label="Keep going"
            variant="ghost"
            onPress={() => setConfirmEnd(false)}
          />
        </Card>
      ) : (
        <Button
          label="End early"
          variant="ghost"
          onPress={() => setConfirmEnd(true)}
        />
      )}
    </ScreenContainer>
  );
}

const PROGRESS: { id: Reflection['progress']; label: string }[] = [
  { id: 'yes', label: 'Yes, I made progress' },
  { id: 'some', label: 'Some progress' },
  { id: 'no', label: 'Not really' },
];
const INTERRUPTIONS: { id: Reflection['interruptions']; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'few', label: 'A few' },
  { id: 'many', label: 'Many' },
];

function Finished() {
  const f = useFocus();
  const info = f.justFinished!;
  const record = f.state.history.find(r => r.id === info.id);
  const [progress, setProgress] = useState<Reflection['progress'] | null>(null);
  const [interruptions, setInterruptions] = useState<
    Reflection['interruptions'] | null
  >(null);
  const [note, setNote] = useState('');

  if (!record) {
    return (
      <ScreenContainer>
        <SectionHeading kicker="Focus" title="That was a quick one." />
        <Txt>Sessions under a minute aren't saved.</Txt>
        <Button label="Okay" onPress={f.dismissFinished} />
      </ScreenContainer>
    );
  }

  const completed = record.status === 'completed';
  const save = () => {
    if (progress && interruptions) {
      f.reflect(record.id, { progress, interruptions, note });
    }
    f.dismissFinished();
  };

  return (
    <ScreenContainer>
      <CelebratePip
        size={150}
        cheer={completed}
        growth={growthFor(totalMinutes(f.state.history)).value}
      />
      <SectionHeading
        kicker={completed ? 'Session complete' : 'Session ended'}
        title={
          completed
            ? `${formatDuration(record.actualMs)} of focus. Lovely.`
            : `${formatDuration(record.actualMs)} still counts.`
        }
        subtitle={
          info.whileAway && completed
            ? 'It finished while you were away. Nothing lost.'
            : completed
            ? undefined
            : 'Coming back is what matters.'
        }
      />
      <SproutProgress />

      <Card>
        <Txt variant="heading">How did it go? (optional)</Txt>
        <Txt variant="bodyBold">Did you make progress?</Txt>
        <AnswerHint kind="one" />
        {PROGRESS.map(p => (
          <Chip
            key={p.id}
            block
            role="radio"
            label={p.label}
            selected={progress === p.id}
            onPress={() => setProgress(p.id)}
          />
        ))}
        <Txt variant="bodyBold">How many interruptions did you notice?</Txt>
        <AnswerHint kind="one" />
        <View style={styles.row}>
          {INTERRUPTIONS.map(p => (
            <Chip
              key={p.id}
              role="radio"
              label={p.label}
              selected={interruptions === p.id}
              onPress={() => setInterruptions(p.id)}
            />
          ))}
        </View>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="What did you get done? (optional)"
          placeholderTextColor={colors.inkFaint}
          accessibilityLabel="Note about this session"
          maxLength={500}
          multiline
          style={[styles.input, styles.note]}
        />
        <Txt variant="caption">Only what you noticed. Nothing is tracked.</Txt>
      </Card>
      <Button
        label={progress && interruptions ? 'Save reflection' : 'Done'}
        onPress={save}
      />
    </ScreenContainer>
  );
}

export function FocusScreen() {
  const f = useFocus();
  if (!f.ready) {
    return (
      <ScreenContainer>
        <SectionHeading kicker="Focus" title="One thing at a time." />
      </ScreenContainer>
    );
  }
  if (f.justFinished) {
    return <Finished />;
  }
  if (f.state.active) {
    return <Running />;
  }
  return <Setup />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center' },
  ringWrap: { alignItems: 'center', marginVertical: 4 },
  time: { fontSize: 54, lineHeight: 62, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pipRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sprout: { gap: 8 },
  sproutHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    minHeight: MIN_TOUCH_TARGET + 8,
    backgroundColor: colors.card,
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
  },
  note: { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' },
});
