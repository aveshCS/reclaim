import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, FadeIn, Pip, Pop, Sparkles, Txt } from '../../components';
import { colors, fonts, radius } from '../../theme/tokens';
import { haptic } from '../../utils/haptics';
import { useReducedMotion } from '../../utils/motion';

/** How long the user holds to pause the scroll. Long enough to be one slow breath. */
export const HOLD_MS = 3000;
const DARK = '#15110F';
const CARD_H = 190;
const GAP = 14;
const POSTS = [
  { emoji: '😂', color: '#FF4D6D', likes: '12.4K' },
  { emoji: '🔥', color: '#FFB703', likes: '88K' },
  { emoji: '🎮', color: '#3A86FF', likes: '3.1K' },
  { emoji: '💸', color: '#06D6A0', likes: '501K' },
  { emoji: '🍕', color: '#FB5607', likes: '27K' },
  { emoji: '😱', color: '#8338EC', likes: '1.2M' },
  { emoji: '🐶', color: '#FF006E', likes: '64K' },
  { emoji: '💄', color: '#FFBE0B', likes: '9.9K' },
];
const SET_H = POSTS.length * (CARD_H + GAP);

const PROMISES = [
  { icon: '🫧', text: 'A breath before the feeds that pull you in' },
  { icon: '🧠', text: 'Train your focus, 4 minutes a day' },
  { icon: '🌱', text: 'I grow with every minute you take back' },
];

/**
 * First launch: feel the scroll, then pause it.
 * An endless feed races by; holding the button slows it to a stop while a seed grows into
 * Pip. Letting go early lets the feed speed up again. Finishing the hold is the product in
 * miniature: one breath between you and the scroll.
 */
