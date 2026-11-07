import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  AnswerHint,
  Button,
  Card,
  Chip,
  Pip,
  ProgressBar,
  Txt,
} from '../../../components';
import { colors, fonts, radius, STICKER_OFFSET } from '../../../theme/tokens';
import { haptic } from '../../../utils/haptics';
import { SKILL_LABELS } from '../content/reasoning';
import { PASSAGES } from '../content/passages';
import {
  Attempt,
  gradeNames,
  gradeReading,
  gradeReasoning,
  gradeRemember,
  gradeSteady,
  makeNamesRound,
  makeRememberRound,
  makeSteadyRound,
  ms,
  presentOrder,
  reasoningById,
  RememberResponse,
  STEADY_TARGET,
} from '../gymModel';

export type DrillResult = Omit<Attempt, 'id' | 'date' | 'at' | 'sync'>;
type DrillProps = { seed: string; onDone: (r: DrillResult) => void };

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Shared end-of-drill card: score, a kind line from Pip, and Continue. */
function Result({
  good,
  title,
  lines,
  onContinue,
}: {
  good: boolean;
  title: string;
  lines: string[];
  onContinue: () => void;
}) {
  return (
    <View style={styles.gap}>
      <Card tone={good ? 'leaf' : 'sky'} style={styles.resultRow}>
        <Pip size={84} mood={good ? 'cheer' : 'happy'} bob={false} />
        <View style={styles.flex}>
          <Txt variant="heading">{title}</Txt>
          {lines.map(l => (
            <Txt key={l} color={colors.ink}>
              {l}
            </Txt>
          ))}
        </View>
      </Card>
      <Button label="Continue" onPress={onContinue} />
    </View>
  );
}

// ---------------------------------------------------------------- Reasoning

