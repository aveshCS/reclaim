import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  AnswerHint,
  Button,
  Card,
  Chip,
  CountUp,
  FadeIn,
  GuideChat,
  HoldToCommit,
  Pip,
  PipMood,
  ProgressBar,
  ScreenContainer,
  Txt,
} from '../../components';
import { useSettings } from '../../state/SettingsContext';
import {
  AGE_BANDS,
  EXAMS,
  LONG_PREP_EXAMS,
  OnboardingStep,
  PRIORITIES,
  ROLES,
  STRUGGLES,
  visibleSteps,
} from '../../state/settings';
import { colors, fonts, MIN_TOUCH_TARGET, radius } from '../../theme/tokens';
import { FocusDurationPicker } from '../settings/FocusDurationPicker';
import { projectScreenTime } from './lifeMath';

type StepView = {
  chat: string[];
  mood?: PipMood;
  body: React.ReactNode;
};

export function OnboardingFlow() {
  const s = useSettings();
  const { settings } = s;
  const { profile } = settings;
  const step = settings.onboarding.step;
  const steps = visibleSteps(settings);
  const index = Math.max(0, steps.indexOf(step));
  const name = profile.name.trim();

  // The answers appear once Pip has finished "talking" on this step.
  const [chatDoneFor, setChatDoneFor] = useState<OnboardingStep | null>(null);
  const chatDone = chatDoneFor === step;

  const [hoursDraft, setHoursDraft] = useState(profile.dailyScreenHours ?? 4);
  // Local draft so typing stays smooth; saved when the user moves on.
  const [nameDraft, setNameDraft] = useState(profile.name);
  const submitName = () => {
    s.setName(nameDraft.trim());
    next();
  };
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
      }
    },
    [],
  );

  const next = s.nextStep;
  const nameSuffix = name ? `, ${name}` : '';

  const view = ((): StepView => {
    switch (step) {
      case 'hello':
        return {
          chat: [
            "Hi, I'm Pip! 🌱",
            'I help people take their attention back from endless scrolling. One small step at a time.',
            'What should I call you?',
          ],
          body: (
            <>
              <AnswerHint kind="type" />
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="Your first name"
                placeholderTextColor={colors.inkFaint}
                accessibilityLabel="Your first name"
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={submitName}
                maxLength={40}
                style={styles.input}
              />
              <Button
                label={nameDraft.trim() ? 'Continue' : 'Skip'}
                onPress={submitName}
              />
            </>
          ),
        };

      case 'role':
        return {
          chat: [
            `Nice to meet you${nameSuffix}!`,
            'What does most of your day look like?',
          ],
          body: (
            <>
              <AnswerHint kind="one" />
              {ROLES.map(r => (
                <Chip
                  key={r.id}
                  block
                  role="radio"
                  icon={r.icon}
                  label={r.label}
                  selected={profile.role === r.id}
                  onPress={() => s.setRole(r.id)}
                />
              ))}
              <Button
                label={profile.role ? 'Continue' : 'Skip'}
                onPress={next}
              />
            </>
          ),
        };

      case 'exam':
        return {
          chat: [
            'What are you working towards?',
            "I'll shape your focus sessions around it.",
          ],
          body: (
            <>
              <AnswerHint kind="one" />
              <View style={styles.wrapRow}>
                {EXAMS.map(e => (
                  <Chip
                    key={e.id}
                    role="radio"
                    label={e.label}
                    selected={profile.exam === e.id}
                    onPress={() => s.setExam(e.id)}
                  />
                ))}
              </View>
              <Button
                label={profile.exam ? 'Continue' : 'Skip'}
                onPress={next}
              />
            </>
          ),
        };

      case 'struggles':
        return {
          chat: [
            'Be honest. No judgement here.',
            'Which of these sound like you lately? Pick all that apply.',
          ],
          mood: 'think',
          body: (
            <>
              <AnswerHint kind="many" />
              {STRUGGLES.map(st => (
                <Chip
                  key={st.id}
                  block
                  label={st.label}
                  selected={profile.struggles.includes(st.id)}
                  onPress={() => s.toggleStruggle(st.id)}
                />
              ))}
              <Button
                label={profile.struggles.length ? 'Continue' : 'None of these'}
                onPress={next}
              />
            </>
          ),
        };

      case 'science': {
        const picked = profile.struggles;
        return {
          chat: picked.length
            ? [
                "Thanks for sharing that. You're far from alone.",
                "Here's what's going on, and why it's fixable.",
              ]
            : ["Here's something most people don't realise about scrolling."],
          mood: picked.length ? 'concerned' : 'think',
          body: (
            <>
              <Card tone="sky">
                <Txt variant="heading">Your brain learns from your feed</Txt>
                <Txt>
                  Feeds serve something new every few seconds. Your brain adapts
                  to that pace, so slower things, like a chapter, a lecture or a
                  long conversation, start to feel harder.
                </Txt>
              </Card>
              <Card>
                <Txt variant="label">What research says</Txt>
                <Txt>
                  • A 2025 review of 71 studies (about 98,000 people) linked
                  heavy short-video use with weaker attention and self-control.
                </Txt>
                <Txt>
                  • In small experiments, rapid clip-switching made people worse
                  at remembering things they had planned to do.
                </Txt>
                {picked.includes('forgetting') ? (
                  <Txt>
                    • Forgetting a name you just heard is often an attention
                    slip: it never fully landed in the first place.
                  </Txt>
                ) : null}
                <Txt variant="caption">
                  These are links, not proof of lasting harm.
                </Txt>
              </Card>
              <Card tone="leaf">
                <Txt variant="heading">The good news</Txt>
                <Txt>
                  Attention is a skill. With practice it comes back. That's what
                  we'll work on together.
                </Txt>
              </Card>
              <Txt variant="caption" center>
                RECLAIM is a practice tool, not a medical treatment.
              </Txt>
              <Button label="That makes sense" onPress={next} />
            </>
          ),
        };
      }

      case 'age':
        return {
          chat: [
            'Quick one: how old are you?',
            "I'll use it for one calculation. It stays on your phone.",
          ],
          body: (
            <>
              <AnswerHint kind="one" />
              <View style={styles.wrapRow}>
                {AGE_BANDS.map(a => (
                  <Chip
                    key={a.id}
                    role="radio"
                    label={a.label}
                    selected={profile.ageBand === a.id}
                    onPress={() => s.setAgeBand(a.id)}
                  />
                ))}
              </View>
              <Button
                label={profile.ageBand ? 'Continue' : 'Skip'}
                onPress={next}
              />
            </>
          ),
        };

      case 'screenTime':
        return {
          chat: [
            'On a typical day, how long are you on your phone?',
            'A rough guess is fine.',
          ],
          body: (
            <>
              <Card style={styles.stepperCard}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Less"
                  onPress={() => setHoursDraft(h => Math.max(1, h - 1))}
                  style={styles.stepBtn}
                >
                  <Txt variant="title">−</Txt>
                </Pressable>
                <View
                  style={styles.stepValue}
                  accessible
                  accessibilityLabel={`${hoursDraft} hours a day`}
                >
                  <Txt variant="display" style={styles.bigNumber}>
                    {hoursDraft}
                    {hoursDraft >= 16 ? '+' : ''}
                  </Txt>
                  <Txt variant="caption">hours a day</Txt>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="More"
                  onPress={() => setHoursDraft(h => Math.min(16, h + 1))}
                  style={styles.stepBtn}
                >
                  <Txt variant="title">+</Txt>
                </Pressable>
              </Card>
              <Txt variant="caption" center>
                Want your real number? Android shows it in Settings › Digital
                Wellbeing.
              </Txt>
              <Button
                label="Continue"
                onPress={() => {
                  s.setScreenHours(hoursDraft);
                  next();
                }}
              />
              <Button
                label="I'd rather not say"
                variant="ghost"
                onPress={next}
              />
            </>
          ),
        };

      case 'reality': {
        const hours = profile.dailyScreenHours ?? 0;
        const p = projectScreenTime(hours, profile.ageBand);
        return {
          chat: [`${hours} hours a day. Let's see what that adds up to.`],
          mood: 'wow',
          body: (
            <>
              <Card tone="orange" style={styles.center}>
                <Txt variant="label" color={colors.ink}>
                  At today's pace
                </Txt>
                {p.lifetimeYears !== null ? (
                  <>
                    <CountUp
                      value={Math.round(p.lifetimeYears)}
                      suffix=" years"
                      style={styles.hugeNumber}
                    />
                    <Txt center color={colors.ink}>
                      of the next {p.yearsAhead} years would be spent looking at
                      your phone. That's {Math.round(p.daysPerYear)} full days,
                      every year.
                    </Txt>
                  </>
                ) : (
                  <>
                    <CountUp
                      value={Math.round(p.daysPerYear)}
                      suffix=" days"
                      style={styles.hugeNumber}
                    />
                    <Txt center color={colors.ink}>
                      every year spent looking at your phone. Around{' '}
                      {Math.round(p.wakingShare * 100)}% of your waking hours.
                    </Txt>
                  </>
                )}
                <Txt variant="caption" center>
                  Simple maths on your own estimate, not a prediction.
                </Txt>
              </Card>
              <Card tone="leaf">
                <Txt variant="label" color={colors.leaf}>
                  The good part
                </Txt>
                <Txt variant="heading">
                  Get back just 1 hour a day and you gain{' '}
                  {Math.round(p.oneHourBackDaysPerYear)} days a year for what
                  matters to you.
                </Txt>
              </Card>
              <Button label="I want that time back" onPress={next} />
            </>
          ),
        };
      }

      case 'priorities':
        return {
          chat: [
            'So what would you rather spend that time on?',
            'Pick as many as you like.',
          ],
          body: (
            <>
              <AnswerHint kind="many" />
              <View style={styles.wrapRow}>
                {PRIORITIES.map(p => (
                  <Chip
                    key={p.id}
                    label={p.label}
                    selected={settings.priorities.includes(p.id)}
                    onPress={() => s.togglePriority(p.id)}
                  />
                ))}
              </View>
              <Button
                label={settings.priorities.length ? 'Continue' : 'Skip'}
                onPress={next}
              />
            </>
          ),
        };

      case 'duration': {
        const exam = EXAMS.find(e => e.id === profile.exam);
        const longPrep =
          !!profile.exam && LONG_PREP_EXAMS.includes(profile.exam);
        return {
          chat:
            longPrep && exam
              ? [
                  `For ${exam.label} prep, many people work in longer blocks.`,
                  'How long should one focus session be?',
                ]
              : [
                  'How long should one focus session be?',
                  'Starting small is fine. That is how attention comes back.',
                ],
          body: (
            <>
              <AnswerHint kind="one" />
              <FocusDurationPicker
                minutes={settings.focusMinutes}
                onChange={s.setFocusMinutes}
              />
              <Button label="Continue" onPress={next} />
            </>
          ),
        };
      }

      case 'monitoring':
        return {
          chat: [
            'One optional thing.',
            'I can show how much time goes to apps you choose. You decide which ones.',
          ],
          mood: 'think',
          body: (
            <>
              <Card>
                <Txt variant="bodyBold">What it would look at</Txt>
                <Txt>Only total time in the apps you pick.</Txt>
                <Txt variant="bodyBold">What it never reads</Txt>
                <Txt>
                  Messages, notifications, what is on your screen, keystrokes or
                  browsing.
                </Txt>
                <Txt variant="bodyBold">Your control</Txt>
                <Txt>
                  Pause it in RECLAIM or switch it off in Android Settings any
                  time.
                </Txt>
              </Card>
              <AnswerHint kind="one" />
              <Chip
                block
                role="radio"
                label="Yes, show me my app time"
                selected={settings.monitoring.choice === 'requested'}
                onPress={() => s.setMonitoringChoice('requested')}
              />
              <Chip
                block
                role="radio"
                label="Not now"
                selected={settings.monitoring.choice === 'declined'}
                onPress={() => s.setMonitoringChoice('declined')}
              />
              <Txt variant="caption">
                Choosing yes saves your preference. Next, from the Insights tab,
                you'll allow Android's Usage Access and pick your apps. Nothing
                is read before that.
              </Txt>
              <Button
                label={
                  settings.monitoring.choice === 'undecided'
                    ? 'Skip'
                    : 'Continue'
                }
                onPress={next}
              />
            </>
          ),
        };

      case 'pledge':
        return {
          chat: [
            `Last thing${nameSuffix}.`,
            'Make a small promise to yourself. No pressure, no streaks.',
          ],
          body: (
            <>
              <Card tone="butter">
                <Txt variant="heading" center>
                  “I'll treat my attention as something worth protecting. Not
                  perfectly. Just a little more each day.”
                </Txt>
              </Card>
              <HoldToCommit
                label="Hold to commit"
                doneLabel="Promise made"
                onComplete={() => {
                  s.pledge();
                  advanceTimer.current = setTimeout(next, 700);
                }}
              />
              <Button label="Skip" variant="ghost" onPress={next} />
            </>
          ),
        };

      case 'ready': {
        const priorityLabels = PRIORITIES.filter(p =>
          settings.priorities.includes(p.id),
        ).map(p => p.label);
        return {
          chat: [
            `You're all set${nameSuffix}! 🎉`,
            'Your sprout grows with every minute you spend in focus. It never wilts.',
          ],
          mood: 'cheer',
          body: (
            <>
              <Card>
                <Txt variant="label">Your plan</Txt>
                <Txt variant="bodyBold">
                  {settings.focusMinutes}-minute focus sessions
                </Txt>
                <Txt>
                  More time for:{' '}
                  {priorityLabels.length
                    ? priorityLabels.join(', ')
                    : 'whatever matters to you'}
                </Txt>
                <Txt>
                  App time insights:{' '}
                  {settings.monitoring.choice === 'requested'
                    ? 'finish setup in Insights, nothing read yet'
                    : 'off, nothing collected'}
                </Txt>
              </Card>
              <Txt variant="caption" center>
                Everything you told me stays on this phone. Change it any time
                in Profile.
              </Txt>
              <Button label="Let's begin" onPress={s.completeOnboarding} />
            </>
          ),
        };
      }
    }
  })();

  const showBigPip = step === 'ready';

  return (
    <ScreenContainer>
      <View style={styles.header}>
        {index > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={s.previousStep}
            style={styles.back}
            hitSlop={8}
          >
            <Txt variant="title">‹</Txt>
          </Pressable>
        ) : null}
        <View style={styles.flex}>
          <ProgressBar value={index / Math.max(1, steps.length - 1)} />
        </View>
      </View>

      <FadeIn key={step} style={styles.step}>
        {showBigPip ? (
          <View style={styles.centerPip}>
            <Pip size={170} mood="cheer" growth={0.35} />
          </View>
        ) : null}
        <GuideChat
          key={step}
          messages={view.chat}
          mood={view.mood ?? 'happy'}
          pipSize={showBigPip ? 0 : 92}
          onDone={() => setChatDoneFor(step)}
        />
        {chatDone ? <FadeIn style={styles.body}>{view.body}</FadeIn> : null}
      </FadeIn>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: MIN_TOUCH_TARGET,
  },
  back: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
  },
  step: { gap: 18 },
  body: { gap: 12 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  input: {
    minHeight: 58,
    backgroundColor: colors.card,
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
  },
  stepperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.butter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { alignItems: 'center' },
  bigNumber: { fontSize: 56, lineHeight: 64 },
  hugeNumber: { fontSize: 52, lineHeight: 60, textAlign: 'center' },
  center: { alignItems: 'center' },
  centerPip: { alignItems: 'center' },
});