export function IntroPromo({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const p = useRef(new Animated.Value(0)).current; // 0 = scrolling, 1 = paused
  const pRef = useRef(0);
  const offset = useRef(new Animated.Value(0)).current;
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);
  const [burst, setBurst] = useState(0);
  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);
  const doneRef = useRef(false);
  const lastBuzz = useRef(0);

  useEffect(() => {
    const id = p.addListener(({ value }) => {
      pRef.current = value;
      // A light buzz each quarter of the hold, like a heartbeat slowing down.
      const q = Math.floor(value * 4);
      if (q > lastBuzz.current) {
        lastBuzz.current = q;
        haptic.tap();
      } else if (q < lastBuzz.current) {
        lastBuzz.current = q;
      }
    });
    return () => p.removeListener(id);
  }, [p]);

  // The feed: moves at full speed, slows as the hold progresses.
  useEffect(() => {
    if (reduced) {
      return;
    }
    let raf = 0;
    let last = Date.now();
    let pos = 0;
    let posts = 0;
    let lastShown = 0;
    const loop = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const speed = 1500 * (1 - pRef.current) ** 2; // px/s
      pos = (pos + speed * dt) % SET_H;
      posts += (speed * dt) / (CARD_H + GAP);
      offset.setValue(-pos);
      if (now - lastShown > 90) {
        lastShown = now;
        setCount(Math.floor(posts));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [offset, reduced]);

  const complete = () => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    holdAnim.current?.stop();
    p.setValue(1);
    haptic.success();
    setDone(true);
    setBurst(1);
  };

  const startHold = () => {
    if (doneRef.current) {
      return;
    }
    holdAnim.current?.stop();
    holdAnim.current = Animated.timing(p, {
      toValue: 1,
      duration: Math.max(200, (1 - pRef.current) * HOLD_MS),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    holdAnim.current.start(({ finished }) => finished && complete());
  };

  const release = () => {
    if (doneRef.current) {
      return;
    }
    holdAnim.current?.stop();
    holdAnim.current = Animated.timing(p, {
      toValue: 0,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    holdAnim.current.start();
  };

  const bg = p.interpolate({ inputRange: [0, 1], outputRange: [DARK, colors.paper] });
  const feedOpacity = p.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.5, 0.08, 0] });
  const pipScale = p.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  const glow = p.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.6] });
  const darkTextOpacity = p.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: 'clamp' });
  const fill = p.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const cardW = Math.min(320, width * 0.72);

  return (
    <Animated.View style={[styles.root, { backgroundColor: bg }]}>
      {/* The endless feed */}
      <Animated.View
        pointerEvents="none"
        style={[styles.feed, { opacity: feedOpacity, transform: [{ translateY: offset }] }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {[...POSTS, ...POSTS, ...POSTS].map((post, i) => (
          <View key={i} style={[styles.post, { width: cardW, backgroundColor: post.color }]}>
            <Text style={styles.postEmoji}>{post.emoji}</Text>
            <View style={styles.postBar} />
            <View style={[styles.postBar, styles.postBarShort]} />
            <Text style={styles.postLikes}>♥ {post.likes}</Text>
          </View>
        ))}
      </Animated.View>

      <View style={[styles.layer, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.topRow}>
          <Animated.View style={{ opacity: darkTextOpacity }}>
            <Text style={styles.counter} accessibilityLabel={`${count} posts scrolled`}>
              {count.toLocaleString()} posts scrolled
            </Text>
          </Animated.View>
          {!done ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip intro"
              onPress={onDone}
              hitSlop={12}
            >
              <Animated.Text style={[styles.skip, styles.pill, { opacity: darkTextOpacity }]}>
                Skip intro
              </Animated.Text>
            </Pressable>
          ) : null}
        </View>

        {!done ? (
          <>
            <Animated.View style={[styles.headline, { opacity: darkTextOpacity }]}>
              <Text style={styles.big}>Endless.</Text>
              <Text style={styles.big}>On purpose.</Text>
            </Animated.View>
            <View style={styles.center}>
              <Animated.View style={[styles.glow, { opacity: glow }]} />
              <Animated.View style={{ transform: [{ scale: pipScale }] }}>
                <Pip size={170} mood="calm" bob={false} />
              </Animated.View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hold to pause the scroll"
              accessibilityHint="Press and hold for one slow breath"
              accessibilityActions={[{ name: 'activate' }]}
              onAccessibilityAction={complete}
              onPressIn={startHold}
              onPressOut={release}
              style={styles.hold}
            >
              <Animated.View style={[styles.holdFill, { width: fill }]} />
              <Text style={styles.holdText}>Hold to pause the scroll</Text>
            </Pressable>
            <Animated.Text style={[styles.hint, { opacity: darkTextOpacity }]}>
              Let go, and it starts again.
            </Animated.Text>
          </>
        ) : (
          <View style={styles.doneWrap}>
            <View style={styles.center}>
              <Sparkles burstKey={burst} />
              <Pop trigger={burst}>
                <Pip size={180} mood="cheer" growth={0.3} />
              </Pop>
            </View>
            <FadeIn delay={150}>
              <Txt variant="display" center>
                Hi! I'm Pip.
              </Txt>
            </FadeIn>
            <FadeIn delay={350}>
              <Txt variant="heading" center>
                That breath you just took? That's how we win your time back.
              </Txt>
            </FadeIn>
            <View style={styles.promises}>
              {PROMISES.map((pr, i) => (
                <FadeIn key={pr.text} delay={600 + i * 180}>
                  <View style={styles.promise}>
                    <Text style={styles.promiseIcon}>{pr.icon}</Text>
                    <Txt variant="bodyBold" style={styles.flex}>
                      {pr.text}
                    </Txt>
                  </View>
                </FadeIn>
              ))}
            </View>
            <FadeIn delay={1200}>
              <Button label="Let's begin" onPress={onDone} />
            </FadeIn>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  flex: { flex: 1 },
  feed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: GAP,
    paddingTop: GAP,
  },
  post: {
    height: CARD_H,
    borderRadius: radius.lg,
    padding: 16,
    justifyContent: 'flex-end',
    gap: 8,
  },
  postEmoji: { fontSize: 54, position: 'absolute', top: 22, left: 18 },
  postBar: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.75)' },
  postBarShort: { width: '55%' },
  postLikes: { color: '#fff', fontFamily: fonts.bodyBlack, fontSize: 14 },
  layer: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: {
    color: '#fff',
    fontFamily: fonts.bodyBlack,
    fontSize: 15,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  skip: {
    color: '#fff',
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  pill: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: colors.butter,
  },
  headline: { alignItems: 'center' },
  big: {
    color: '#fff',
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 50,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 12,
  },
  center: { alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  hold: {
    height: 68,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: colors.line,
    backgroundColor: colors.card,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  holdFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.orange,
  },
  holdText: {
    textAlign: 'center',
    fontFamily: fonts.bodyBlack,
    fontSize: 18,
    color: colors.ink,
  },
  hint: { color: '#fff', textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 14 },
  doneWrap: { flex: 1, justifyContent: 'center', gap: 14 },
  promises: { gap: 10, marginVertical: 8 },
  promise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 12,
  },
  promiseIcon: { fontSize: 26 },
});
