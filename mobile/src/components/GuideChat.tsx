import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme/tokens';
import { useReducedMotion } from '../utils/motion';
import { Pip, PipMood } from './Pip';
import { Txt } from './Txt';

type Props = {
  messages: string[];
  mood?: PipMood;
  growth?: number;
  /** Called once every message has been fully shown. */
  onDone?: () => void;
  pipSize?: number;
};

const CHARS_PER_TICK = 3;
const TICK_MS = 33;
const PAUSE_TICKS = 10; // short pause between bubbles

/** Pip "speaks" in chat bubbles that type out one after another. */
export function GuideChat({
  messages,
  mood = 'happy',
  growth = 0,
  onDone,
  pipSize = 96,
}: Props) {
  const reduced = useReducedMotion();
  const total = messages.reduce((n, m) => n + m.length, 0);
  // Each bubble gets a pause budget so they appear one at a time.
  const budget = total + PAUSE_TICKS * CHARS_PER_TICK * messages.length;
  const [shown, setShown] = useState(reduced ? budget : 0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (reduced) {
      setShown(budget);
      return;
    }
    const i = setInterval(() => {
      setShown(s => {
        if (s >= budget) {
          clearInterval(i);
          return s;
        }
        return s + CHARS_PER_TICK;
      });
    }, TICK_MS);
    return () => clearInterval(i);
  }, [budget, reduced]);

  const finished = shown >= budget;
  useEffect(() => {
    if (finished && !doneRef.current) {
      doneRef.current = true;
      onDone?.();
    }
  }, [finished, onDone]);

  // Work out how much of each message is visible.
  let remaining = shown;
  const visible = messages.map(m => {
    const pause = PAUSE_TICKS * CHARS_PER_TICK;
    if (remaining <= 0) {
      return null;
    }
    const lead = Math.min(remaining, pause);
    remaining -= lead;
    if (lead < pause) {
      return null;
    }
    const n = Math.min(remaining, m.length);
    remaining -= n;
    return n > 0 ? m.slice(0, n) : null;
  });

  return (
    <View style={styles.row}>
      {pipSize > 0 ? (
        <Pip size={pipSize} mood={mood} growth={growth} talking={!finished} />
      ) : null}
      <View style={styles.bubbles}>
        {visible.map((text, i) =>
          text === null ? null : (
            <View
              key={i}
              style={[styles.bubble, i === 0 && styles.firstBubble]}
              accessible
              accessibilityLiveRegion="polite"
              accessibilityLabel={messages[i]}
            >
              <Txt variant="bodyBold" style={styles.text}>
                {text}
              </Txt>
            </View>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bubbles: { flex: 1, gap: 8, paddingTop: 6 },
  bubble: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  firstBubble: { borderTopLeftRadius: 4 },
  text: { fontSize: 16, lineHeight: 23 },
});
