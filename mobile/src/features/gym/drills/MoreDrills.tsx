import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AnswerHint, Button, Card, Chip, Pip, Txt } from '../../../components';
import { colors, fonts, radius } from '../../../theme/tokens';
import { haptic } from '../../../utils/haptics';
import { DEEPER } from '../content/deeper';
import { PASSAGES } from '../content/passages';
import { gradeDeeper, presentOrder, RecallTask } from '../gymModel';
import type { DrillResult } from './Drills';

type Done = (r: DrillResult) => void;

/** "Question it": Pip asks you to choose the best question before judging a real-world claim. */
export function DeeperDrill({
  seed,
  itemId,
  onDone,
}: {
  seed: string;
  itemId: string;
  onDone: Done;
}) {
  const item = DEEPER.find(d => d.id === itemId)!;
  const probeOrder = useMemo(
    () => presentOrder(item.probes.length, `${seed}:p:${item.id}`),
    [seed, item],
  );
  const verdictOrder = useMemo(
    () => presentOrder(item.verdicts.length, `${seed}:v:${item.id}`),
    [seed, item],
  );
  const [probe, setProbe] = useState<number | null>(null);
  const [probeChecked, setProbeChecked] = useState(false);
  const [verdict, setVerdict] = useState<number | null>(null);
  const [verdictChecked, setVerdictChecked] = useState(false);
  const started = useRef(Date.now());
  const g =
    probe !== null && verdict !== null
      ? gradeDeeper(item.id, probe, verdict)
      : null;

  return (
    <View style={styles.gap}>
      <Txt variant="label" color={colors.leaf}>
        {item.source}
      </Txt>
      <Card tone="sand" flat>
        <Txt variant="heading">{item.claim}</Txt>
      </Card>

      <View style={styles.pipRow}>
        <Pip size={56} mood="think" bob={false} />
        <View style={styles.bubble}>
          <Txt variant="bodyBold">
            Before deciding, what's the most useful thing to ask?
          </Txt>
        </View>
      </View>
      <AnswerHint kind="one" />
      {probeOrder.map(orig => (
        <Chip
          key={orig}
          block
          role="radio"
          label={`${item.probes[orig]}${
            probeChecked && orig === item.bestProbe ? '  ✓' : ''
          }`}
          selected={probe === orig}
          onPress={() => !probeChecked && setProbe(orig)}
        />
      ))}
      {!probeChecked ? (
        <Button
          label="Ask this"
          disabled={probe === null}
          onPress={() => {
            setProbeChecked(true);
            if (probe === item.bestProbe) {
              haptic.select();
            }
          }}
        />
      ) : (
        <>
          <Card tone={probe === item.bestProbe ? 'leaf' : 'sky'}>
            <Txt variant="bodyBold">
              {probe === item.bestProbe
                ? 'That’s the key question.'
                : 'The key question is the one with ✓.'}
            </Txt>
            <Txt color={colors.ink}>{item.probeWhy}</Txt>
          </Card>
          <Txt variant="bodyBold">So, how should you treat this claim?</Txt>
          <AnswerHint kind="one" />
          {verdictOrder.map(orig => (
            <Chip
              key={orig}
              block
              role="radio"
              label={`${item.verdicts[orig]}${
                verdictChecked && orig === item.bestVerdict ? '  ✓' : ''
              }`}
              selected={verdict === orig}
              onPress={() => !verdictChecked && setVerdict(orig)}
            />
          ))}
          {!verdictChecked ? (
            <Button
              label="Decide"
              disabled={verdict === null}
              onPress={() => {
                setVerdictChecked(true);
                if (verdict === item.bestVerdict) {
                  haptic.success();
                }
              }}
            />
          ) : (
            <>
              <Card tone="butter" style={styles.pipRow}>
                <Pip
                  size={70}
                  mood={g!.correct === 2 ? 'cheer' : 'happy'}
                  bob={false}
                />
                <View style={styles.flex}>
                  <Txt variant="label" color={colors.ink}>
                    Take this with you
                  </Txt>
                  <Txt color={colors.ink}>{item.takeaway}</Txt>
                </View>
              </Card>
              <Button
                label="Continue"
                onPress={() =>
                  onDone({
                    drill: 'deeper',
                    score: g!.correct / g!.total,
                    correct: g!.correct,
                    total: g!.total,
                    durationMs: Date.now() - started.current,
                    detail: {
                      itemId: item.id,
                      probeOk: g!.probeOk,
                      verdictOk: g!.verdictOk,
                    },
                  })
                }
              />
            </>
          )}
        </>
      )}
    </View>
  );
}

