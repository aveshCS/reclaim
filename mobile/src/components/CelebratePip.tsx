import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { haptic } from '../utils/haptics';
import { Pop, Sparkles } from './Motion';
import { Pip } from './Pip';

/** Pip hops, sparkles burst and the phone gives a happy buzz: for real wins only. */
export function CelebratePip({
  size = 160,
  growth,
  cheer = true,
}: {
  size?: number;
  growth?: number;
  /** Small wins (stopped early) get Pip without the burst. */
  cheer?: boolean;
}) {
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (!cheer) {
      return;
    }
    const t = setTimeout(() => {
      setBurst(1);
      haptic.success();
    }, 250);
    return () => clearTimeout(t);
  }, [cheer]);
  return (
    <View style={styles.wrap}>
      <Sparkles burstKey={burst} />
      <Pop trigger={burst}>
        <Pip size={size} mood={cheer ? 'cheer' : 'happy'} growth={growth} />
      </Pop>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
});
