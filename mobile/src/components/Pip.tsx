import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { colors } from '../theme/tokens';
import { useReducedMotion } from '../utils/motion';

export type PipMood =
  | 'happy'
  | 'think'
  | 'wow'
  | 'calm'
  | 'cheer'
  | 'concerned';

type Props = {
  size?: number;
  mood?: PipMood;
  /** 0..1. Grows the sprout with real reclaimed time. It never shrinks or wilts. */
  growth?: number;
  /** Animate the mouth as if speaking. */
  talking?: boolean;
  /** Gentle idle bobbing. */
  bob?: boolean;
};

const INK = colors.ink;

function PipBase({
  size = 160,
  mood = 'happy',
  growth = 0,
  talking = false,
  bob = true,
}: Props) {
  const reduced = useReducedMotion();
  const lift = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const [blink, setBlink] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);

  // Idle bob.
  useEffect(() => {
    if (!bob || reduced) {
      lift.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lift, {
          toValue: -5,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(lift, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, reduced, lift]);

  // A little pop whenever the mood changes.
  useEffect(() => {
    if (reduced) {
      return;
    }
    pop.setValue(0.92);
    const a = Animated.spring(pop, {
      toValue: 1,
      friction: 4,
      tension: 160,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [mood, reduced, pop]);

  // Blinking.
  useEffect(() => {
    if (reduced) {
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t = setTimeout(() => {
        setBlink(true);
        t = setTimeout(() => {
          setBlink(false);
          schedule();
        }, 140);
      }, 2600 + Math.random() * 2400);
    };
    schedule();
    return () => clearTimeout(t);
  }, [reduced]);

  // Talking mouth.
  useEffect(() => {
    if (!talking || reduced) {
      setMouthOpen(false);
      return;
    }
    const i = setInterval(() => setMouthOpen(o => !o), 170);
    return () => clearInterval(i);
  }, [talking, reduced]);

  const g = Math.min(1, Math.max(0, growth));
  const stemTop = 60 - (16 + 26 * g);

  const eyesClosed = mood === 'calm' || mood === 'cheer';
  const eyeRy = mood === 'wow' ? 12 : 10;
  const lookUp = mood === 'think' ? -3 : 0;

  const eye = (cx: number) => {
    if (eyesClosed) {
      // Happy closed eyes: ^ for cheer, gentle arc for calm.
      const d =
        mood === 'cheer'
          ? `M${cx - 8} 132 Q${cx} 120 ${cx + 8} 132`
          : `M${cx - 8} 128 Q${cx} 135 ${cx + 8} 128`;
      return (
        <Path
          d={d}
          stroke={INK}
          strokeWidth={4.5}
          strokeLinecap="round"
          fill="none"
        />
      );
    }
    if (blink) {
      return (
        <Path
          d={`M${cx - 7} 128 L${cx + 7} 128`}
          stroke={INK}
          strokeWidth={4.5}
          strokeLinecap="round"
        />
      );
    }
    return (
      <G>
        <Ellipse cx={cx} cy={128 + lookUp} rx={7.5} ry={eyeRy} fill={INK} />
        <Circle cx={cx + 2.5} cy={123 + lookUp} r={3} fill="#FFFFFF" />
      </G>
    );
  };

  let mouth: React.ReactNode;
  if (talking && mouthOpen) {
    mouth = <Path d="M90 150 Q100 168 110 150 Z" fill={INK} />;
  } else if (mood === 'wow') {
    mouth = <Ellipse cx={100} cy={156} rx={6} ry={8} fill={INK} />;
  } else if (mood === 'think') {
    mouth = (
      <Path
        d="M93 156 Q100 152 108 155"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
    );
  } else if (mood === 'concerned') {
    mouth = (
      <Path
        d="M90 158 Q95 153 100 157 Q105 161 110 156"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
    );
  } else if (mood === 'cheer') {
    mouth = <Path d="M86 148 Q100 172 114 148 Z" fill={INK} />;
  } else {
    mouth = (
      <Path
        d="M88 151 Q100 163 112 151"
        stroke={INK}
        strokeWidth={4.5}
        strokeLinecap="round"
        fill="none"
      />
    );
  }

  const height = size * 1.1;

  return (
    <View
      style={{ width: size, height }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Pip, your guide"
    >
      <Animated.View
        style={{ transform: [{ translateY: lift }, { scale: pop }] }}
      >
        <Svg width={size} height={height} viewBox="0 0 200 220">
          {/* ground shadow */}
          <Ellipse cx={100} cy={212} rx={52} ry={6} fill={INK} opacity={0.08} />

          {/* sprout */}
          <Path
            d={`M100 66 Q95 ${(66 + stemTop) / 2} 100 ${stemTop}`}
            stroke={INK}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d={`M100 ${stemTop} C86 ${stemTop - 16} 68 ${stemTop - 8} 64 ${
              stemTop + 6
            } C80 ${stemTop + 12} 94 ${stemTop + 8} 100 ${stemTop} Z`}
            fill={colors.leaf}
            stroke={INK}
            strokeWidth={3.5}
            strokeLinejoin="round"
          />
          <Path
            d={`M100 ${stemTop} C114 ${stemTop - 16} 132 ${stemTop - 8} 136 ${
              stemTop + 6
            } C120 ${stemTop + 12} 106 ${stemTop + 8} 100 ${stemTop} Z`}
            fill={colors.leaf}
            stroke={INK}
            strokeWidth={3.5}
            strokeLinejoin="round"
          />
          {g >= 0.5 ? (
            <Path
              d={`M99 ${(66 + stemTop) / 2 + 4} C88 ${
                (66 + stemTop) / 2 - 4
              } 80 ${(66 + stemTop) / 2 + 2} 80 ${
                (66 + stemTop) / 2 + 10
              } C90 ${(66 + stemTop) / 2 + 12} 96 ${
                (66 + stemTop) / 2 + 9
              } 99 ${(66 + stemTop) / 2 + 4} Z`}
              fill={colors.leaf}
              stroke={INK}
              strokeWidth={3}
              strokeLinejoin="round"
            />
          ) : null}
          {g >= 0.85 ? (
            <Circle
              cx={100}
              cy={stemTop - 4}
              r={7}
              fill={colors.orange}
              stroke={INK}
              strokeWidth={3}
            />
          ) : null}

          {/* feet */}
          <Ellipse
            cx={78}
            cy={202}
            rx={15}
            ry={8}
            fill={colors.butter}
            stroke={INK}
            strokeWidth={4}
          />
          <Ellipse
            cx={122}
            cy={202}
            rx={15}
            ry={8}
            fill={colors.butter}
            stroke={INK}
            strokeWidth={4}
          />

          {/* arms */}
          {mood === 'cheer' ? (
            <>
              <Path
                d="M34 132 Q16 112 22 92"
                stroke={INK}
                strokeWidth={5}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d="M166 132 Q184 112 178 92"
                stroke={INK}
                strokeWidth={5}
                strokeLinecap="round"
                fill="none"
              />
            </>
          ) : (
            <>
              <Path
                d="M30 152 Q16 160 18 172"
                stroke={INK}
                strokeWidth={5}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d="M170 152 Q184 160 182 172"
                stroke={INK}
                strokeWidth={5}
                strokeLinecap="round"
                fill="none"
              />
            </>
          )}

          {/* body */}
          <Path
            d="M100 62 C150 62 178 98 178 140 C178 182 146 204 100 204 C54 204 22 182 22 140 C22 98 50 62 100 62 Z"
            fill={colors.butter}
            stroke={INK}
            strokeWidth={4.5}
          />
          <Ellipse
            cx={100}
            cy={172}
            rx={44}
            ry={24}
            fill="#FFFFFF"
            opacity={0.35}
          />

          {/* brows for a soft, concerned look */}
          {mood === 'concerned' ? (
            <>
              <Path
                d="M66 110 Q74 106 82 110"
                stroke={INK}
                strokeWidth={3.5}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d="M118 110 Q126 106 134 110"
                stroke={INK}
                strokeWidth={3.5}
                strokeLinecap="round"
                fill="none"
              />
            </>
          ) : null}

          {/* cheeks */}
          <Ellipse
            cx={60}
            cy={148}
            rx={11}
            ry={6.5}
            fill={colors.blush}
            opacity={0.8}
          />
          <Ellipse
            cx={140}
            cy={148}
            rx={11}
            ry={6.5}
            fill={colors.blush}
            opacity={0.8}
          />

          {eye(76)}
          {eye(124)}
          {mouth}
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Pip, RECLAIM's guide: a small round creature with a sprout on its head. Memoised so chat typing doesn't redraw it. */
export const Pip = React.memo(PipBase);