/** Recall: retrieve what you learned earlier, without looking. Spaced 1 day and 3+ days later. */
export function RecallDrill({
  task,
  seed,
  onDone,
}: {
  task: RecallTask;
  seed: string;
  onDone: Done;
}) {
  const started = useRef(Date.now());
  const [answers, setAnswers] = useState<(number | null)[]>([null, null]);
  const [checked, setChecked] = useState(false);
  const [written, setWritten] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [rating, setRating] = useState<number | null>(null);

  if (task.kind === 'passage') {
    const p = PASSAGES.find(x => x.id === task.passageId)!;
    // Use questions in a different order from the original read.
    const qs = [p.questions[2], p.questions[0]];
    const orders = qs.map((q, i) =>
      presentOrder(q.options.length, `${seed}:r:${i}`),
    );
    const correct = qs.filter((q, i) => answers[i] === q.answer).length;
    return (
      <View style={styles.gap}>
        <Card tone="sky">
          <Txt variant="bodyBold">
            {task.stage === 1 ? 'Yesterday' : 'A few days ago'} you read “
            {p.title}”.
          </Txt>
          <Txt color={colors.ink}>
            Answer from memory. Pulling it back out is what makes it stick.
          </Txt>
        </Card>
        {qs.map((q, qi) => (
          <View key={qi} style={styles.gap}>
            <Txt variant="bodyBold">
              {qi + 1}. {q.question}
            </Txt>
            <AnswerHint kind="one" />
            {orders[qi].map(orig => (
              <Chip
                key={orig}
                block
                role="radio"
                label={`${q.options[orig]}${
                  checked && orig === q.answer ? '  ✓' : ''
                }`}
                selected={answers[qi] === orig}
                onPress={() =>
                  !checked &&
                  setAnswers(a => a.map((x, i) => (i === qi ? orig : x)))
                }
              />
            ))}
          </View>
        ))}
        {!checked ? (
          <Button
            label="Check"
            disabled={answers.some(a => a === null)}
            onPress={() => setChecked(true)}
          />
        ) : (
          <>
            <Card tone={correct === 2 ? 'leaf' : 'sky'}>
              <Txt variant="heading">
                {correct} of 2 remembered
                {task.stage === 1 ? '' : ' after a few days'}
              </Txt>
              <Txt color={colors.ink}>
                {task.stage === 1
                  ? "I'll ask again in a few days. Spaced reminders help memory last."
                  : 'Remembering after a gap is the real test. Nicely done.'}
              </Txt>
            </Card>
            <Button
              label="Continue"
              onPress={() =>
                onDone({
                  drill: 'recall',
                  score: correct / 2,
                  correct,
                  total: 2,
                  durationMs: Date.now() - started.current,
                  detail: { passageId: p.id, stage: task.stage },
                })
              }
            />
          </>
        )}
      </View>
    );
  }

  // Focus-session recall: write what you remember, then compare with your note.
  return (
    <View style={styles.gap}>
      <Card tone="sky">
        <Txt variant="bodyBold">Recently you focused on:</Txt>
        <Txt variant="heading">“{task.intention || 'your session'}”</Txt>
        <Txt color={colors.ink}>
          Without looking, write the main things you remember from it.
        </Txt>
      </Card>
      <AnswerHint kind="type" />
      <TextInput
        value={written}
        onChangeText={setWritten}
        multiline
        placeholder="What do you remember?"
        placeholderTextColor={colors.inkFaint}
        accessibilityLabel="What you remember"
        editable={!revealed}
        style={styles.input}
      />
      {!revealed ? (
        <Button
          label="Compare with my notes"
          disabled={written.trim().length < 3}
          onPress={() => setRevealed(true)}
        />
      ) : (
        <>
          {task.note ? (
            <Card>
              <Txt variant="label">Your note after the session</Txt>
              <Txt>{task.note}</Txt>
            </Card>
          ) : (
            <Txt variant="caption">
              You didn't leave a note that time. Next time, jot one down after
              your session and I'll ask about it.
            </Txt>
          )}
          <Txt variant="bodyBold">How much did you remember?</Txt>
          <AnswerHint kind="one" />
          <View style={styles.row}>
            {['Little', 'Some', 'Most'].map((l, i) => (
              <Chip
                key={l}
                role="radio"
                label={l}
                selected={rating === i}
                onPress={() => setRating(i)}
              />
            ))}
          </View>
          <Button
            label="Continue"
            disabled={rating === null}
            onPress={() =>
              onDone({
                drill: 'recall',
                score: (rating ?? 0) / 2,
                correct: rating ?? 0,
                total: 2,
                durationMs: Date.now() - started.current,
                detail: { sessionId: task.sessionId, selfRated: true },
              })
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  gap: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bubble: {
    flex: 1,
    backgroundColor: colors.skySoft,
    borderWidth: 2,
    borderColor: colors.sky,
    borderRadius: radius.lg,
    padding: 12,
  },
  input: {
    minHeight: 110,
    backgroundColor: colors.card,
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
    textAlignVertical: 'top',
  },
});