export function ReasonDrill({
  seed,
  itemId,
  onDone,
}: DrillProps & { itemId: string }) {
  const item = reasoningById(itemId)!;
  const order = useMemo(
    () => presentOrder(item.options.length, `${seed}:${item.id}`),
    [seed, item],
  );
  const [chosen, setChosen] = useState<number | null>(null);
  const [checked, setChecked] = useState<boolean | null>(null);
  const started = useRef(Date.now());

  return (
    <View style={styles.gap}>
      <Txt variant="label" color={colors.leaf}>
        {SKILL_LABELS[item.skill]}
      </Txt>
      <Card tone="sand" flat>
        <Txt variant="heading">“{item.passage}”</Txt>
      </Card>
      <Txt variant="bodyBold">{item.question}</Txt>
      <AnswerHint kind="one" />
      {order.map((orig, k) => (
        <Chip
          key={orig}
          block
          role="radio"
          label={`${String.fromCharCode(65 + k)}. ${item.options[orig]}`}
          selected={chosen === orig}
          onPress={() => checked === null && setChosen(orig)}
        />
      ))}
      {checked === null ? (
        <Button
          label="Check my reasoning"
          disabled={chosen === null}
          onPress={() => {
            const { correct } = gradeReasoning(item.id, chosen!);
            setChecked(correct);
            if (correct) {
              haptic.success();
            }
          }}
        />
      ) : (
        <Result
          good={checked}
          title={checked ? 'Sharp thinking!' : 'Good try. Here’s the key idea.'}
          lines={[item.explanation]}
          onContinue={() =>
            onDone({
              drill: 'reason',
              score: checked ? 1 : 0,
              correct: checked ? 1 : 0,
              total: 1,
              durationMs: Date.now() - started.current,
              detail: {
                itemId: item.id,
                skill: item.skill,
                response: chosen!,
              },
            })
          }
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------- Reading

export function ReadDrill({
  passageId,
  onDone,
}: DrillProps & { passageId: string }) {
  const p = PASSAGES.find(x => x.id === passageId)!;
  const [phase, setPhase] = useState<'read' | 'quiz' | 'done'>('read');
  const [answers, setAnswers] = useState<(number | null)[]>(
    p.questions.map(() => null),
  );
  const started = useRef(Date.now());
  const readMs = useRef(0);
  const orders = useMemo(
    () =>
      p.questions.map((q, i) => presentOrder(q.options.length, `${p.id}:${i}`)),
    [p],
  );
  const graded =
    phase === 'done'
      ? gradeReading(
          p.id,
          answers.map(a => (a === null ? -1 : a)),
        )
      : null;

  if (phase === 'read') {
    return (
      <View style={styles.gap}>
        <Txt variant="caption">
          Read it once, slowly. It will be hidden for the questions.
        </Txt>
        <Card>
          <Txt variant="heading">{p.title}</Txt>
          <Txt style={styles.passage}>{p.text}</Txt>
        </Card>
        <Button
          label="I've read it"
          onPress={() => {
            readMs.current = Date.now() - started.current;
            setPhase('quiz');
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.gap}>
      {p.questions.map((q, qi) => (
        <View key={qi} style={styles.gap}>
          <Txt variant="bodyBold">
            {qi + 1}. {q.question}
          </Txt>
          <AnswerHint kind="one" />
          {orders[qi].map(orig => {
            const isRight = phase === 'done' && orig === q.answer;
            return (
              <Chip
                key={orig}
                block
                role="radio"
                label={`${q.options[orig]}${isRight ? '  ✓' : ''}`}
                selected={answers[qi] === orig}
                onPress={() =>
                  phase === 'quiz' &&
                  setAnswers(a => a.map((x, i) => (i === qi ? orig : x)))
                }
              />
            );
          })}
        </View>
      ))}
      {phase === 'quiz' ? (
        <Button
          label="Check answers"
          disabled={answers.some(a => a === null)}
          onPress={() => setPhase('done')}
        />
      ) : (
        <Result
          good={graded!.correct >= 2}
          title={`${graded!.correct} of ${graded!.total} from memory`}
          lines={[
            `You read for ${Math.max(
              1,
              Math.round(readMs.current / 1000),
            )} seconds.`,
            'Reading without skimming is a skill. It grows with practice.',
          ]}
          onContinue={() =>
            onDone({
              drill: 'read',
              score: graded!.correct / graded!.total,
              correct: graded!.correct,
              total: graded!.total,
              durationMs: Date.now() - started.current,
              detail: { passageId: p.id, readMs: readMs.current },
            })
          }
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------- Names & faces

export function NamesDrill({
  seed,
  size,
  onDone,
}: DrillProps & { size: number }) {
  const round = useMemo(() => makeNamesRound(size, seed), [size, seed]);
  const [phase, setPhase] = useState<'study' | 'pause' | 'quiz' | 'done'>(
    'study',
  );
  const [qi, setQi] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const [flash, setFlash] = useState<null | boolean>(null);
  const started = useRef(Date.now());

  useEffect(() => {
    if (phase !== 'pause') {
      return;
    }
    const t = setTimeout(() => setPhase('quiz'), ms(4000));
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'study') {
    return (
      <View style={styles.gap}>
        <Txt>
          Meet {size} people. Say each name in your head once and link it to the
          face.
        </Txt>
        <View style={styles.grid}>
          {round.people.map(p => (
            <View
              key={p.name}
              style={styles.person}
              accessible
              accessibilityLabel={`${p.name}`}
            >
              <Txt style={styles.face}>{p.face}</Txt>
              <Txt variant="bodyBold">{p.name}</Txt>
            </View>
          ))}
        </View>
        <Button label="I've got them" onPress={() => setPhase('pause')} />
      </View>
    );
  }

  if (phase === 'pause') {
    return (
      <Card tone="sky" style={styles.center}>
        <Pip size={110} mood="calm" />
        <Txt variant="heading" center>
          Take one slow breath…
        </Txt>
        <Txt center>Then let's see who you remember.</Txt>
      </Card>
    );
  }

  if (phase === 'done') {
    const g = gradeNames(round, chosen);
    return (
      <Result
        good={g.correct / g.total >= 0.7}
        title={`${g.correct} of ${g.total} names remembered`}
        lines={[
          g.correct === g.total
            ? 'Every one! Next time I’ll introduce more people.'
            : 'Tip: repeat each name once and link it to something you notice.',
        ]}
        onContinue={() =>
          onDone({
            drill: 'names',
            score: g.correct / g.total,
            correct: g.correct,
            total: g.total,
            durationMs: Date.now() - started.current,
            detail: { size },
          })
        }
      />
    );
  }

  const q = round.quiz[qi];
  return (
    <View style={styles.gap}>
      <ProgressBar value={qi / round.quiz.length} />
      <Card style={styles.center}>
        <Txt style={styles.bigFace}>{q.face}</Txt>
        <Txt variant="heading">Who is this?</Txt>
        {flash !== null ? (
          <Txt variant="bodyBold" color={flash ? colors.leaf : colors.danger}>
            {flash ? 'Yes!' : `That was ${round.quiz[qi].answer}`}
          </Txt>
        ) : null}
      </Card>
      <AnswerHint kind="one" />
      {q.options.map(name => (
        <Chip
          key={name}
          block
          role="radio"
          label={name}
          selected={chosen[qi] === name}
          onPress={() => {
            if (flash !== null) {
              return;
            }
            const right = name === q.answer;
            setChosen(c => [...c, name]);
            setFlash(right);
            if (right) {
              haptic.select();
            }
            setTimeout(() => {
              setFlash(null);
              if (qi + 1 >= round.quiz.length) {
                setPhase('done');
              } else {
                setQi(i => i + 1);
              }
            }, ms(700));
          }}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- Remember to remember

export function RememberDrill({ seed, onDone }: DrillProps) {
  const items = useMemo(() => makeRememberRound(seed), [seed]);
  const [phase, setPhase] = useState<'intro' | 'run' | 'done'>('intro');
  const [i, setI] = useState(0);
  const responses = useRef<RememberResponse[]>([]);
  const started = useRef(Date.now());

  const answer = (r: RememberResponse) => {
    responses.current[i] = r;
    haptic.tap();
    if (i + 1 >= items.length) {
      setPhase('done');
    } else {
      setI(i + 1);
    }
  };

  // Each word waits a few seconds, then moves on (counted as no answer).
  useEffect(() => {
    if (phase !== 'run') {
      return;
    }
    const t = setTimeout(() => {
      responses.current[i] = responses.current[i] ?? null;
      if (i + 1 >= items.length) {
        setPhase('done');
      } else {
        setI(x => x + 1);
      }
    }, ms(3000));
    return () => clearTimeout(t);
  }, [phase, i, items.length]);

  if (phase === 'intro') {
    return (
      <View style={styles.gap}>
        <Card tone="butter">
          <Txt variant="heading">Your job</Txt>
          <Txt color={colors.ink}>
            Sort each word: is it a living thing or not?
          </Txt>
          <Txt variant="heading">And remember this…</Txt>
          <Txt color={colors.ink}>
            If a word is something you can eat, tap “🍋 Remember!” instead.
          </Txt>
        </Card>
        <Txt variant="caption">
          This trains remembering a plan while you're busy, like remembering to
          buy milk on the way home.
        </Txt>
        <Button label="Start" onPress={() => setPhase('run')} />
      </View>
    );
  }

  if (phase === 'done') {
    const g = gradeRemember(items, responses.current);
    return (
      <Result
        good={g.cueHits === g.cueTotal}
        title={`Remembered ${g.cueHits} of ${g.cueTotal} food words`}
        lines={[`Sorted ${g.sortCorrect} of ${g.sortTotal} words correctly.`]}
        onContinue={() =>
          onDone({
            drill: 'remember',
            score: g.score,
            correct: g.cueHits,
            total: g.cueTotal,
            durationMs: Date.now() - started.current,
            detail: {
              sortCorrect: g.sortCorrect,
              sortTotal: g.sortTotal,
            },
          })
        }
      />
    );
  }

  return (
    <View style={styles.gap}>
      <ProgressBar value={i / items.length} />
      <Card style={styles.wordCard}>
        <Txt variant="display" center accessibilityLiveRegion="polite">
          {items[i].word}
        </Txt>
      </Card>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            label="🌿 Living"
            variant="secondary"
            onPress={() => answer('living')}
          />
        </View>
        <View style={styles.flex}>
          <Button
            label="🪨 Not living"
            variant="secondary"
            onPress={() => answer('nonliving')}
          />
        </View>
      </View>
      <Button label="🍋 Remember!" onPress={() => answer('remember')} />
    </View>
  );
}

// ---------------------------------------------------------------- Steady eye

export function SteadyDrill({ seed, onDone }: DrillProps) {
  const digits = useMemo(() => makeSteadyRound(seed), [seed]);
  const [phase, setPhase] = useState<'intro' | 'run' | 'done'>('intro');
  const [i, setI] = useState(0);
  const tapped = useRef<boolean[]>([]);
  const [pulse, setPulse] = useState(false);
  const started = useRef(Date.now());

  useEffect(() => {
    if (phase !== 'run') {
      return;
    }
    const t = setTimeout(() => {
      if (i + 1 >= digits.length) {
        setPhase('done');
      } else {
        setI(x => x + 1);
      }
    }, ms(1100));
    return () => clearTimeout(t);
  }, [phase, i, digits.length]);

  if (phase === 'intro') {
    return (
      <View style={styles.gap}>
        <Card tone="butter">
          <Txt variant="heading">Tap for every number…</Txt>
          <Txt color={colors.ink}>
            …except <Txt variant="bodyBold">{STEADY_TARGET}</Txt>. When you see{' '}
            {STEADY_TARGET}, hold still.
          </Txt>
        </Card>
        <Txt variant="caption">
          About 40 seconds. It trains staying steady when things get repetitive,
          the moment the mind usually wanders.
        </Txt>
        <Button label="Start" onPress={() => setPhase('run')} />
      </View>
    );
  }

  if (phase === 'done') {
    const g = gradeSteady(digits, tapped.current);
    return (
      <Result
        good={g.score >= 0.85}
        title={`${pct(g.score)} steady`}
        lines={[
          `Held still on ${g.holds} of ${g.noGoTotal} “${STEADY_TARGET}”s.`,
          `Tapped ${g.hits} of ${g.goTotal} other numbers.`,
        ]}
        onContinue={() =>
          onDone({
            drill: 'steady',
            score: g.score,
            correct: g.correct,
            total: g.total,
            durationMs: Date.now() - started.current,
            detail: {
              holds: g.holds,
              noGoTotal: g.noGoTotal,
              hits: g.hits,
              goTotal: g.goTotal,
            },
          })
        }
      />
    );
  }

  return (
    <View style={styles.gap}>
      <ProgressBar value={i / digits.length} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Number ${digits[i]}. Tap`}
        onPressIn={() => {
          if (!tapped.current[i]) {
            tapped.current[i] = true;
            setPulse(true);
            setTimeout(() => setPulse(false), 120);
          }
        }}
        style={styles.tapOuter}
      >
        <View style={styles.tapShadow} />
        <View style={[styles.tapFace, pulse && styles.tapPulse]}>
          <Txt style={styles.digit}>{digits[i]}</Txt>
          <Txt variant="caption">Tap anywhere here</Txt>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  gap: { gap: 12 },
  row: { flexDirection: 'row', gap: 10 },
  center: { alignItems: 'center', gap: 8 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  passage: { fontSize: 17, lineHeight: 27, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  person: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
  },
  face: { fontSize: 44, lineHeight: 54 },
  bigFace: { fontSize: 80, lineHeight: 96 },
  wordCard: { minHeight: 160, justifyContent: 'center' },
  tapOuter: { paddingRight: STICKER_OFFSET, paddingBottom: STICKER_OFFSET },
  tapShadow: {
    position: 'absolute',
    top: STICKER_OFFSET,
    left: STICKER_OFFSET,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
  },
  tapFace: {
    height: 300,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapPulse: { backgroundColor: colors.butter },
  digit: {
    fontFamily: fonts.display,
    fontSize: 120,
    lineHeight: 140,
    color: colors.ink,
  },
});
