import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import {
  Button,
  Chip,
  FadeIn,
  Pip,
  ProgressRing,
  ScreenContainer,
  SectionHeading,
  Txt,
} from '../../components';
import { useSettings } from '../../state/SettingsContext';
import { colors, fonts, MIN_TOUCH_TARGET, radius } from '../../theme/tokens';
import { haptic } from '../../utils/haptics';

const BASE_PRESETS = [15, 25, 45];

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// NOTE (Phase 5): this timer is in-memory only. Background-safe, persisted
// sessions are implemented in Phase 5.
export function FocusScreen() {
  const { settings } = useSettings();
  const defaultMinutes = settings.focusMinutes;
  const [minutes, setMinutes] = useState(defaultMinutes);
  const [secondsLeft, setSecondsLeft] = useState(defaultMinutes * 60);
  const [running, setRunning] = useState(false);
  const [intention, setIntention] = useState('');

  // Follow the default length chosen in onboarding/Profile, unless a session is running.
  useEffect(() => {
    if (!running) {
      setMinutes(defaultMinutes);
      setSecondsLeft(defaultMinutes * 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultMinutes]);

  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = setInterval(
      () => setSecondsLeft(s => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (secondsLeft === 0 && running) {
      setRunning(false);
      haptic.success();
    }
  }, [secondsLeft, running]);

  const select = (m: number) => {
    setMinutes(m);
    setSecondsLeft(m * 60);
    setRunning(false);
  };

  const presets = BASE_PRESETS.includes(defaultMinutes)
    ? BASE_PRESETS
    : [...BASE_PRESETS, defaultMinutes].sort((a, b) => a - b);
  const done = secondsLeft === 0;
  const total = minutes * 60;

  return (
    <ScreenContainer>
      <SectionHeading
        kicker="Focus"
        title="One thing at a time."
        subtitle="Give your attention to something that matters."
      />

      <FadeIn delay={100} style={styles.ringWrap}>
        <View accessible accessibilityRole="timer">
          <ProgressRing size={286} progress={1 - secondsLeft / total}>
            {done ? (
              <Pip size={150} mood="cheer" growth={0.4} />
            ) : (
              <>
                <Txt variant="display" style={styles.time}>
                  {formatTime(secondsLeft)}
                </Txt>
                <Txt
                  variant="label"
                  color={running ? colors.leaf : colors.orange}
                >
                  {running ? 'In focus' : 'Ready'}
                </Txt>
              </>
            )}
          </ProgressRing>
        </View>
        {done ? (
          <Txt variant="heading" center>
            Done! That was {minutes} minutes of your attention, given on
            purpose.
          </Txt>
        ) : null}
      </FadeIn>

      <View style={styles.row}>
        {presets.map(m => (
          <Chip
            key={m}
            role="radio"
            label={`${m} min`}
            selected={minutes === m}
            onPress={() => select(m)}
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
        style={styles.input}
      />

      <Button
        label={
          running
            ? 'Pause session'
            : done
            ? 'Session complete'
            : 'Start session'
        }
        disabled={done}
        onPress={() => setRunning(v => !v)}
      />
      <Button
        label={done ? 'Start again' : 'Reset timer'}
        variant="ghost"
        onPress={() => {
          setRunning(false);
          setSecondsLeft(minutes * 60);
        }}
      />
      <Txt variant="caption" center>
        This timer only runs while the app is open. Sessions are not saved yet.
      </Txt>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  ringWrap: { alignItems: 'center', gap: 14, marginVertical: 4 },
  time: { fontSize: 58, lineHeight: 66, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
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
});
